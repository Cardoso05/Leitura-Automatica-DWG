"""
Dicionário de blocos para tradução de nomes técnicos para descrições humanas.
Inclui padrões regex e mapeamentos fixos.
"""
import re
from dataclasses import dataclass
from typing import Optional

from app.models.project import Discipline


@dataclass
class BlockDescription:
    description: str
    discipline: Discipline
    unit: str = "un"
    is_material: bool = True
    category: str | None = None


REGEX_PATTERNS = [
    (
        r"^TRF(\d+)-(\d+)-(\d+)KV(?:-([A-Z0-9]+))?(?:-([A-Z0-9]+))?$",
        lambda m: BlockDescription(
            description=f"Transformador a seco {m.group(1)}kVA, {m.group(2)}V/{m.group(3)}kV"
            + (f", {_decode_ip(m.group(4))}" if m.group(4) else "")
            + (f", {_decode_ventilation(m.group(5))}" if m.group(5) else ""),
            discipline=Discipline.electrical,
            category="transformador",
        ),
    ),
    (
        r"^CUB(\d+)KV-([A-Z0-9]+)-([A-Z]+)$",
        lambda m: BlockDescription(
            description=f"Cubículo {m.group(1)}kV, {_decode_cubicle_type(m.group(2))}, {_decode_view(m.group(3))}",
            discipline=Discipline.electrical,
            category="cubículo",
        ),
    ),
    (
        r"^L-(\d+)X(\d+)(?:-([A-Z0-9]+))?$",
        lambda m: BlockDescription(
            description=f"Luminária {m.group(1)}x{m.group(2)}W"
            + (f", {_decode_ip(m.group(3))}" if m.group(3) else ""),
            discipline=Discipline.electrical,
            category="luminária",
        ),
    ),
    (
        r"^E-T(\d+)([A-Z]+)$",
        lambda m: BlockDescription(
            description=f"Quadro elétrico tipo T{m.group(1)}{m.group(2)} ({_decode_panel_type(m.group(2))})",
            discipline=Discipline.electrical,
            category="quadro",
        ),
    ),
    (
        r"^JUNC-([A-Z]+)-([A-Z])-(\d+)X(\d+)$",
        lambda m: BlockDescription(
            description=f"Junção {_decode_junction_type(m.group(1))} {m.group(2)} para perfilado {m.group(3)}x{m.group(4)}mm",
            discipline=Discipline.electrical,
            category="acessório",
        ),
    ),
    (
        r"^curva-(\d+)pol-([a-z]+)$",
        lambda m: BlockDescription(
            description=f"Curva {m.group(2)} para eletrocalha {m.group(1)} polos",
            discipline=Discipline.electrical,
            category="acessório",
        ),
    ),
    (
        r"^Leito[\s_-]?(\d+)(?:[\s_-]?([A-Z]))?$",
        lambda m: BlockDescription(
            description=f"Leito de cabos {m.group(1)}mm" + (f" tipo {m.group(2)}" if m.group(2) else ""),
            discipline=Discipline.electrical,
            category="infraestrutura",
        ),
    ),
    (
        r"^POT(\d*)$",
        lambda m: BlockDescription(
            description=f"Ponto de força" + (f" tipo {m.group(1)}" if m.group(1) else ""),
            discipline=Discipline.electrical,
            category="ponto",
        ),
    ),
    (
        r"^A\$C[A-Z0-9]+-flat-\d+$",
        lambda m: BlockDescription(
            description="Ponto de aterramento",
            discipline=Discipline.electrical,
            category="aterramento",
        ),
    ),
]

FIXED_MAPPINGS = {
    "ilemg": BlockDescription(
        description="Luminária de iluminação de emergência",
        discipline=Discipline.electrical,
        category="luminária",
    ),
    "barra-terra": BlockDescription(
        description="Barra de aterramento (barramento de terra)",
        discipline=Discipline.electrical,
        category="aterramento",
    ),
    "barra_terra": BlockDescription(
        description="Barra de aterramento (barramento de terra)",
        discipline=Discipline.electrical,
        category="aterramento",
    ),
    "pot1": BlockDescription(
        description="Ponto de força (tomada de energia)",
        discipline=Discipline.electrical,
        category="ponto",
    ),
    "do": BlockDescription(
        description="Símbolo de direção/origem",
        discipline=Discipline.auxiliary,
        is_material=False,
    ),
    "cleito": BlockDescription(
        description="Referência de projeto/autor",
        discipline=Discipline.auxiliary,
        is_material=False,
    ),
    "ca_pers058": BlockDescription(
        description="Bloco de pessoa (escala humana)",
        discipline=Discipline.auxiliary,
        is_material=False,
    ),
    "base-p12": BlockDescription(
        description="XREF de planta de arquitetura",
        discipline=Discipline.architecture,
        is_material=False,
    ),
    "norte": BlockDescription(
        description="Indicação de norte",
        discipline=Discipline.auxiliary,
        is_material=False,
    ),
    "carimbo": BlockDescription(
        description="Carimbo/selo do projeto",
        discipline=Discipline.auxiliary,
        is_material=False,
    ),
}


