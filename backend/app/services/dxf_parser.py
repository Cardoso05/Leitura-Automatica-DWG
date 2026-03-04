import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from math import sqrt
from pathlib import Path
from typing import Dict, List, Optional

import ezdxf
from ezdxf.document import Drawing
from loguru import logger

from app.models.project import Discipline
from app.utils.layers import (
    guess_discipline,
    should_ignore_layer,
    should_measure_linear,
    is_non_material_block,
    clean_layer_name,
    is_anonymous_block,
)
from app.utils.block_dictionary import resolve_block_description


@dataclass
class LayerSummary:
    name: str
    entity_count: int
    suggested_discipline: Discipline | None


@dataclass
class ExtractedText:
    text: str
    layer: str
    position: tuple[float, float]
    text_type: str


@dataclass
class ParsedEntity:
    discipline: Discipline
    category: str
    description: str
    unit: str
    quantity: float
    layer: str
    layer_clean: str
    block_name: str | None = None
    resolved_name: str | None = None
    human_description: str | None = None
    block_category: str | None = None


class DXFParser:
    def __init__(self):
        self._block_resolution_cache: Dict[str, str] = {}

    def list_layers(self, dxf_path: str) -> List[LayerSummary]:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        counts: Dict[str, int] = defaultdict(int)
        for entity in msp:
            counts[entity.dxf.layer] += 1
        return [
            LayerSummary(
                name=layer,
                entity_count=count,
                suggested_discipline=guess_discipline(layer),
            )
            for layer, count in counts.items()
        ]

    def parse(
        self,
        dxf_path: str,
        layer_map: Dict[str, Discipline],
        scale_ratio: float | None = None,
    ) -> tuple[list[ParsedEntity], dict]:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        
        self._block_resolution_cache.clear()
        
        detected_scale = self._detect_scale(doc)
        if scale_ratio is None:
            scale_ratio = detected_scale.get("factor", 1.0)
        
        blocks_counter: Dict[str, int] = defaultdict(int)
        linear_counter: Dict[str, float] = defaultdict(float)
        extracted_texts: List[ExtractedText] = []
        
        ignored_layers = set()
        processed_layers = set()
        text_layers_of_interest = {"ele-fiação", "ele-textos", "ele-chamadas", "ele-equiptos"}

        for entity in msp:
            layer = entity.dxf.layer
            layer_clean = clean_layer_name(layer)
            layer_lower = layer_clean.lower()
            
            if should_ignore_layer(layer):
                ignored_layers.add(layer)
                continue
            
            processed_layers.add(layer)
            
            discipline = (
                layer_map.get(layer) 
                or layer_map.get(layer_clean)
                or guess_discipline(layer) 
                or Discipline.generic
            )
            
            if discipline in (Discipline.architecture, Discipline.auxiliary):
                ignored_layers.add(layer)
                continue
            
            etype = entity.dxftype()

            if etype == "INSERT":
                block_name = entity.dxf.name
                
                if is_non_material_block(block_name):
                    continue
                
                resolved_name = self._resolve_block_name(doc, block_name)
                
                if is_non_material_block(resolved_name):
                    continue
                
                key = f"{layer}::{block_name}::{resolved_name}"
                blocks_counter[key] += 1

            elif etype in {"LINE", "LWPOLYLINE", "POLYLINE"}:
                if should_measure_linear(layer):
                    length = self._compute_length(entity) * scale_ratio
                    linear_counter[layer] += length
            
            elif etype in {"CIRCLE", "ARC"}:
                if should_measure_linear(layer):
                    radius = getattr(entity.dxf, "radius", 0)
                    if radius:
                        linear_counter[layer] += 2 * 3.1415 * radius * scale_ratio
            
            elif etype in {"TEXT", "MTEXT"}:
                if any(kw in layer_lower for kw in text_layers_of_interest):
                    text_content = self._extract_text_content(entity)
                    if text_content and len(text_content.strip()) > 1:
                        pos = self._get_entity_position(entity)
                        extracted_texts.append(ExtractedText(
                            text=text_content.strip(),
                            layer=layer_clean,
                            position=pos,
                            text_type=etype,
                        ))

        entities: list[ParsedEntity] = []

        for key, qty in blocks_counter.items():
            layer, block_name, resolved_name = key.split("::", 2)
            layer_clean = clean_layer_name(layer)
            discipline = (
                layer_map.get(layer) 
                or layer_map.get(layer_clean)
                or guess_discipline(layer) 
                or Discipline.generic
            )
            
            display_name = resolved_name if resolved_name != block_name else block_name
            
            block_desc = resolve_block_description(display_name)
            human_description = None
            block_category = None
            
            if block_desc:
                human_description = block_desc.description
                block_category = block_desc.category
                if not block_desc.is_material:
                    continue
            
            entities.append(
                ParsedEntity(
                    discipline=discipline,
                    category="block",
                    description=human_description or display_name,
                    unit="un",
                    quantity=qty,
                    layer=layer,
                    layer_clean=layer_clean,
                    block_name=block_name,
                    resolved_name=resolved_name,
                    human_description=human_description,
                    block_category=block_category,
                )
            )

        for layer, meters in linear_counter.items():
            layer_clean = clean_layer_name(layer)
            discipline = (
                layer_map.get(layer)
                or layer_map.get(layer_clean) 
                or guess_discipline(layer) 
                or Discipline.generic
            )
            entities.append(
                ParsedEntity(
                    discipline=discipline,
                    category="linear",
                    description=f"Metragem {layer_clean}",
                    unit="m",
                    quantity=round(meters, 2),
                    layer=layer,
                    layer_clean=layer_clean,
                )
            )

        entities.sort(key=lambda e: (e.discipline.value, e.category, -e.quantity))

        texts_by_layer = defaultdict(list)
        for txt in extracted_texts:
            texts_by_layer[txt.layer].append(txt.text)
        
        technical_texts = {
            layer: list(set(texts))[:50]
            for layer, texts in texts_by_layer.items()
        }

        metadata = {
            "total_layers": len(processed_layers),
            "ignored_layers": len(ignored_layers),
            "generated_at": datetime.utcnow().isoformat(),
            "file": Path(dxf_path).name,
            "parser_version": "0.3.0",
            "scale_detected": detected_scale.get("value"),
            "scale_factor": scale_ratio,
            "scale_source": detected_scale.get("source"),
            "technical_texts": technical_texts,
            "total_texts_extracted": len(extracted_texts),
        }
        logger.info("DXF parse completed for %s", dxf_path)
        return entities, metadata

    def _extract_text_content(self, entity) -> str:
        """Extrai o conteúdo de texto de uma entidade TEXT ou MTEXT."""
        try:
            if entity.dxftype() == "TEXT":
                return entity.dxf.text or ""
            elif entity.dxftype() == "MTEXT":
                return entity.text or ""
        except Exception:
            pass
        return ""

    def _get_entity_position(self, entity) -> tuple[float, float]:
        """Obtém a posição de uma entidade."""
        try:
            if entity.dxftype() == "TEXT":
                pos = entity.dxf.insert
                return (pos[0], pos[1])
            elif entity.dxftype() == "MTEXT":
                pos = entity.dxf.insert
                return (pos[0], pos[1])
            elif entity.dxftype() == "INSERT":
                pos = entity.dxf.insert
                return (pos[0], pos[1])
        except Exception:
            pass
        return (0.0, 0.0)

    def _detect_scale(self, doc: Drawing) -> dict:
        """Detecta a escala do desenho via header ou Paper Space."""
        result = {"factor": 1.0, "value": None, "source": None}
        
        try:
            insunits = doc.header.get("$INSUNITS", 0)
            unit_factors = {
                1: 0.0254,    # inches -> meters
                2: 0.3048,    # feet -> meters
                4: 0.001,     # mm -> meters
                5: 0.01,      # cm -> meters
                6: 1.0,       # meters
            }
            if insunits in unit_factors:
                result["factor"] = unit_factors[insunits]
                result["source"] = "header_insunits"
                result["value"] = f"INSUNITS={insunits}"
                return result
        except Exception:
            pass
        
        scale_pattern = re.compile(
            r"(?:ESCALA|SCALE)\s*[:=]?\s*1\s*[:/-]\s*(\d+)",
            re.IGNORECASE
        )
        
        try:
            for layout in doc.layouts:
                for entity in layout:
                    if entity.dxftype() in ("TEXT", "MTEXT"):
                        text = ""
                        if entity.dxftype() == "TEXT":
                            text = entity.dxf.text
                        elif entity.dxftype() == "MTEXT":
                            text = entity.text
                        
                        if text:
                            match = scale_pattern.search(text)
                            if match:
                                scale_val = int(match.group(1))
                                result["factor"] = 1.0 / scale_val
                                result["value"] = f"1:{scale_val}"
                                result["source"] = "paper_space_text"
                                return result
        except Exception as e:
            logger.debug("Erro ao buscar escala no Paper Space: %s", e)
        
        result["source"] = "default"
        return result

    def _resolve_block_name(
        self, doc: Drawing, block_name: str, depth: int = 0, max_depth: int = 5
    ) -> str:
        """Resolve blocos anônimos (*U, *X, zw$, A$) para nomes legíveis."""
        if depth > max_depth:
            return block_name
        
        if block_name in self._block_resolution_cache:
            return self._block_resolution_cache[block_name]
        
        if not is_anonymous_block(block_name):
            return block_name
        
        try:
            block = doc.blocks.get(block_name)
            if not block:
                return block_name
            
            nested_inserts = [e for e in block if e.dxftype() == "INSERT"]
            legible_names = []
            
            for nested in nested_inserts:
                nested_name = nested.dxf.name
                resolved = self._resolve_block_name(doc, nested_name, depth + 1)
                if not is_anonymous_block(resolved):
                    legible_names.append(resolved)
            
            if legible_names:
                name_counts = defaultdict(int)
                for name in legible_names:
                    name_counts[name] += 1
                
                most_common = max(name_counts, key=name_counts.get)
                result = most_common
            else:
                result = self._describe_by_content(block)
            
            self._block_resolution_cache[block_name] = result
            return result
            
        except Exception as e:
            logger.debug("Erro ao resolver bloco %s: %s", block_name, e)
            return block_name

    def _describe_by_content(self, block) -> str:
        """Descreve um bloco pela sua composição quando não é possível resolver o nome."""
        counts = defaultdict(int)
        for entity in block:
            counts[entity.dxftype()] += 1
        
        if not counts:
            return "Bloco vazio"
        
        parts = []
        for etype in ["INSERT", "LINE", "LWPOLYLINE", "CIRCLE", "ARC", "HATCH", "TEXT"]:
            if etype in counts:
                parts.append(f"{counts[etype]} {etype}")
        
        if parts:
            return f"Bloco composto ({', '.join(parts[:3])})"
        
        return "Bloco não identificado"

    def _compute_length(self, entity: ezdxf.entities.DXFEntity) -> float:
        try:
            etype = entity.dxftype()

            if etype == "LINE":
                s = entity.dxf.start
                e = entity.dxf.end
                return sqrt((s[0] - e[0]) ** 2 + (s[1] - e[1]) ** 2)

            if etype == "LWPOLYLINE":
                pts = list(entity.get_points(format="xy"))
                if len(pts) < 2:
                    return 0.0
                total = sum(
                    sqrt((pts[i + 1][0] - pts[i][0]) ** 2 + (pts[i + 1][1] - pts[i][1]) ** 2)
                    for i in range(len(pts) - 1)
                )
                if entity.closed and len(pts) > 1:
                    total += sqrt(
                        (pts[0][0] - pts[-1][0]) ** 2 + (pts[0][1] - pts[-1][1]) ** 2
                    )
                return total

            if etype == "POLYLINE":
                verts = list(entity.vertices)
                if len(verts) < 2:
                    return 0.0
                total = 0.0
                for i in range(len(verts) - 1):
                    a = verts[i].dxf.location
                    b = verts[i + 1].dxf.location
                    total += sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2)
                if entity.is_closed and len(verts) > 1:
                    a = verts[-1].dxf.location
                    b = verts[0].dxf.location
                    total += sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2)
                return total

        except Exception as exc:
            logger.warning("Não foi possível calcular comprimento de %s: %s", entity.dxftype(), exc)

        return 0.0
