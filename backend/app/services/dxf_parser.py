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
    is_likely_material,
)
from app.utils.block_dictionary import (
    resolve_block_description,
    LAYER_DESCRIPTIONS,
    LAYER_BLOCK_DESCRIPTIONS,
)

VIEW_SUFFIXES = ["-VS", "-VF", "-VL", "-VL2", "-VP", "-VC"]

_XREF_NEST_RE = re.compile(r"^.+\$\d+\$\$\d+\$(.+)$")


def _clean_xref_block_name(name: str) -> str:
    """Remove prefixos XREF aninhados: 'xref$1$$0$BLOCK_NAME' → 'BLOCK_NAME'."""
    m = _XREF_NEST_RE.match(name)
    return m.group(1).strip() if m else name


_MOJIBAKE_MAP = {
    "\u00c3?": "\u00c1",              # Ã? → Á
    "\u00c3\u0081": "\u00c1",         # Ã\x81 → Á
    "\u00c3\u00a1": "\u00e1",         # Ã¡ → á
    "\u00c3\u2030": "\u00c9",         # Ã‰ → É
    "\u00c3\u00a9": "\u00e9",         # Ã© → é
    "\u00c3\u008d": "\u00cd",         # Ã\x8d → Í
    "\u00c3\u00ad": "\u00ed",         # Ã­ → í
    "\u00c3\u201c": "\u00d3",         # Ã" → Ó
    "\u00c3\u00b3": "\u00f3",         # Ã³ → ó
    "\u00c3\u0160": "\u00da",         # Ãš → Ú
    "\u00c3\u00ba": "\u00fa",         # Ãº → ú
    "\u00c3\u2021": "\u00c7",         # Ã‡ → Ç
    "\u00c3\u00a7": "\u00e7",         # Ã§ → ç
    "\u00c3\u0192": "\u00c3",         # Ãƒ → Ã
    "\u00c3\u00a3": "\u00e3",         # Ã£ → ã
    "\u00c3\u00b5": "\u00f5",         # Ãµ → õ
    "\u00c3\u201a": "\u00c2",         # Ã‚ → Â
    "\u00c3\u00aa": "\u00ea",         # Ãª → ê
    "\u00c3\u00b4": "\u00f4",         # Ã´ → ô
    "\u00c3\u00a2": "\u00e2",         # Ã¢ → â
    "\u00c3\u00ae": "\u00ee",         # Ã® → î
    "\u00c3\u00bc": "\u00fc",         # Ã¼ → ü
}


def _safe_str(value: str | None) -> str:
    """
    Normaliza strings vindas do DXF:
    1. Repara mojibake parcial via tabela de padrões conhecidos (ex: "Ã?" → "Á").
    2. Reverte mojibake completo (UTF-8 bytes interpretados como cp1252/latin1).
    3. Remove surrogates (U+D800–U+DFFF) de DXFs legados.
    """
    if not value:
        return value or ""

    # Reparo rápido por padrões conhecidos (cobre casos onde bytes já foram
    # substituídos por '?' antes de chegarmos aqui)
    if "Ã" in value:
        fixed = value
        for pattern, replacement in _MOJIBAKE_MAP.items():
            if pattern in fixed:
                fixed = fixed.replace(pattern, replacement)
        if fixed != value:
            return fixed.encode("utf-8", errors="replace").decode("utf-8", errors="replace")
        # Tentar reverter mojibake cp1252 → utf-8
        try:
            fixed = value.encode("cp1252").decode("utf-8")
            if fixed != value:
                return fixed
        except (UnicodeDecodeError, UnicodeEncodeError):
            pass

    # Fallback: remover surrogates
    return value.encode("utf-8", errors="replace").decode("utf-8", errors="replace")


def get_material_key(block_name: str) -> str:
    """Remove sufixo de vista para agrupar vistas do mesmo equipamento como um único material."""
    upper = block_name.upper()
    for suffix in VIEW_SUFFIXES:
        if upper.endswith(suffix):
            return block_name[: -len(suffix)]
    return block_name


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
    attribs: Dict[str, str] | None = None


