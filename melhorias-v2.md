# DWGSCANNER — Guia de Implementação v0.4

**Objetivo:** O usuário joga o DWG/DXF e sabe quantas canaletas, tomadas, luminárias, etc. tem naquele projeto. Sem orçamento, sem preço — só a contagem de materiais, limpa e confiável.

**Estado atual (v0.3):** O parser funciona, mas das 170 linhas do output, 123 dizem "Bloco composto (6 LINE)". O instalador olha e não sabe o que é. Precisamos transformar isso num output útil.

**Output ideal:**

```
MATERIAIS IDENTIFICADOS (14 itens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ponto de aterramento              60 un
Ponto de força (tomada)           43 un
Curva vertical eletrocalha        20 un
Luminária 2x28W IP65              13 un
Leito de cabos 200mm              12 un
Quadro elétrico T2MC              10 un
Cubículo 36kV DM1A                 7 un
Luminária emergência               5 un
Cubículo 36kV gaveta medição       3 un
Junção T perfilado 38x38mm         3 un
Transformador 1000kVA              2 un
Quadro elétrico T2MSC              2 un
Transformador 1500kVA              1 un
Barra de aterramento               1 un

METRAGENS
━━━━━━━━━
SPDA aparente                    44,35 m
Canaleta de piso                 40,93 m
Eletrocalha 220V                 36,36 m
Alimentador MT                   32,93 m
Fiação / cabeamento              30,00 m
...

NÃO IDENTIFICADOS (23 blocos únicos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[preview SVG] [input para mapear]
```

---

## Mudança 1 — Filtro de blocos visuais

**Problema:** ~70 dos 123 "Bloco composto" são indicações visuais (preenchimentos, hatches, linhas de referência) que não representam material físico. Eles poluem o output e confundem o usuário.

**Onde:** `backend/app/services/dxf_parser.py` (ou `scanner_engine.py`)

**O quê:** Adicionar função `is_likely_material()` que analisa a composição do bloco e decide se deve ir pro output ou não. Chamar antes de incluir qualquer bloco anônimo no resultado.

```python
from collections import Counter

def is_likely_material(block_def, min_entities=3):
    """
    Retorna False se o bloco parece ser indicação visual, não material real.
    Blocos com geometria muito simples (1-2 linhas, só hatch) são visuais.
    Blocos com geometria complexa (círculos, arcos, muitas entidades) são material.
    """
    entities = list(block_def)
    total = len(entities)
    types = Counter(e.dxftype() for e in entities)
    
    # Tipos que indicam "é só visual"
    simple_types = {'LINE', 'LWPOLYLINE', 'HATCH', 'SOLID', 'WIPEOUT'}
    
    # Tipos que indicam "provavelmente é material real"
    complex_types = {'CIRCLE', 'ARC', 'ELLIPSE', 'TEXT', 'MTEXT', 'INSERT'}
    
    # Regra 1: Se tem tipo complexo, provavelmente é material
    if any(t in types for t in complex_types):
        # Exceto se for só 1 INSERT aninhado (pode ser wrapper)
        if types.get('INSERT', 0) >= 1 and total <= 2:
            return True  # INSERT aninhado = resolver recursivamente
        return True
    
    # Regra 2: Só hatch + polyline = preenchimento visual
    if set(types.keys()) <= {'LWPOLYLINE', 'HATCH'}:
        return False
    
    # Regra 3: 1-2 entidades simples = visual
    if total <= 2 and set(types.keys()) <= simple_types:
        return False
    
    # Regra 4: Muita geometria = provavelmente material
    if total >= 10:
        return True
    
    # Regra 5: Entre 3-9 entidades simples = zona cinza, incluir por segurança
    return total >= min_entities
```

**Como usar no parser:**

```python
# No loop que processa blocos, ANTES de adicionar ao resultado:
for entity in modelspace:
    if entity.dxftype() == 'INSERT':
        block_name = entity.dxf.name
        block_def = doc.blocks.get(block_name)
        
        # Se é bloco anônimo, checar se é material
        if is_anonymous(block_name):
            if not is_likely_material(block_def):
                continue  # Pula — não vai pro output
        
        # ... resto do processamento normal
```

