from collections import defaultdict
from datetime import datetime
from fnmatch import fnmatch
from typing import Dict, List, Tuple

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.block_mapping import BlockMapping
from app.models.project import (
    Discipline,
    Project,
    ProjectStatus,
    Takeoff,
    TakeoffItem,
)
from app.services.ai_block_resolver import AIBlockResolver, UnresolvedBlock
from app.services.dxf_parser import DXFParser, ParsedEntity


class TakeoffEngine:
    def __init__(self) -> None:
        self.parser = DXFParser()
        self.ai_resolver = AIBlockResolver()

    async def process(
        self,
        *,
        project: Project,
        session: AsyncSession,
        layer_map: Dict[str, Discipline],
        scale_ratio: float | None = None,
    ) -> Takeoff:
        logger.info("Starting takeoff for project %s", project.id)
        entities, metadata = self.parser.parse(
            project.dxf_path or project.file_path, layer_map, scale_ratio
        )

        entities = await self._enrich_with_ai(entities, session)

        mappings = await self._load_mappings(session, project.user_id)
        aggregated, summary = self._aggregate_entities(entities, mappings)

        takeoff = Takeoff(
            project_id=project.id,
            discipline=Discipline.generic,
            status=ProjectStatus.completed,
            result_json={"summary": summary, "metadata": metadata},
        )
        session.add(takeoff)
        await session.flush()

        for item in aggregated:
            session.add(
                TakeoffItem(
                    takeoff_id=takeoff.id,
                    discipline=item["discipline"],
                    category=item["category"],
                    description=item["description"],
                    unit=item["unit"],
                    quantity=item["quantity"],
                    layer=item["layer"],
                    block_name=item.get("block_name"),
                )
            )

        project.status = ProjectStatus.completed
        project.updated_at = datetime.utcnow()
        project.result_summary = {"summary": summary, "metadata": metadata}
        await session.commit()
        await session.refresh(takeoff)
        logger.info("Takeoff finished for project %s", project.id)
        return takeoff

    async def _enrich_with_ai(
        self, entities: List[ParsedEntity], session: AsyncSession
    ) -> List[ParsedEntity]:
        """Enriquece entidades não resolvidas via cache DB + LLM."""
        unresolved: list[UnresolvedBlock] = []
        unresolved_indices: list[int] = []

        for idx, e in enumerate(entities):
            if e.category != "block":
                continue
            has_good_desc = (
                e.human_description
                and len(e.human_description) > 3
                and not e.human_description.startswith("Bloco ")
            )
            if has_good_desc:
                continue
            desc_is_raw = (
                e.description == e.resolved_name
                or e.description == e.block_name
                or len(e.description) <= 3
                or e.description.startswith("Bloco ")
                or e.description.startswith("*U")
            )
            if not desc_is_raw:
                continue
            unresolved.append(UnresolvedBlock(
                block_name=e.block_name or "",
                resolved_name=e.resolved_name or e.block_name or "",
                layer=e.layer,
                layer_clean=e.layer_clean,
                attribs=getattr(e, "attribs", None),
            ))
            unresolved_indices.append(idx)

        if not unresolved:
            return entities

        logger.info("AI resolver: %d blocos não resolvidos detectados", len(unresolved))
        try:
            resolved_map = await self.ai_resolver.resolve_batch(unresolved, session)
        except Exception as exc:
            logger.error("Falha no AI resolver: %s", exc)
            return entities

        updated = 0
        for idx, block in zip(unresolved_indices, unresolved):
            key = f"{block.layer}::{block.resolved_name}"
            ai_result = resolved_map.get(key)
            if ai_result and ai_result.description:
                e = entities[idx]
                e.description = ai_result.description
                e.human_description = ai_result.description
                if ai_result.discipline:
                    try:
                        e.discipline = Discipline(ai_result.discipline)
                    except ValueError:
                        pass
                if ai_result.category:
                    e.block_category = ai_result.category
                updated += 1

        if updated:
            logger.info("AI resolver: %d/%d blocos enriquecidos", updated, len(unresolved))

        return entities

    async def _load_mappings(
        self, session: AsyncSession, user_id: int
    ) -> List[BlockMapping]:
        stmt = select(BlockMapping).where(
            (BlockMapping.user_id == user_id) | (BlockMapping.user_id.is_(None))
        )
        result = await session.execute(stmt)
        mappings = result.scalars().all()
        return sorted(mappings, key=lambda m: (0 if m.user_id else 1, m.block_name_pattern))

    def _aggregate_entities(
        self, entities: List[ParsedEntity], mappings: List[BlockMapping]
    ) -> tuple[List[dict], Dict[str, float]]:
        summary: Dict[str, float] = defaultdict(float)
        aggregated: Dict[Tuple, dict] = {}

        for entity in entities:
            block_name_for_match = entity.resolved_name or entity.block_name
            match = self._match_mapping(block_name_for_match, mappings)
            
            if match:
                description = match.material_description
                unit = match.unit
            elif getattr(entity, 'human_description', None):
                description = entity.human_description
                unit = entity.unit
            else:
                description = entity.description
                unit = entity.unit
            
            layer_display = getattr(entity, 'layer_clean', entity.layer) or entity.layer
            block_category = getattr(entity, 'block_category', None)
            
            key = (
                entity.discipline.value,
                description,
                unit,
                layer_display,
                entity.block_name or "n/a",
                entity.category,
            )
            item = aggregated.get(key)
            if not item:
                item = {
                    "discipline": entity.discipline.value,
                    "description": description,
                    "unit": unit,
                    "quantity": 0.0,
                    "layer": layer_display,
                    "block_name": entity.block_name,
                    "resolved_name": getattr(entity, 'resolved_name', None),
                    "category": entity.category,
                    "block_category": block_category,
                }
                aggregated[key] = item
            item["quantity"] += entity.quantity
            
            if entity.category == "block":
                summary[entity.discipline.value] += entity.quantity
            elif entity.category == "linear":
                summary[f"{entity.discipline.value}_linear"] += entity.quantity

        result_list = list(aggregated.values())
        result_list.sort(key=lambda x: (x["discipline"], x["category"], -x["quantity"]))
        
        return result_list, summary

    def _match_mapping(
        self, block_name: str | None, mappings: List[BlockMapping]
    ) -> BlockMapping | None:
        if not block_name:
            return None
        lname = block_name.lower()
        for mapping in mappings:
            pattern = mapping.block_name_pattern.lower()
            if fnmatch(lname, pattern):
                return mapping
        return None
