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
from app.services.dxf_parser import DXFParser, ParsedEntity


class TakeoffEngine:
    def __init__(self) -> None:
        self.parser = DXFParser()

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