**Resultado esperado:** De ~170 linhas para ~80-90 linhas. Os "Bloco composto (1 LINE)", "Bloco composto (1 LWPOLYLINE, 1 HATCH)" somem.

**Esforço:** ~2 horas

---

## Mudança 2 — Expandir dicionário de blocos + nomes de layers

**Problema:** Blocos frequentes como `A$C3D5E4242-FLAT-1` (60 ocorrências!) ainda aparecem como "Bloco composto". Itens lineares dizem "Metragem PGMAK-ALM-CALHA-380" em vez de "Eletrocalha 380V".

**Onde:** `backend/app/utils/block_dictionary.py`

### 2.1 — Adicionar blocos ao dicionário

Adicionar os blocos identificados na planta de referência HSL (subestação 12º andar). Esses são os que mais aparecem:

```python
# Adicionar ao BLOCK_DICTIONARY existente:

# === BLOCOS QUE SÃO MATERIAL ===

"A$C3D5E4242-flat-1": {
    "description": "Ponto de aterramento",
    "discipline": "electrical",
    "unit": "un",
    "is_material": True,
    "category": "aterramento"
},

"A$C1DD85769": {
    "description": "Suporte/conexão de perfilado",
    "discipline": "electrical",
    "unit": "un",
    "is_material": True,
    "category": "infraestrutura"
},

"A$Caf777958": {
    "description": "Painel/equipamento elétrico",
    "discipline": "electrical",
    "unit": "un",
    "is_material": True,
    "category": "equipamento"
},

# === BLOCOS QUE NÃO SÃO MATERIAL ===

"do": {
    "description": "Símbolo de direção/origem",
    "is_material": False
},

"cleito": {
    "description": "Referência de projeto/autor",
    "is_material": False
},

"ca_pers058": {
    "description": "Bloco de pessoa (escala humana)",
    "is_material": False
},

"base-P12": {
    "description": "XREF de planta arquitetônica",
    "is_material": False
},
```

### 2.2 — Criar dicionário de nomes de layers para metragem

Novo arquivo ou nova constante em `block_dictionary.py`:

```python
LAYER_DESCRIPTIONS = {
    # Eletrocalhas
    "PGMAK-ALM-CALHA-380": "Eletrocalha 380V",
    "PGMAK-ALM-CALHA-220": "Eletrocalha 220V",
    "PGMAK-ALM-CALHA-NB": "Eletrocalha nobreak",
    
    # Alimentadores
    "ELE-ELA-ALIM_MT-PGMAK": "Alimentador média tensão",
    "ELE-ELA-ALIM_ELETROMEDICOS": "Alimentador eletromédicos",
    "ELE-ELA-ALIMENTADOR_GER_PG": "Alimentador geral",
    
    # Infraestrutura
    "ELE-FIAÇÃO": "Fiação / cabeamento",
    "ELE-LEITO-NB": "Leito de cabos nobreak",
    "ELE-ELO-GER-APA_PGMAK": "Eletroduto aparente",
    "ELE-PERFILADOS": "Perfilado metálico 38x38mm",
    "-CANALETA": "Canaleta de piso",
    
    # SPDA
    "SPDA-T-APARENTE": "Condutor SPDA aparente",
    "SPDA-CU-NU": "Condutor cobre nu SPDA",
}
```

### 2.3 — Usar nas descrições de itens lineares

No parser, ao gerar itens lineares, trocar:

```python
# ANTES (v0.3):
description = f"Metragem {layer_name}"

# DEPOIS:
from app.utils.block_dictionary import LAYER_DESCRIPTIONS
description = LAYER_DESCRIPTIONS.get(layer_name, f"Metragem {layer_name}")
```

### 2.4 — Consolidar vistas do mesmo equipamento

Blocos com sufixos `-VS` (vista superior), `-VF` (vista frontal), `-VL` (vista lateral) são o mesmo equipamento. O parser deve consolidar:

