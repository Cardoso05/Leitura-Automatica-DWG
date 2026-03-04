 from collections import defaultdict
 from dataclasses import dataclass
 from datetime import datetime
 from pathlib import Path
 from typing import Dict, Iterable, List

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
             LayerSummary(name=layer, entity_count=count, suggested_discipline=guess_discipline(layer))
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
             discipline = layer_map.get(layer) or guess_discipline(layer) or Discipline.generic
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
             discipline = layer_map.get(layer) or guess_discipline(layer) or Discipline.generic
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
             discipline = layer_map.get(layer) or guess_discipline(layer) or Discipline.generic
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
         etype = entity.dxftype()
         if etype == "LINE":
             start = entity.dxf.start
             end = entity.dxf.end
             return ((start[0] - end[0]) ** 2 + (start[1] - end[1]) ** 2) ** 0.5
         if etype == "LWPOLYLINE":
             return entity.length()
         if etype == "POLYLINE":
             return entity.length()
         return 0.0
