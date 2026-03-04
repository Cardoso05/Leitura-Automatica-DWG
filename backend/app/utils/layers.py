from app.models.project import Discipline

DISCIPLINE_KEYWORDS = {
    Discipline.electrical: [
        "ele-", "elet", "ela-", "lumin", "calha", "pgmak", "-nb", "-380", "-220",
        "leito", "fia", "pot", "chamada", "tag", "barra_n", "barra_t", "-pmt",
        "pto-ate", "lighting", "luz", "tomada", "perfilado", "alimentador",
    ],
    Discipline.spda: ["spda"],
    Discipline.plumbing: ["hid", "água", "san-", "esgoto", "pipe", "ppr", "hidr"],
    Discipline.networking: ["net", "dados", "cftv", "logic", "lan"],
    Discipline.fire: ["incend", "sprink", "hidrante"],
    Discipline.hvac: ["hvac", "ar-cond", "duto", "split", "clima"],
    Discipline.architecture: [
        "arq", "alvenaria", "forro", "piso", "arquitetura",
    ],
    Discipline.auxiliary: [
        "people", "cotas", "corte", "defpoints", "tapete", "retang", 
        "pintura", "cleito", "nome",
    ],
}

IGNORE_LAYERS = {
    "0", "defpoints", "people-block", "cotas", "corte", "nome",
}

LINEAR_WHITELIST_KEYWORDS = [
    "alim", "fia", "calha", "leito", "elo", "perfilado", "spda", "canaleta",
    "-mt-", "-nb", "-380", "-220", "alimentador",
]

LINEAR_BLACKLIST_KEYWORDS = [
    "text", "chamad", "tag", "cota", "corte", "people", "arq", "nome",
    "equipto", "simbologia",
]

NON_MATERIAL_BLOCKS = [
    "do", "ca_pers", "cleito", "base-p", "people", "person", "escala",
    "norte", "carimbo", "selo", "legenda", "revisao", "titulo",
]


def guess_discipline(layer_name: str) -> Discipline | None:
    """Determina a disciplina de um layer com base em palavras-chave."""
    lname = layer_name.lower()
    
    cleaned = clean_layer_name(layer_name)
    lname_cleaned = cleaned.lower()
    
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