```python
VIEW_SUFFIXES = ['-VS', '-VF', '-VL', '-VL2', '-VP', '-VC']

def get_material_key(block_name):
    """Remove sufixo de vista para agrupar como mesmo material"""
    upper = block_name.upper()
    for suffix in VIEW_SUFFIXES:
        if upper.endswith(suffix):
            return block_name[:-len(suffix)]
    return block_name

# Ao consolidar resultados:
# CUB36KV-DM1A-VS (4) + CUB36KV-DM1A-VF (2) + CUB36KV-DM1A-VL (1)
# → "Cubículo 36kV, disjuntor MT tipo 1A — 7 un"
```

**Onde aplicar:** Na etapa final do parser, depois de contar tudo e antes de gerar o output. Agrupar blocos que têm o mesmo `material_key`.

**Resultado esperado:** Itens lineares ficam legíveis. Blocos mais frequentes ganham nome. Cubículos consolidados de 3 linhas para 1.

**Esforço:** ~3 horas

---

## Mudança 3 — Frontend: Tela dividida + mapeamento rápido

**Problema:** Mesmo com filtro + dicionário, sempre vão existir blocos que o parser não conhece. Cada escritório de projeto usa blocos customizados. A solução definitiva é permitir que o usuário mapeie os blocos desconhecidos na hora.

**Onde:** `frontend/app/dashboard/results/[id]/page.tsx` (ou componente equivalente)

### 3.1 — Dividir a tela em 3 seções

```
┌──────────────────────────────────────────────────────┐
│  📊 RESUMO                                           │
│  Materiais: 14 itens  |  Metragem: 11 itens          │
│  Não identificados: 23 blocos (mapeie para incluir)  │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ✅ MATERIAIS IDENTIFICADOS                          │
│  ┌─────────────────────────┬─────┬──────┐            │
│  │ Descrição               │ Qtd │ Un   │            │
│  ├─────────────────────────┼─────┼──────┤            │
│  │ Ponto de aterramento    │  60 │ un   │            │
│  │ Ponto de força (tomada) │  43 │ un   │            │
│  │ Curva vert. eletrocalha │  20 │ un   │            │
│  │ ...                     │     │      │            │
│  └─────────────────────────┴─────┴──────┘            │
│                                                       │
│  📏 METRAGENS                                        │
│  ┌─────────────────────────┬───────┬─────┐           │
│  │ Descrição               │ Valor │ Un  │           │
│  ├─────────────────────────┼───────┼─────┤           │
│  │ SPDA aparente           │ 44,35 │ m   │           │
│  │ Canaleta de piso        │ 40,93 │ m   │           │
│  │ ...                     │       │     │           │
│  └─────────────────────────┴───────┴─────┘           │
│                                                       │
│  ⚠️ NÃO IDENTIFICADOS (23 blocos)                    │
│  Ordernados por quantidade — mapeie os maiores        │
│                                                       │
│  ┌──────┬──────────────────┬────┬───────────────────┐│
│  │[SVG] │ A$C3D5E... (×60) │ELE │[_______________][✓]│
│  │[SVG] │ A$CAF77... (×8)  │ELE │[_______________][✓]│
│  │[SVG] │ *U37      (×8)   │CAL │[_______________][✓]│
│  ├──────┴──────────────────┴────┴───────────────────┤│
│  │ ▶ + 20 blocos menores (1-2 un cada)              ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  [Exportar Excel]  [Exportar PDF]                     │
└──────────────────────────────────────────────────────┘
```

### 3.2 — Lógica de separação (no frontend)

O backend já retorna todos os itens com `categoria` e `descrição`. O frontend separa:

```typescript
interface TakeoffItem {
  discipline: string;
  category: 'block' | 'linear';
  description: string;
  unit: string;
  quantity: number;
  layer: string;
  block_name: string;
}

function categorizeItems(items: TakeoffItem[]) {
  const identified: TakeoffItem[] = [];
  const linear: TakeoffItem[] = [];
  const unidentified: TakeoffItem[] = [];

  for (const item of items) {
    if (item.category === 'linear') {
      linear.push(item);
    } else if (
      item.description.startsWith('Bloco composto') ||
      item.description === item.block_name ||     // nome cru = não mapeado
      item.description.startsWith('*U') ||
      item.description.startsWith('zw$') ||
      item.description.startsWith('A$')
    ) {
      unidentified.push(item);
    } else {
      identified.push(item);
    }
  }

  // Ordenar: identificados por quantidade desc, não-identificados por quantidade desc
  identified.sort((a, b) => b.quantity - a.quantity);
  unidentified.sort((a, b) => b.quantity - a.quantity);
  linear.sort((a, b) => b.quantity - a.quantity);

  return { identified, linear, unidentified };
}
```