def _decode_ip(code: str | None) -> str:
    if not code:
        return ""
    if code.startswith("IP"):
        return f"proteção {code}"
    return code


def _decode_ventilation(code: str | None) -> str:
    codes = {
        "VF": "ventilação forçada",
        "VL": "ventilação lateral",
        "VL2": "ventilação lateral tipo 2",
        "VN": "ventilação natural",
    }
    return codes.get(code or "", code or "")


def _decode_cubicle_type(code: str) -> str:
    codes = {
        "DM1A": "disjuntor MT tipo 1A",
        "DM1B": "disjuntor MT tipo 1B",
        "GAM": "gaveta de medição",
        "GAP": "gaveta de proteção",
        "SEC": "seccionador",
    }
    return codes.get(code, code)


def _decode_view(code: str) -> str:
    codes = {
        "VS": "vista superior",
        "VF": "vista frontal",
        "VL": "vista lateral",
        "VT": "vista traseira",
    }
    return codes.get(code, code)


def _decode_panel_type(code: str) -> str:
    if "MC" in code:
        return "distribuição"
    if "MSC" in code:
        return "sub-distribuição"
    if "G" in code:
        return "geral"
    return code


def _decode_junction_type(code: str) -> str:
    codes = {
        "INT": "interna",
        "EXT": "externa",
        "ANG": "angular",
    }
    return codes.get(code, code)


def resolve_block_description(block_name: str) -> Optional[BlockDescription]:
    """
    Tenta resolver um nome de bloco para uma descrição humana.
    Primeiro tenta mapeamentos fixos, depois padrões regex.
    """
    if not block_name:
        return None
    
    lname = block_name.lower()
    if lname in FIXED_MAPPINGS:
        return FIXED_MAPPINGS[lname]
    
    for pattern in FIXED_MAPPINGS:
        if pattern in lname:
            return FIXED_MAPPINGS[pattern]
    
    for pattern, resolver in REGEX_PATTERNS:
        match = re.match(pattern, block_name, re.IGNORECASE)
        if match:
            return resolver(match)
    
    return None


def get_default_mappings() -> list[dict]:
    """Retorna lista de mapeamentos default para seeding do banco."""
    mappings = []
    
    for name, desc in FIXED_MAPPINGS.items():
        mappings.append({
            "block_name_pattern": name,
            "material_description": desc.description,
            "discipline": desc.discipline,
            "unit": desc.unit,
            "is_material": desc.is_material,
            "is_default": True,
            "use_regex": False,
            "category": desc.category,
        })
    
    regex_examples = [
        ("TRF*", "Transformador a seco (padrão TRF{kVA}-{V}-{kV}KV)", Discipline.electrical, True, "transformador"),
        ("CUB*KV-*", "Cubículo de média tensão", Discipline.electrical, True, "cubículo"),
        ("L-*X*", "Luminária (padrão L-{QTD}X{W})", Discipline.electrical, True, "luminária"),
        ("E-T*", "Quadro elétrico tipo T", Discipline.electrical, True, "quadro"),
        ("JUNC-*", "Junção para perfilado/eletrocalha", Discipline.electrical, True, "acessório"),
        ("curva-*", "Curva para eletrocalha", Discipline.electrical, True, "acessório"),
        ("Leito*", "Leito de cabos", Discipline.electrical, True, "infraestrutura"),
        ("POT*", "Ponto de força", Discipline.electrical, True, "ponto"),
        ("A$C*-flat-*", "Ponto de aterramento", Discipline.electrical, True, "aterramento"),
    ]
    
    for pattern, desc, disc, is_mat, cat in regex_examples:
        mappings.append({
            "block_name_pattern": pattern,
            "material_description": desc,
            "discipline": disc,
            "unit": "un",
            "is_material": is_mat,
            "is_default": True,
            "use_regex": True,
            "category": cat,
        })
    
    return mappings
