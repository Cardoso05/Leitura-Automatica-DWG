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
    (
        r"^TOM[-_]?IND[-_]?(\d+)A$",
        lambda m: BlockDescription(
            description=f"Tomada industrial {m.group(1)}A",
            discipline=Discipline.electrical,
            category="tomada",
        ),
    ),
    (
        r"^TOM[-_]?(2P\+?T|UNIV|NOR|NB)",
        lambda m: BlockDescription(
            description=f"Tomada {m.group(1)}",
            discipline=Discipline.electrical,
            category="tomada",
        ),
    ),
    (
        r"^CP[-_]?(\d+)$",
        lambda m: BlockDescription(
            description=f"Caixa de passagem {m.group(1)}x{m.group(1)}cm",
            discipline=Discipline.electrical,
            category="infraestrutura",
        ),
    ),
    (
        r"^CX[._-]?(\d+)[Xx](\d+)",
        lambda m: BlockDescription(
            description=f"Caixa metálica {m.group(1)}x{m.group(2)}cm",
            discipline=Discipline.electrical,
            category="infraestrutura",
        ),
    ),
    (
        r"^IC[-_]?([TSQP])$",
        lambda m: BlockDescription(
            description=f"Interruptor / derivação tipo {m.group(1)}",
            discipline=Discipline.electrical,
            category="ponto",
        ),
    ),
    (
        r"^INT[-_]?(SIMP|TRIP|PARAL)",
        lambda m: BlockDescription(
            description=f"Interruptor {m.group(1).lower()}",
            discipline=Discipline.electrical,
            category="ponto",
        ),
    ),
    (
        r"^E[-_]?(DESCE|SOBE)$",
        lambda m: BlockDescription(
            description=f"{'Descida' if m.group(1) == 'DESCE' else 'Subida'} de eletroduto",
            discipline=Discipline.electrical,
            category="infraestrutura",
        ),
    ),
    (
        r"^E[-_]?CAMP$",
        lambda m: BlockDescription(
            description="Campainha elétrica",
            discipline=Discipline.electrical,
            category="ponto",
        ),
    ),
    (
        r"^(FLUXEON|LUMICENTER|ITAIM)[-_](.+)$",
        lambda m: BlockDescription(
            description=f"Luminária {m.group(1).title()} {m.group(2).replace('-', ' ').replace('_', ' ')}",
            discipline=Discipline.electrical,
            category="luminária",
        ),
    ),
    (
        r"^CONDULETE[-_]?([TXLCE])$",
        lambda m: BlockDescription(
            description=f"Condulete tipo {m.group(1)}",
            discipline=Discipline.electrical,
            category="infraestrutura",
        ),
    ),
    (
        r"^DJ[-_]?(\d+)A$",
        lambda m: BlockDescription(
            description=f"Disjuntor {m.group(1)}A",
            discipline=Discipline.electrical,
            category="proteção",
        ),
    ),
    (
        r"^DR[-_]?(\d+)$",
        lambda m: BlockDescription(
            description=f"Disjuntor diferencial {m.group(1)}mA",
            discipline=Discipline.electrical,
            category="proteção",
        ),
    ),
    (
        r"^Grundfos[_\s](.+)$",
        lambda m: BlockDescription(
            description=f"Bomba Grundfos {m.group(1).replace('_', ' ').strip()}",
            discipline=Discipline.plumbing,
            category="bomba",
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
    "a$c1dd85769": BlockDescription(
        description="Suporte/conexão de perfilado",
        discipline=Discipline.electrical,
        category="infraestrutura",
    ),
    "a$caf777958": BlockDescription(
        description="Painel/equipamento elétrico",
        discipline=Discipline.electrical,
        category="equipamento",
    ),
    "zw$fe6e": BlockDescription(
        description="Curva de eletroduto",
        discipline=Discipline.electrical,
        category="infraestrutura",
    ),
    "trafo": BlockDescription(
        description="Transformador",
        discipline=Discipline.electrical,
        category="equipamento",
    ),
    "pgmak_sdai_chama": BlockDescription(
        description="Detector de chama",
        discipline=Discipline.fire,
        category="detecção",
    ),
    "pgmak_sdai_dg": BlockDescription(
        description="Detector de gás",
        discipline=Discipline.fire,
        category="detecção",
    ),
    "tomada forro": BlockDescription(
        description="Tomada de forro",
        discipline=Discipline.electrical,
        category="tomada",
    ),
    "tomada piso": BlockDescription(
        description="Tomada de piso",
        discipline=Discipline.electrical,
        category="tomada",
    ),
    "cobertura": BlockDescription(
        description="Cobertura de eletroduto",
        discipline=Discipline.electrical,
        category="infraestrutura",
    ),
}

LAYER_DESCRIPTIONS: dict[str, str] = {
    # Elétrica — infra
    "PGMAK-ALM-CALHA-380": "Eletrocalha 380V",
    "PGMAK-ALM-CALHA-220": "Eletrocalha 220V",
    "PGMAK-ALM-CALHA-NB": "Eletrocalha nobreak",
    "ELE-ELA-ALIM_MT-PGMAK": "Alimentador média tensão",
    "ELE-ELA-ALIM_ELETROMEDICOS": "Alimentador eletromédicos",
    "ELE-ELA-ALIM_ELETROMEDICOS-PGMAK": "Alimentador eletromédicos",
    "ELE-ELA-ALIMENTADOR_GER_PG": "Alimentador geral",
    "ELE-FIAÇÃO": "Fiação / cabeamento",
    "ELE-LEITO-NB": "Leito de cabos nobreak",
    "ELE-ELO-GER-APA_PGMAK": "Eletroduto aparente",
    "ELE-PERFILADOS": "Perfilado metálico 38x38mm",
    "-CANALETA": "Canaleta de piso",
    "SPDA-T-APARENTE": "Condutor SPDA aparente",
    "SPDA-CU-NU": "Condutor cobre nu SPDA",
    "PGMAK-IT": "Interruptor elétrico",
    "ELE-TOM-NB_PGMAK": "Tomada nobreak",
    "ELE-TOM-NOR_PGMAK": "Tomada normal",
    "ELE-ELO-GER-APA_PGMAK-PESADO": "Eletroduto aparente pesado",
    "ELE-ELA-GER_PGMAK-LIFESAFETY": "Alimentador life safety",
    "ELE-EQUIPTOS_CONDULETE_PGMAK": "Condulete",
    # SDAI — infra (metragem linear)
    "PGMAK-DAI-APARENTE_ALIMENTAÇÃO": "Eletroduto aparente (alimentação SDAI)",
    "PGMAK-DAI-EMBUTIDO_ALIMENTAÇÃO": "Eletroduto embutido (alimentação SDAI)",
    "PGMAK-DAI-PISO_ALIMENTAÇÃO": "Eletroduto piso (alimentação SDAI)",
    "PGMAK-DAI-APARENTE_LAÇO": "Eletroduto aparente (laço SDAI)",
    "PGMAK-DAI-EMBUTIDO_LAÇO": "Eletroduto embutido (laço SDAI)",
    "PGMAK-DAI-PISO_LAÇO": "Eletroduto piso (laço SDAI)",
    "PGMAK_CABOS": "Cabos SDAI",
    "ELE-ELA-ALIMENTADOR GER_PGMAK - Alim": "Alimentador geral",
    "SPDA-Cu-Nu": "Condutor cobre nu SPDA",
}

# Mapeamento layer → descrição de bloco para quando o bloco é anônimo (*U / zw$).
# Muito útil em plantas SDAI/PGMAK onde o layer indica exatamente o dispositivo.
LAYER_BLOCK_DESCRIPTIONS: dict[str, str] = {
    # SDAI — Detecção e Alarme de Incêndio
    "PGMAK-DAI-DF": "Detector de fumaça",
    "PGMAK-DAI-DF_NE": "Detector de fumaça (nível elevado)",
    "PGMAK-DAI-DF_FORRO": "Detector de fumaça (forro)",
    "PGMAK-DAI-DF_PISO": "Detector de fumaça (piso)",
    "PGMAK-DAI-DTV": "Detector termovelocimétrico",
    "PGMAK-DAI-DTV_NE": "Detector termovelocimétrico (nível elevado)",
    "PGMAK-DAI-DM": "Detector de monóxido de carbono",
    "PGMAK-DAI-DG": "Detector de gás",
    "PGMAK-DAI-CHAMA": "Detector de chama",
    "PGMAK-DAI-ASPIRAÇÃO": "Detector por aspiração",
    "PGMAK-DAI-ISO": "Módulo isolador",
    "PGMAK-DAI-CENTRAL": "Central de alarme de incêndio",
    "PGMAK-DAI-REPETIDORA": "Repetidora de alarme",
    "PGMAK-DAI-AM": "Acionador manual de alarme",
    "PGMAK-DAI-SAV": "Sinalizador audiovisual",
    "PGMAK-DAI-DOOR": "Retentor de porta (door holder)",
    "PGMAK-DAI-BD_EMISSOR": "Barreira de detecção linear (emissor)",
    "PGMAK-DAI-BD_PLACA": "Barreira de detecção linear (placa)",
    "PGMAK-DAI-MZ": "Módulo de zona",
    "PGMAK-DAI-MM": "Módulo monitor",
    "PGMAK-DAI-MC": "Módulo de controle",
    "PGMAK-DAI-MCF": "Módulo de controle (forro)",
    "PGMAK-DAI-MBO": "Módulo de bomba de incêndio",
    "PGMAK-DAI-MFD": "Módulo de fechamento de damper",
    "PGMAK-DAI-MFP": "Módulo de fechamento de porta",
    "PGMAK-DAI-CAV": "Central audiovisual",
    "PGMAK-DAI-CCA": "Central de controle de acesso",
    "PGMAK-DAI-CPA": "Central de pressurização de ar",
    "PGMAK-DAI-CEL": "Central de elevadores",
    "PGMAK-DAI-CDP": "Central de dampers",
    "PGMAK-DAI-MDG": "Módulo detector de gás",
    "PGMAK-DAI-CPE": "Central de pressurização de escadas",
    "PGMAK-DAI-CAC": "Central de ar condicionado (interface SDAI)",
    "PGMAK-DAI-CFP": "Central de fechamento de portas",
    "PGMAK-DAI-CNV": "Central de nível de ventilação",
    # Elétrica — blocos anônimos em layers descritivos
    "PGMAK-IT": "Interruptor elétrico",
    "ELE-EQUIPTOS": "Equipamento elétrico",
    "ELE-EQUIPTOS_CONDULETE_PGMAK": "Condulete",
    "ELE-TOM-NB_PGMAK": "Tomada nobreak",
    "ELE-TOM-NOR_PGMAK": "Tomada normal",
    "ELE-ELA-ALIM_ELETROMEDICOS-PGMAK": "Alimentador eletromédicos",
    "ELE-ELA-GER_PGMAK-LIFESAFETY": "Alimentador life safety",
    "ELE-ELO-GER-APA_PGMAK": "Curva/acessório de eletroduto",
    "PGMAK-ALM-CALHA-380": "Acessório de eletrocalha 380V",
    "PGMAK-ALM-CALHA-220": "Acessório de eletrocalha 220V",
    "PGMAK-ALM-CALHA-NB": "Acessório de eletrocalha nobreak",
    # Alimentadores / barramentos
    "ELE-ELA-ALIMENTADOR GER_PGMAK - Alim": "Conexão de alimentador geral",
    "ELE-ELA-ALIM_MT-PGMAK": "Conexão de alimentador MT",
    "ELE-LT-GER_PGMAK": "Iluminação geral",
    "ELE-BW-TRAFOS-PGMAK": "Barramento de transformadores",
    "ELE-PER-GER_PGMAK": "Suporte/conexão de perfilado",
    "ELE-PTO-ATE": "Ponto de aterramento",
    # HVAC / mecânica
    "AC-EQUIP": "Equipamento HVAC",
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
        ("TOM-IND-*A", "Tomada industrial", Discipline.electrical, True, "tomada"),
        ("CP*", "Caixa de passagem", Discipline.electrical, True, "infraestrutura"),
        ("IC-*", "Interruptor / derivação", Discipline.electrical, True, "ponto"),
        ("E-DESCE/SOBE", "Descida/Subida de eletroduto", Discipline.electrical, True, "infraestrutura"),
        ("E-CAMP", "Campainha elétrica", Discipline.electrical, True, "ponto"),
        ("FLUXEON-*", "Luminária Fluxeon", Discipline.electrical, True, "luminária"),
        ("CONDULETE-*", "Condulete", Discipline.electrical, True, "infraestrutura"),
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