### 3.3 — Input de mapeamento rápido

Para cada bloco não identificado, um input inline com save:

```typescript
function UnmappedBlockRow({ item, projectId, onMapped }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    
    await fetch('/api/block-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        block_name_pattern: item.block_name,
        description: name.trim(),
        discipline: item.discipline,
        unit: 'un',
        is_material: true,
      }),
    });
    
    onMapped(item.block_name, name.trim());
    setSaving(false);
  };

  return (
    <tr>
      <td>
        {/* Preview SVG do bloco (ver Mudança 4) */}
        <img 
          src={`/api/blocks/${projectId}/${encodeURIComponent(item.block_name)}/preview`} 
          width={60} height={60} 
          className="rounded bg-blueprint-900"
        />
      </td>
      <td>
        <span className="font-mono text-xs text-gray-500">{item.block_name}</span>
        <span className="ml-2 font-bold">{item.quantity} un</span>
        <span className="ml-2 text-xs text-gray-400">[{item.layer}]</span>
      </td>
      <td>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ex: Tomada 2P+T 20A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="border rounded-lg px-3 py-1.5 text-sm w-64"
          />
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-electric text-blueprint-900 px-3 py-1.5 rounded-lg text-sm font-semibold"
          >
            {saving ? '...' : '✓'}
          </button>
        </div>
      </td>
    </tr>
  );
}
```

### 3.4 — Reprocessar após mapeamento

Quando o usuário mapeia um bloco, o frontend pode:

**Opção A (simples):** Mover o item da seção "não identificados" para "identificados" no estado local, sem reprocessar o backend. Isso é instantâneo e funciona para a sessão atual.

**Opção B (ideal):** Chamar `POST /api/projects/{id}/process` novamente para reprocessar com o novo mapeamento. Os mapeamentos salvos via `block-mappings` são consultados pelo parser na próxima execução. Isso atualiza o Excel e tudo fica consistente.

Recomendo implementar A primeiro (UX instantânea) e B como refresh manual ("Reprocessar com novos mapeamentos").

**Esforço:** 2-3 dias

---

## Mudança 4 — Preview SVG dos blocos

**Problema:** Quando o usuário vê "A$C3D5E4242-FLAT-1 — 60 un", ele não faz ideia do que é. Se ele vir uma miniatura do símbolo (um quadrado com um X dentro, por exemplo), identifica em 2 segundos: "ah, é o ponto de aterramento".

**Onde:** Novo endpoint no backend + renderização no frontend

### 4.1 — Endpoint no backend

Criar em `backend/app/routers/blocks.py`:

