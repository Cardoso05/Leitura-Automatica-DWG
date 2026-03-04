from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from math import sqrt
from pathlib import Path
from typing import Dict, List

import ezdxf
from loguru import logger

from app.models.project import Discipline
from app.utils.layers import guess_discipline


@dataclass
class LayerSummary:
    name: str
    entity_count: int
    suggested_discipline: Discipline | None


@dataclass
class ParsedEntity:
    discipline: Discipline
    category: str
    description: str
    unit: str
    quantity: float
    layer: str
    block_name: str | None = None


class DXFParser:
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
        entities: list[ParsedEntity] = []
        blocks_counter: Dict[str, int] = defaultdict(int)
        linear_counter: Dict[str, float] = defaultdict(float)
        scale_ratio = scale_ratio or 1.0

        for entity in msp:
            layer = entity.dxf.layer
            discipline = (
                layer_map.get(layer) or guess_discipline(layer) or Discipline.generic
            )
            etype = entity.dxftype()

            if etype == "INSERT":
                block_name = entity.dxf.name
                key = f"{layer}::{block_name}"
                blocks_counter[key] += 1
                entities.append(
                    ParsedEntity(
                        discipline=discipline,
                        category="block",
                        description=block_name,
                        unit="un",
                        quantity=1,
                        layer=layer,
                        block_name=block_name,
                    )
                )
            elif etype in {"LINE", "LWPOLYLINE", "POLYLINE"}:
                length = self._compute_length(entity) * scale_ratio
                linear_counter[layer] += length
            elif etype in {"CIRCLE", "ARC"}:
                # Pode ser interpretado como comprimento (perímetro) ou item pontual
                radius = getattr(entity.dxf, "radius", 0)
                if radius:
                    linear_counter[layer] += 2 * 3.1415 * radius * scale_ratio

        for key, qty in blocks_counter.items():
            layer, block_name = key.split("::", 1)
            discipline = (
                layer_map.get(layer) or guess_discipline(layer) or Discipline.generic
            )
            entities.append(
                ParsedEntity(
                    discipline=discipline,
                    category="block_total",
                    description=block_name,
                    unit="un",
                    quantity=qty,
                    layer=layer,
                    block_name=block_name,
                )
            )

        for layer, meters in linear_counter.items():
            discipline = (
                layer_map.get(layer) or guess_discipline(layer) or Discipline.generic
            )
            entities.append(
                ParsedEntity(
                    discipline=discipline,
                    category="linear",
                    description=f"Metragem {layer}",
                    unit="m",
                    quantity=meters,
                    layer=layer,
                )
            )

        metadata = {
            "total_layers": len(layer_map),
            "generated_at": datetime.utcnow().isoformat(),
            "file": Path(dxf_path).name,
            "parser_version": "0.1.0",
        }
        logger.info("DXF parse completed for %s", dxf_path)
        return entities, metadata

    def _compute_length(self, entity: ezdxf.entities.DXFEntity) -> float:
        try:
            etype = entity.dxftype()

            if etype == "LINE":
                s = entity.dxf.start
                e = entity.dxf.end
                return sqrt((s[0] - e[0]) ** 2 + (s[1] - e[1]) ** 2)

            if etype == "LWPOLYLINE":
                # ezdxf LWPolyline não tem .length() — calcula pela soma de segmentos
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
