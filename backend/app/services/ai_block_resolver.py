"""Serviço de resolução inteligente de blocos DXF.

Pipeline:  cache DB → LLM (OpenAI) → salva no cache
Chamado pelo TakeoffEngine após o parse síncrono do DXF.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.config import get_settings
from app.models.block_cache import BlockResolutionCache

settings = get_settings()

_SYSTEM_PROMPT = """\
Você é um engenheiro especialista em projetos elétricos, hidráulicos, HVAC, \
SDAI (sistema de detecção e alarme de incêndio) e SPDA (proteção contra descargas atmosféricas).

Dado o nome de um bloco DXF e o layer onde foi inserido, identifique o componente \
físico que ele representa. Retorne um JSON com os campos:
- "description": descrição curta em português do Brasil (ex: "Tomada 2P+T", "Detector de fumaça")
- "discipline": uma de [electrical, plumbing, fire, hvac, spda, networking, generic]
- "category": categoria genérica (ex: "tomada", "luminária", "detector", "bomba", "equipamento")
- "confidence": 0.0 a 1.0 indicando sua confiança na resposta

Se não conseguir identificar, retorne:
{"description": null, "discipline": "generic", "category": null, "confidence": 0.0}

Responda SOMENTE com JSON válido, sem markdown, sem explicações."""


@dataclass
class UnresolvedBlock:
    block_name: str
    resolved_name: str
    layer: str
    layer_clean: str
    attribs: dict[str, str] | None = None


@dataclass
class AIResolvedBlock:
    description: str
    discipline: str | None = None
    category: str | None = None
    confidence: float = 0.5
    source: str = "ai"


class AIBlockResolver:
    """Resolve blocos DXF não identificados via cache DB + LLM."""

    def __init__(self) -> None:
        self._openai_client = None

    def _get_openai(self):
        if self._openai_client is None:
            if not settings.openai_api_key:
                return None
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        return self._openai_client

    async def resolve_batch(
        self,
        blocks: list[UnresolvedBlock],
        session: AsyncSession,
    ) -> dict[str, AIResolvedBlock]:
        """Resolve uma lista de blocos não identificados.

        Returns dict mapping 'layer::resolved_name' → AIResolvedBlock.
        """
        if not blocks:
            return {}

        results: dict[str, AIResolvedBlock] = {}
        to_ask_llm: list[UnresolvedBlock] = []

        # 1) Consultar cache DB em batch
        block_names = list({b.resolved_name for b in blocks})
        stmt = select(BlockResolutionCache).where(
            BlockResolutionCache.block_name.in_(block_names)
        )
        db_result = await session.execute(stmt)
        cache_rows = {row.block_name: row for row in db_result.scalars().all()}

        for block in blocks:
            key = f"{block.layer}::{block.resolved_name}"
            cached = cache_rows.get(block.resolved_name)
            if cached and cached.confidence >= 0.3:
                results[key] = AIResolvedBlock(
                    description=cached.description,
                    discipline=cached.discipline,
                    category=cached.category,
                    confidence=cached.confidence,
                    source=f"cache_{cached.source}",
                )
            else:
                to_ask_llm.append(block)

        # 2) Resolver via LLM os que não estão no cache
        if to_ask_llm:
            llm_results = await self._resolve_via_llm(to_ask_llm)
            for block, resolved in zip(to_ask_llm, llm_results):
                key = f"{block.layer}::{block.resolved_name}"
                if resolved and resolved.description:
                    results[key] = resolved
                    # Salvar no cache para uso futuro
                    await self._save_to_cache(
                        session, block.resolved_name, block.layer_clean, resolved
                    )

        if results:
            logger.info(
                "AI resolver: %d/%d blocos resolvidos (%d do cache, %d via LLM)",
                len(results), len(blocks),
                len(results) - len([r for r in results.values() if r.source == "ai"]),
                len([r for r in results.values() if r.source == "ai"]),
            )

        return results

    async def _resolve_via_llm(
        self, blocks: list[UnresolvedBlock]
    ) -> list[AIResolvedBlock | None]:
        client = self._get_openai()
        if not client:
            logger.warning("OpenAI API key não configurada — pulando resolução via IA")
            return [None] * len(blocks)

        # Resolver em batches de até 20 blocos por chamada
        all_results: list[AIResolvedBlock | None] = []
        batch_size = 20

        for i in range(0, len(blocks), batch_size):
            batch = blocks[i : i + batch_size]
            all_results.extend(await self._call_llm_batch(client, batch))

        return all_results

    async def _call_llm_batch(
        self, client, blocks: list[UnresolvedBlock]
    ) -> list[AIResolvedBlock | None]:
        items = []
        for idx, b in enumerate(blocks):
            item = {
                "id": idx,
                "block_name": b.block_name,
                "resolved_name": b.resolved_name,
                "layer": b.layer_clean,
            }
            if b.attribs:
                item["attribs"] = b.attribs
            items.append(item)

        user_msg = (
            "Identifique os seguintes blocos DXF. "
            "Retorne um JSON array com um objeto para cada bloco, na mesma ordem.\n\n"
            + json.dumps(items, ensure_ascii=False)
        )

        try:
            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.1,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            parsed = json.loads(content)

            if isinstance(parsed, dict) and "blocks" in parsed:
                parsed = parsed["blocks"]
            elif isinstance(parsed, dict) and "results" in parsed:
                parsed = parsed["results"]
            elif isinstance(parsed, dict):
                values = list(parsed.values())
                if values and isinstance(values[0], list):
                    parsed = values[0]

            if not isinstance(parsed, list):
                parsed = [parsed]

            results: list[AIResolvedBlock | None] = []
            for idx, block in enumerate(blocks):
                if idx < len(parsed):
                    item = parsed[idx]
                    desc = item.get("description")
                    if desc:
                        results.append(AIResolvedBlock(
                            description=desc,
                            discipline=item.get("discipline", "generic"),
                            category=item.get("category"),
                            confidence=float(item.get("confidence", 0.5)),
                            source="ai",
                        ))
                    else:
                        results.append(None)
                else:
                    results.append(None)

            return results

        except Exception as exc:
            logger.error("Erro na chamada OpenAI: %s", exc)
            return [None] * len(blocks)

    async def _save_to_cache(
        self,
        session: AsyncSession,
        block_name: str,
        layer_hint: str | None,
        resolved: AIResolvedBlock,
    ) -> None:
        try:
            existing_stmt = select(BlockResolutionCache).where(
                BlockResolutionCache.block_name == block_name
            )
            existing = (await session.execute(existing_stmt)).scalar_one_or_none()

            if existing:
                if resolved.confidence > existing.confidence:
                    existing.description = resolved.description
                    existing.discipline = resolved.discipline
                    existing.category = resolved.category
                    existing.confidence = resolved.confidence
                    existing.source = resolved.source
                    existing.updated_at = datetime.utcnow()
            else:
                cache_entry = BlockResolutionCache(
                    block_name=block_name,
                    layer_hint=layer_hint,
                    description=resolved.description,
                    discipline=resolved.discipline,
                    category=resolved.category,
                    source=resolved.source,
                    confidence=resolved.confidence,
                )
                session.add(cache_entry)

            await session.flush()
        except Exception as exc:
            logger.warning("Erro ao salvar cache de bloco: %s", exc)