```python
from fastapi import APIRouter, Response, HTTPException
from collections import Counter
import math

router = APIRouter(prefix="/api/blocks", tags=["blocks"])

@router.get("/{project_id}/{block_name}/preview")
async def block_preview(project_id: int, block_name: str):
    """Gera SVG miniatura de um bloco para o usuário identificar visualmente"""
    
    # Carregar o DXF do projeto
    doc = load_project_dxf(project_id)  # implementar conforme storage
    
    try:
        block_def = doc.blocks.get(block_name)
    except Exception:
        raise HTTPException(404, "Bloco não encontrado")
    
    svg = render_block_to_svg(block_def)
    return Response(content=svg, media_type="image/svg+xml")


def render_block_to_svg(block_def, width=120, height=120, padding=10):
    """Renderiza entidades geométricas do bloco em SVG"""
    entities = list(block_def)
    if not entities:
        return empty_svg(width, height)
    
    # Coletar todos os pontos para bounding box
    points = []
    svg_elements = []
    
    for e in entities:
        etype = e.dxftype()
        
        if etype == 'LINE':
            s, end = e.dxf.start, e.dxf.end
            points.extend([s, end])
            svg_elements.append(('line', s, end))
            
        elif etype == 'CIRCLE':
            c = e.dxf.center
            r = e.dxf.radius
            points.extend([
                (c[0] - r, c[1] - r, 0),
                (c[0] + r, c[1] + r, 0)
            ])
            svg_elements.append(('circle', c, r))
            
        elif etype == 'ARC':
            c = e.dxf.center
            r = e.dxf.radius
            points.extend([
                (c[0] - r, c[1] - r, 0),
                (c[0] + r, c[1] + r, 0)
            ])
            start_angle = math.radians(e.dxf.start_angle)
            end_angle = math.radians(e.dxf.end_angle)
            svg_elements.append(('arc', c, r, start_angle, end_angle))
            
        elif etype == 'LWPOLYLINE':
            pts = [(p[0], p[1], 0) for p in e.get_points()]
            points.extend(pts)
            svg_elements.append(('polyline', pts, e.closed))
    
    if not points:
        return empty_svg(width, height)
    
    # Bounding box
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    
    dx = max_x - min_x or 1
    dy = max_y - min_y or 1
    usable = min(width, height) - 2 * padding
    scale = usable / max(dx, dy)
    
    def tx(x):
        return (x - min_x) * scale + padding
    def ty(y):
        return height - ((y - min_y) * scale + padding)  # flip Y
    
    # Gerar SVG
    stroke = "#00D4AA"
    parts = []
    parts.append(f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">')
    parts.append(f'<rect width="100%" height="100%" fill="#0F2B3C" rx="8"/>')
    
    for elem in svg_elements:
        if elem[0] == 'line':
            _, s, end = elem
            parts.append(
                f'<line x1="{tx(s[0]):.1f}" y1="{ty(s[1]):.1f}" '
                f'x2="{tx(end[0]):.1f}" y2="{ty(end[1]):.1f}" '
                f'stroke="{stroke}" stroke-width="1.5" stroke-linecap="round"/>'
            )
        elif elem[0] == 'circle':
            _, c, r = elem
            parts.append(
                f'<circle cx="{tx(c[0]):.1f}" cy="{ty(c[1]):.1f}" '
                f'r="{r * scale:.1f}" '
                f'stroke="{stroke}" fill="none" stroke-width="1.5"/>'
            )
        elif elem[0] == 'arc':
            _, c, r, sa, ea = elem
            sx = tx(c[0] + r * math.cos(sa))
            sy = ty(c[1] + r * math.sin(sa))
            ex = tx(c[0] + r * math.cos(ea))
            ey = ty(c[1] + r * math.sin(ea))
            sr = r * scale
            large = 1 if (ea - sa) % (2 * math.pi) > math.pi else 0
            parts.append(
                f'<path d="M {sx:.1f} {sy:.1f} A {sr:.1f} {sr:.1f} 0 {large} 0 '
                f'{ex:.1f} {ey:.1f}" stroke="{stroke}" fill="none" stroke-width="1.5"/>'
            )
        elif elem[0] == 'polyline':
            _, pts, closed = elem
            coords = ' '.join(f'{tx(p[0]):.1f},{ty(p[1]):.1f}' for p in pts)
            tag = 'polygon' if closed else 'polyline'
            parts.append(
                f'<{tag} points="{coords}" '
                f'stroke="{stroke}" fill="none" stroke-width="1.5" stroke-linejoin="round"/>'
            )
    
    parts.append('</svg>')
    return '\n'.join(parts)


def empty_svg(w, h):
    return (
        f'<svg width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg">'
        f'<rect width="100%" height="100%" fill="#0F2B3C" rx="8"/>'
        f'<text x="50%" y="50%" text-anchor="middle" fill="#64748B" '
        f'font-size="11" font-family="Arial">sem preview</text></svg>'
    )
```

### 4.2 — Registrar o router

Em `backend/app/main.py`:

```python
from app.routers.blocks import router as blocks_router
app.include_router(blocks_router)
```

### 4.3 — Usar no frontend

