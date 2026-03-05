from collections import Counter

from app.models.project import Discipline

# Padrões prioritários: verificados ANTES dos keywords genéricos.
# Evita que "pgmak" capture layers de incêndio (PGMAK-DAI-*).
PRIORITY_RULES: list[tuple[list[str], Discipline]] = [
    (["-dai-", "pgmak-dai", "sdai", "_sdai_"], Discipline.fire),
    (["schneider", "_ect_"], Discipline.auxiliary),
]

DISCIPLINE_KEYWORDS = {
    Discipline.electrical: [
        "ele-", "elet", "ela-", "lumin", "calha", "pgmak", "-nb", "-380", "-220",
        "leito", "fia", "pot", "barra_n", "barra_t", "-pmt",
        "pto-ate", "lighting", "luz", "tomada", "perfilado", "alimentador", "canaleta",
        "tom", "pgmak-it", "int_pgmak", "condulete", "camp",
    ],
    Discipline.spda: ["spda"],
    Discipline.plumbing: ["hid", "água", "san-", "esgoto", "pipe", "ppr", "hidr"],
    Discipline.networking: ["net", "dados", "cftv", "logic", "lan"],
    Discipline.fire: ["incend", "sprink", "hidrante", "dai-", "sdai"],
    Discipline.hvac: ["hvac", "ar-cond", "duto", "split", "clima", "ac-equip"],
    Discipline.architecture: [
        "arq", "alvenaria", "forro", "piso", "arquitetura",
    ],
    Discipline.auxiliary: [
        "people", "cotas", "corte", "defpoints", "tapete", "retang",
        "pintura", "cleito", "nome", "schneider", "_ect_",
    ],
}

IGNORE_LAYERS = {
    "0", "defpoints", "people-block", "cotas", "corte", "nome",
}

IGNORE_LAYER_PATTERNS = [
    "ele-tag",
    "chamada",
    "-revisão",
    "-revisao",
    "schneider",
    "_ect_",
]

LINEAR_WHITELIST_KEYWORDS = [
    "alim", "fia", "calha", "leito", "elo", "perfilado", "spda", "canaleta",
    "-mt-", "-nb", "-380", "-220", "alimentador",
    "dai-aparente", "dai-embutido", "dai-piso",
]

LINEAR_BLACKLIST_KEYWORDS = [
    "text", "chamad", "tag", "cota", "corte", "people", "arq", "nome",
    "equipto", "simbologia", "tom", "lumin", "camp",
]

NON_MATERIAL_BLOCKS = [
    "do", "ca_pers", "cleito", "base-p", "people", "person", "escala",
    "norte", "carimbo", "selo", "legenda", "revisao", "titulo", "tag-ali",
    "tag_sub", "solidnode", "setael", "setase", "ecad1_box",
    "seta", "kirk", "sectu", "xtu",
]


def guess_discipline(layer_name: str) -> Discipline | None:
    """Determina a disciplina de um layer com base em palavras-chave."""
    lname = layer_name.lower()

    cleaned = clean_layer_name(layer_name)
    lname_cleaned = cleaned.lower()

    for patterns, discipline in PRIORITY_RULES:
        if any(p in lname or p in lname_cleaned for p in patterns):
            return discipline

    for discipline, patterns in DISCIPLINE_KEYWORDS.items():
        if any(pattern in lname or pattern in lname_cleaned for pattern in patterns):
            return discipline
    return None


def should_ignore_layer(layer_name: str) -> bool:
    """Verifica se o layer deve ser completamente ignorado."""
    lname = layer_name.lower()
    cleaned = clean_layer_name(layer_name).lower()
    
    if lname in IGNORE_LAYERS or cleaned in IGNORE_LAYERS:
        return True
    
    for pattern in IGNORE_LAYER_PATTERNS:
        if pattern in lname or pattern in cleaned:
            return True
    
    for keyword in DISCIPLINE_KEYWORDS.get(Discipline.auxiliary, []):
        if keyword in lname or keyword in cleaned:
            if not any(ele_kw in lname for ele_kw in ["ele-", "elet"]):
                return True
    
    return False


def should_measure_linear(layer_name: str) -> bool:
    """Verifica se o layer deve ter metragem linear calculada."""
    lname = layer_name.lower()
    cleaned = clean_layer_name(layer_name).lower()
    
    for blackword in LINEAR_BLACKLIST_KEYWORDS:
        if blackword in lname or blackword in cleaned:
            return False
    
    for whitework in LINEAR_WHITELIST_KEYWORDS:
        if whitework in lname or whitework in cleaned:
            return True
    
    return False


def is_non_material_block(block_name: str) -> bool:
    """Verifica se um bloco é não-material (auxiliar de desenho)."""
    if not block_name:
        return False
    lname = block_name.lower()
    return any(pattern in lname for pattern in NON_MATERIAL_BLOCKS)


def clean_layer_name(layer_name: str) -> str:
    """Remove prefixos de XREF do nome do layer (ex: XREF-NOME$0$LAYER -> LAYER)."""
    if "$0$" in layer_name:
        parts = layer_name.split("$0$")
        return parts[-1]
    if layer_name.startswith("XREF-"):
        layer_name = layer_name[5:]
    return layer_name


def is_likely_material(block_def, min_entities: int = 3) -> bool:
    """
    Retorna False se o bloco parece ser indicação visual, não material real.
    Blocos com geometria muito simples (1-2 linhas, só hatch) são visuais.
    Blocos com geometria complexa (círculos, arcos, muitas entidades) são material.
    """
    entities = list(block_def)
    total = len(entities)
    types = Counter(e.dxftype() for e in entities)

    simple_types = {"LINE", "LWPOLYLINE", "HATCH", "SOLID", "WIPEOUT"}
    complex_types = {"CIRCLE", "ARC", "ELLIPSE", "TEXT", "MTEXT", "INSERT"}

    if any(t in types for t in complex_types):
        if types.get("INSERT", 0) >= 1 and total <= 2:
            return True
        return True

    if set(types.keys()) <= {"LWPOLYLINE", "HATCH"}:
        return False

    if total <= 2 and set(types.keys()) <= simple_types:
        return False

    if total >= 10:
        return True

    return total >= min_entities


def is_anonymous_block(block_name: str) -> bool:
    """Verifica se o nome do bloco é anônimo (*U, *X, zw$, A$)."""
    if not block_name:
        return False
    return (
        block_name.startswith("*U")
        or block_name.startswith("*X")
        or block_name.startswith("zw$")
        or block_name.startswith("A$")
    )