_USEFUL_ATTRIB_TAGS = {
    "DESCRIPTION", "DESC", "DESCRICAO", "DESCRICÃO", "DESCRIÇÃO",
    "NAME", "NOME", "MODEL", "MODELO", "MANUFACTURER", "FABRICANTE",
    "TYPE", "TIPO", "MATERIAL", "TAG", "POTENCIA", "POWER",
    "AMPERAGE", "CORRENTE", "TENSAO", "VOLTAGE",
}


class DXFParser:
    def __init__(self):
        self._block_resolution_cache: Dict[str, str] = {}
        self._attrib_cache: Dict[str, Dict[str, str]] = {}

    def list_layers(self, dxf_path: str) -> List[LayerSummary]:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        counts: Dict[str, int] = defaultdict(int)
        for entity in msp:
            try:
                counts[_safe_str(entity.dxf.layer)] += 1
            except Exception:
                continue
        return [
            LayerSummary(
                name=layer,
                entity_count=count,
                suggested_discipline=guess_discipline(layer),
            )
            for layer, count in counts.items()
        ]

    # Versões antigas (R12/R14) usam ASCII e POLYLINE — muito mais lentas de parsear.
    # AC1015 = R2000, AC1018 = R2004 (binário, LWPOLYLINE).
    _LEGACY_VERSIONS = {"AC1006", "AC1009", "AC1012"}

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
        
        is_legacy = doc.dxfversion in self._LEGACY_VERSIONS
        if is_legacy:
            logger.warning(
                "DXF %s está no formato legado %s (R12/R14 ASCII). "
                "Salve como R2004 ou superior para ~10x mais velocidade de parse.",
                Path(dxf_path).name,
                doc.dxfversion,
            )
        
        blocks_counter: Dict[str, int] = defaultdict(int)
        block_name_for_key: Dict[str, str] = {}
        block_attribs_for_key: Dict[str, Dict[str, str]] = {}
        linear_counter: Dict[str, float] = defaultdict(float)
        extracted_texts: List[ExtractedText] = []
        self._attrib_cache.clear()
        
        ignored_layers = set()
        processed_layers = set()
        text_layers_of_interest = {"ele-fiação", "ele-textos", "ele-chamadas", "ele-equiptos"}

        for entity in msp:
            try:
                layer = _safe_str(entity.dxf.layer)
            except Exception:
                continue
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
                block_name = _safe_str(entity.dxf.name)
                
                if is_non_material_block(block_name):
                    continue
                
                if is_anonymous_block(block_name):
                    try:
                        block_def = doc.blocks.get(block_name)
                        if block_def and not is_likely_material(block_def):
                            continue
                    except Exception:
                        pass
                
                resolved_name = self._resolve_block_name(doc, block_name)
                
                if is_non_material_block(resolved_name):
                    continue
                
                material_key = get_material_key(resolved_name)
                key = f"{layer}::{material_key}"
                blocks_counter[key] += 1
                if key not in block_name_for_key:
                    block_name_for_key[key] = block_name

                if key not in block_attribs_for_key:
                    attribs = self._extract_insert_attribs(entity)
                    if not attribs:
                        attribs = self._extract_block_attdefs(doc, block_name)
                    if attribs:
                        block_attribs_for_key[key] = attribs

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
                    text_content = _safe_str(self._extract_text_content(entity))
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
            layer, material_key = key.split("::", 1)
            original_block_name = block_name_for_key.get(key, material_key)
            layer_clean = clean_layer_name(layer)
            discipline = (
                layer_map.get(layer)
                or layer_map.get(layer_clean)
                or guess_discipline(layer)
                or Discipline.generic
            )

            # 1) Tentar dicionário com o nome resolvido
            block_desc = resolve_block_description(material_key)

            # 2) Se não achou, tentar com o nome original do bloco
            if not block_desc and original_block_name != material_key:
                block_desc = resolve_block_description(original_block_name)

            human_description = None
            block_category = None

            if block_desc:
                human_description = block_desc.description
                block_category = block_desc.category
                if not block_desc.is_material:
                    continue

            # 3) Fallback ATTDEF: tentar descrição extraída dos atributos do bloco
            if not human_description:
                attribs = block_attribs_for_key.get(key, {})
                attrib_desc = self._describe_from_attribs(attribs)
                if attrib_desc:
                    human_description = attrib_desc

            # 4) Fallback: usar layer como descrição para blocos anônimos
            if not human_description:
                layer_fallback = LAYER_BLOCK_DESCRIPTIONS.get(layer_clean)
                if not layer_fallback:
                    layer_fallback = LAYER_BLOCK_DESCRIPTIONS.get(layer)
                if layer_fallback:
                    human_description = layer_fallback

            # 5) Último recurso: descrição curta/inútil → melhorar
            final_desc = human_description or material_key
            if len(final_desc) <= 2 or final_desc.startswith("Bloco "):
                layer_hint = LAYER_BLOCK_DESCRIPTIONS.get(layer_clean) or LAYER_BLOCK_DESCRIPTIONS.get(layer)
                if layer_hint:
                    final_desc = layer_hint

            entities.append(
                ParsedEntity(
                    discipline=discipline,
                    category="block",
                    description=_safe_str(final_desc),
                    unit="un",
                    quantity=qty,
                    layer=_safe_str(layer),
                    layer_clean=_safe_str(layer_clean),
                    block_name=_safe_str(original_block_name),
                    resolved_name=_safe_str(material_key),
                    human_description=_safe_str(human_description) if human_description else None,
                    block_category=block_category,
                    attribs=block_attribs_for_key.get(key),
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
            linear_desc = (
                LAYER_DESCRIPTIONS.get(layer_clean)
                or LAYER_DESCRIPTIONS.get(layer)
                or self._smart_linear_description(layer_clean)
            )
            entities.append(
                ParsedEntity(
                    discipline=discipline,
                    category="linear",
                    description=linear_desc,
                    unit="m",
                    quantity=round(meters, 2),
                    layer=_safe_str(layer),
                    layer_clean=_safe_str(layer_clean),
                )
            )

        # Consolidar entradas de blocos com mesmo (layer, description)
        seen: dict[tuple[str, str], int] = {}
        consolidated: list[ParsedEntity] = []
        for e in entities:
            if e.category == "block":
                key = (e.layer, e.description)
                if key in seen:
                    consolidated[seen[key]].quantity += e.quantity
                    continue
                seen[key] = len(consolidated)
            consolidated.append(e)
        entities = consolidated

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
            "parser_version": "0.5.1",
            "dxf_version": doc.dxfversion,
            "dxf_legacy": is_legacy,
            "scale_detected": detected_scale.get("value"),
            "scale_auto_factor": detected_scale.get("factor"),
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
        """
        Detecta a unidade de medida do DXF via $INSUNITS e a escala do desenho via Paper Space.
        O 'factor' converte unidades DXF para metros. A escala do papel (ex: 1:25) é registrada
        em 'value' apenas para exibição, e NÃO altera o fator de conversão.
        """
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
        
        # $INSUNITS não definido (0) — tenta detectar escala no Paper Space apenas para
        # exibição. A unidade padrão assume mm (mais comum em AutoCAD brasileiro).
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
                                result["value"] = f"1:{scale_val}"
                                result["source"] = "paper_space_text"
                                # Escala do papel é visual — não altera o fator de unidade.
                                # Assume mm como unidade do DXF (padrão AutoCAD/ZWCAD BR).
                                result["factor"] = 0.001
                                return result
        except Exception as e:
            logger.debug("Erro ao buscar escala no Paper Space: %s", e)
        
        # Sem informação de unidade: assume mm (padrão mais comum em projetos nacionais)
        result["factor"] = 0.001
        result["source"] = "default_mm"
        return result

    def _extract_insert_attribs(self, entity) -> Dict[str, str]:
        """Extrai valores ATTRIB de uma entidade INSERT."""
        attribs: Dict[str, str] = {}
        try:
            for attrib in entity.attribs:
                tag = _safe_str(attrib.dxf.tag).upper().strip()
                value = _safe_str(attrib.dxf.text).strip()
                if tag and value and len(value) > 1:
                    attribs[tag] = value
        except Exception:
            pass
        return attribs

    def _extract_block_attdefs(self, doc: Drawing, block_name: str) -> Dict[str, str]:
        """Extrai ATTDEF defaults de uma definição de bloco."""
        if block_name in self._attrib_cache:
            return self._attrib_cache[block_name]
        attdefs: Dict[str, str] = {}
        try:
            block = doc.blocks.get(block_name)
            if block:
                for ent in block:
                    if ent.dxftype() == "ATTDEF":
                        tag = _safe_str(ent.dxf.tag).upper().strip()
                        value = _safe_str(ent.dxf.text).strip()
                        if tag and value and len(value) > 1:
                            attdefs[tag] = value
        except Exception:
            pass
        self._attrib_cache[block_name] = attdefs
        return attdefs

    def _describe_from_attribs(self, attribs: Dict[str, str]) -> str | None:
        """Tenta construir uma descrição a partir de atributos ATTDEF/ATTRIB."""
        if not attribs:
            return None
        useful = {k: v for k, v in attribs.items() if k in _USEFUL_ATTRIB_TAGS}
        if not useful:
            return None
        desc_keys = ["DESCRIPTION", "DESC", "DESCRICAO", "DESCRICÃO", "DESCRIÇÃO"]
        for k in desc_keys:
            if k in useful and len(useful[k]) > 2:
                return useful[k]
        name_keys = ["NAME", "NOME", "MODEL", "MODELO"]
        for k in name_keys:
            if k in useful and len(useful[k]) > 2:
                return useful[k]
        mfg_keys = ["MANUFACTURER", "FABRICANTE"]
        type_keys = ["TYPE", "TIPO"]
        parts = []
        for k in type_keys:
            if k in useful:
                parts.append(useful[k])
        for k in mfg_keys:
            if k in useful:
                parts.append(useful[k])
        if parts:
            return " - ".join(parts)
        return None

    def _resolve_block_name(
        self, doc: Drawing, block_name: str, depth: int = 0, max_depth: int = 5
    ) -> str:
        """Resolve blocos anônimos (*U, *X, zw$, A$) para nomes legíveis."""
        if depth > max_depth:
            return block_name

        if block_name in self._block_resolution_cache:
            return self._block_resolution_cache[block_name]

        if not is_anonymous_block(block_name):
            cleaned = _clean_xref_block_name(block_name)
            if cleaned != block_name:
                self._block_resolution_cache[block_name] = cleaned
                return cleaned
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
                if not is_anonymous_block(resolved) and not resolved.startswith("Bloco "):
                    legible_names.append(_clean_xref_block_name(resolved))

            if legible_names:
                name_counts = defaultdict(int)
                for name in legible_names:
                    name_counts[name] += 1
                most_common = max(name_counts, key=name_counts.get)
                result = most_common
            else:
                result = block_name

            self._block_resolution_cache[block_name] = result
            return result

        except Exception as e:
            logger.debug("Erro ao resolver bloco %s: %s", block_name, e)
            return block_name

    @staticmethod
    def _smart_linear_description(layer_clean: str) -> str:
        """Gera descrição inteligente para metragem a partir do nome do layer."""
        lname = layer_clean.lower()
        parts = []

        if "aparente" in lname:
            parts.append("aparente")
        elif "embutido" in lname:
            parts.append("embutido")
        elif "piso" in lname:
            parts.append("piso")

        if "dai" in lname or "sdai" in lname:
            infra = "Eletroduto" if not parts else f"Eletroduto {parts[0]}"
            return f"{infra} (SDAI)"
        if "calha" in lname:
            return f"Eletrocalha {_safe_str(layer_clean)}"
        if "elo" in lname or "eletroduto" in lname:
            return f"Eletroduto {' '.join(parts)}".strip()
        if "fia" in lname:
            return "Fiação / cabeamento"
        if "leito" in lname:
            return "Leito de cabos"
        if "perfilado" in lname:
            return "Perfilado metálico"
        if "alim" in lname:
            return f"Alimentador {_safe_str(layer_clean)}"
        if "spda" in lname:
            return "Condutor SPDA"

        return f"Infraestrutura linear ({_safe_str(layer_clean)})"

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