```tsx
<img
  src={`${API_URL}/api/blocks/${projectId}/${encodeURIComponent(blockName)}/preview`}
  width={60}
  height={60}
  className="rounded border border-grid"
  alt={`Preview do bloco ${blockName}`}
  loading="lazy"
/>
```

**Esforço:** 1 dia

---

## Mudança 5 — Mover `-CANALETA` para electrical

**Problema:** Único item genérico restante. Canaleta é infraestrutura elétrica.

**Onde:** `backend/app/utils/discipline_mapping.py` (ou onde estão as keywords de classificação)

**O quê:** Adicionar `-CANALETA` e `CANALETA` à lista de keywords da disciplina `electrical`.

```python
# Na lista de keywords de electrical, adicionar:
"CANALETA"
```

**Esforço:** 5 minutos

---

## Mudança 6 — Aplicar scale_factor nas metragens

**Problema:** O metadata mostra `scale_detected: "1:25"` e `scale_factor: 1`. Isso indica que a escala foi detectada mas possivelmente não aplicada. As metragens podem estar em unidades de desenho, não em metros.

**Onde:** `backend/app/services/dxf_parser.py`

**O quê:** Verificar se o scale_factor está sendo multiplicado/dividido nas metragens lineares. A lógica correta depende de como o DXF foi desenhado:

```python
# Se o DXF foi desenhado em centímetros (comum em escala 1:25):
# 1 unidade DXF = 1 cm → dividir por 100 para ter metros
# Fator da escala 1:25 significa que o desenho está reduzido 25x

# Verificação: medir uma cota conhecida no DXF e comparar com o valor exibido
# Ex: se uma parede de 3m aparece como 300 unidades → DXF em cm
# Ex: se uma parede de 3m aparece como 3 unidades → DXF em m
# Ex: se uma parede de 3m aparece como 12 unidades → DXF em escala (3m / 25 = 0.12m = 12cm)

# A forma mais segura é ler $INSUNITS:
# 0 = indefinido (precisa de input do usuário ou inferência)
# 1 = polegadas
# 4 = milímetros → metragem_m = metragem_dxf / 1000
# 5 = centímetros → metragem_m = metragem_dxf / 100
# 6 = metros → metragem_m = metragem_dxf (sem conversão)
```

**Teste prático:** Abrir o DXF no AutoCAD/ZWCAD, medir manualmente uma eletrocalha ou eletroduto cuja dimensão real seja conhecida, e comparar com o valor que o parser retorna. Isso revela se precisa de conversão e qual fator usar.

**Esforço:** 2-3 horas (incluindo teste manual)

---

## Ordem de execução

```
Semana 1 (backend)
├── Mudança 5: CANALETA → electrical (5 min)
├── Mudança 2: Expandir dicionário + LAYER_DESCRIPTIONS (3h)
├── Mudança 1: Filtro is_likely_material() (2h)
├── Mudança 6: Verificar/aplicar scale_factor (3h)
└── Mudança 4: Endpoint SVG preview (1 dia)

Semana 2 (frontend)
├── Mudança 3: Tela dividida em 3 seções (1 dia)
├── Mudança 3: Input de mapeamento inline (1 dia)
└── Mudança 3: Integrar SVG preview nos não-identificados (0.5 dia)

Semana 3 (polimento)
├── Testar com 2-3 plantas DXF diferentes
├── Ajustar heurística is_likely_material() conforme resultados
├── Expandir dicionário com blocos novos encontrados
└── Consolidação de vistas (-VS/-VF/-VL)
```

---

## Teste de validação

Depois de implementar tudo, rodar a mesma planta HSL (subestação 12º andar) e validar:

| Critério | Valor esperado |
|----------|---------------|
| Linhas "Bloco composto" no output | < 25 (hoje são 123) |
| Itens com descrição legível | > 20 (hoje são 17) |
| Itens lineares com nome real | 11/11 (hoje 0/11) |
| Disciplina "generic" | 0 linhas (hoje 1) |
| Blocos visuais no output | 0 (hoje ~70) |
| Seção "não identificados" no frontend | Funcional com preview + input |
| Um mapeamento salvo reaparece na próxima execução | Sim |

---

*DWGScanner | Guia de Implementação v0.4 | Março 2026*