# DWGSCANNER — Diagnóstico do Output v0.1.0

**Análise do parsing da planta HSL_22148_EII_OPQ_ELE_LO_602_T07_12P**
**Subestação Elétrica — 12º Andar — Hospital Sírio-Libanês**
**Março 2026 | Versão 1.0**

---

## Resumo Executivo

Este documento analisa o output gerado pelo DWGScanner v0.1.0 ao processar a planta elétrica HSL_22148_EII_OPQ_ELE_LO_602_T07_12P_R00.dxf (Subestação do 12º andar, Hospital Sírio-Libanês). O objetivo é identificar os problemas críticos do parser e fornecer um roteiro claro de correções para o desenvolvedor.

### Score Geral: 3/10

O parser está funcional na estrutura básica (lê o DXF, agrupa por layer, conta INSERTs, mede linhas e exporta Excel), mas o output tem problemas graves que o tornam inutilizável para um orçamentista real:

| Problema | Severidade | Impacto |
|----------|-----------|---------|
| 84% dos blocos com nomes ilegíveis (*U, *X, zw$, A$) | **CRÍTICO** | Usuário não sabe o que está contando |
| Classificação de disciplinas incorreta | **CRÍTICO** | Totais por disciplina errados |
| Escala não detectada (1:25) | **CRÍTICO** | Todas as metragens erradas |
| Dados duplicados (block + block_total) | **ALTO** | 342 linhas, metade é lixo |
| Metragens sem sentido (TEXT entities como LINE) | **ALTO** | ELE-TEXTOS = 400m? |
| 60 pontos de aterramento ignorados (ELE-PTO-ATE) | **ALTO** | Item real sumiu do output |
| Nenhuma extração de textos técnicos | **MÉDIO** | Falta enriquecer descrições |
| Layers de arquitetura/XREF poluindo resultado | **MÉDIO** | Ruído visual para o usuário |

---

## 1. Blocos Anônimos — Problema #1

### 1.1 Diagnóstico

De 308 linhas de blocos no output, **260 (84%) têm nomes ilegíveis** como `*U182`, `*X40`, `zw$19EC`, `A$Caf777958`. Isso torna o output inutilizável para qualquer profissional. O usuário não consegue saber se `*U182` é um disjuntor, um transformador ou um perfilado.

Esses nomes são blocos anônimos gerados pelo AutoCAD/ZWCAD quando o projetista usa hatch boundaries, dynamic blocks, XREF overrides, ou certos plugins. O nome original está "escondido" na definição do bloco como nested INSERT.

### 1.2 O que o parser precisa fazer

**Resolução recursiva de blocos aninhados.** Para cada INSERT com nome `*U` ou `*X` ou `zw$` ou `A$`, o parser deve abrir a definição do bloco em `doc.blocks` e procurar INSERTs aninhados com nomes legíveis. Exemplo real desta planta:

| Bloco Anônimo | Conteúdo Interno | Descrição Resolvida |
|---------------|-----------------|---------------------|
| `*U36`, `*U175` | 9 nested INSERTs de Leito 200/300/400/500/600 C | Conjunto de leitos de cabos (200-600mm) — rack de eletrocalhas |
| `*U6` | 9 INSERTs + 30 LINEs + 14 POLYLINEs + WIPEOUT | Perfilado com acessórios (mesmo padrão de *U3) |
| `*U110`, `*U111`, `*U112`, `*U259`, `*U260` | 5 nested INSERTs: -T, -LR, -E, -C, -LL | Bloco composto de indicação de direção/rota de cabos |
| `*U161` | 22 INSERTs de *U131 + 26 LINEs | Conjunto de conexões/barramento |
| `*U258` | 73 INSERTs + 47 HATCHes + 150 LINEs + 47 CIRCLEs | Bloco complexo de equipamento (mesmo padrão de *U102) |

### 1.3 Algoritmo Sugerido

```python
def resolve_block_name(doc, block_name, depth=0, max_depth=5):
    if depth > max_depth:
        return block_name  # evita loop infinito
    if not is_anonymous(block_name):
        return block_name
    block = doc.blocks.get(block_name)
    nested_inserts = [e for e in block if e.dxftype() == 'INSERT']
    for nested in nested_inserts:
        resolved = resolve_block_name(doc, nested.dxf.name, depth + 1)
        if not is_anonymous(resolved):
            return resolved
    # fallback: descrever pela composição
    return describe_by_content(block)  # ex: '73 INSERTs + 47 HATCHes'

def is_anonymous(name):
    return (name.startswith('*U') or name.startswith('*X')
            or name.startswith('zw$') or name.startswith('A$'))
```

Quando não for possível resolver, o parser deve marcar como "Bloco não identificado" e mover para uma seção separada no output, não misturar com itens reais.

---

## 2. Classificação de Disciplinas

### 2.1 Erros Encontrados

O parser classificou 3 disciplinas (electrical, generic, hvac), mas com erros graves na lógica de mapeamento:

| Layer | Classificado | Correto | Razão |
|-------|-------------|---------|-------|
| `arq` | ❌ hvac | ✅ ignorar | Layer de ARQUITETURA (XREF base-P12). Não é disciplina elétrica. |
| `PGMAK-ALM-CALHA-380` | ❌ generic | ✅ electrical | Eletrocalha 380V — PGMAK = plugin de calhas elétricas |
| `PGMAK-ALM-CALHA-NB` | ❌ generic | ✅ electrical | Eletrocalha Nobreak — infraestrutura elétrica |
| `PGMAK-ALM-CALHA-220` | ❌ generic | ✅ electrical | Eletrocalha 220V |
| `ELE-PTO-ATE` | ❌ ausente! | ✅ electrical | Pontos de aterramento — 60 INSERTs ignorados! |
| `ELE-FIAÇÃO` | ❌ ausente! | ✅ electrical | 224 entidades de fiação ignoradas |
| `SPDA-T-APARENTE` / `SPDA-Cu-Nu` | ❌ hvac/generic | ✅ spda | SPDA = proteção contra descargas atmosféricas |
| `POT` | ❌ generic | ✅ electrical | POT = Potência / pontos de força. 43 blocos POT1! |
| `LUMINARIAS` | ❌ generic | ✅ electrical | Luminarias são disciplina elétrica |
| `0` (layer zero) | ⚠️ generic | ✅ filtrar | Blocos de detalhe genérico, muitos são XREF residual |
| `XREF-SUBESTAÇÃO-3$0$ELE-PERFILADOS` | ✅ electrical | ✅ electrical | Correto! Mas 4496 entidades = muito ruído |
| `PEOPLE-BLOCK` | ⚠️ generic | ✅ ignorar | Blocos de pessoas (escala humana). Não é material. |
| `COTAS` / `CORTE` / `nome` | ⚠️ genérico | ✅ ignorar | Layers auxiliares de desenho, não são materiais |

### 2.2 Regra de Mapeamento Corrigida

O parser deve usar um dicionário de palavras-chave por layer, com prioridade:

| Palavras-chave no nome do layer | Disciplina | Ação |
|---------------------------------|-----------|------|
| `ELE-`, `ELET`, `ELA-`, `LUMIN`, `CALHA`, `PGMAK`, `-NB`, `-380`, `-220`, `LEITO`, `FIA`, `POT`, `CHAMADA`, `TAG` | electrical | Processar |
| `ELE-PTO-ATE`, `BARRA_N`, `BARRA_T`, `-PMT` | electrical (aterramento) | Processar |
| `SPDA` | spda | Processar |
| `HIDR`, `SAN-`, `ESGOTO`, `ÁGUA` | hidraulica | Processar |
| `HVAC`, `AR-COND`, `DUTO`, `SPLIT` | hvac | Processar |
| `INCÊNDIO`, `SPRINKLER`, `HIDRANTE` | incendio | Processar |
| `arq`, `ARQ-`, `ALVENARIA`, `FORRO`, `PISO` | arquitetura | Ignorar (XREF) |
| `PEOPLE`, `COTAS`, `CORTE`, `CHAMADAS` (sem ELE), `Defpoints`, `nome`, `TAPETE`, `RETANG`, `PINTURA` | auxiliar | Ignorar |
| `0` (layer zero) | indefinido | Filtrar: só processar se tiver INSERTs com nomes elétricos |
| `XREF-*` | herdar da raiz | Se contém ELE = electrical |

---

## 3. Detecção de Escala

### 3.1 Problema

O header do DXF informa `$INSUNITS = 0` (indefinido), `$LTSCALE = 1.0`, `$DIMSCALE = 1.0`. **Todas as metragens do output estão em unidades de desenho, não em metros reais.** Porém, o Paper Space contém a informação explícita: `"ESCALA 1:25"`. Isso significa que cada unidade de desenho = 0,04 metros (1/25).

### 3.2 Impacto nos dados atuais

Exemplo: o output mostra `ELE-ELA-ALIM_MT-PGMAK = 32,93 m`. Se a escala é 1:25, o valor correto seria `32,93 × 25 = 823,25` unidades de desenho... ou 32,93 já está em unidades de desenho e deveria ser `32,93 / 25 = 1,32 m`. Sem saber a conversão aplicada, todas as metragens são não-confiáveis.

### 3.3 Solução

1. Ler `$INSUNITS` do header. Se = 4 (mm), 5 (cm), 6 (m), converter automaticamente.
2. Se `$INSUNITS = 0`, buscar texto "ESCALA" ou "SCALE" no Paper Space (MTEXT/TEXT entities).
3. Extrair o fator (1:25, 1:50, 1:100) via regex: `/(?:ESCALA|SCALE)\s*[:=]?\s*1\s*[:/-]\s*(\d+)/i`
4. Se nenhuma escala detectada, **PERGUNTAR ao usuário** antes de processar (nunca assumir).
5. Incluir a escala detectada no Metadata do output (ex: `detected_scale: '1:25'`, `scale_source: 'paper_space'`).

---

## 4. Duplicação de Dados

### 4.1 Problema

O output tem 342 linhas, divididas em 3 categorias: `block` (154), `block_total` (154) e `linear` (33). As categorias "block" e "block_total" têm as mesmas 154 descrições e quantidades — são dados duplicados. Isso dobra o tamanho do output sem adicionar informação.

### 4.2 Solução

- Remover a categoria "block_total" — ela é redundante com "block"
- Se a intenção era ter um total agrupado, criar uma lógica real de agrupamento (ex: somar todas as tomadas em uma única linha "Tomada 2P+T — 43 un")
- A aba "Resumo" já cumpre o papel de totalizar por disciplina

---

## 5. Metragens Incorretas

### 5.1 Problema

O parser está medindo o comprimento de TODAS as entidades geométricas (LINE, LWPOLYLINE) em TODOS os layers, incluindo layers que não representam infraestrutura física:

| Layer | Metragem | Problema |
|-------|---------|----------|
| `ELE-TEXTOS` | **400,94 m** | São entidades TEXT, não cabos! As "linhas" são baselines de texto. |
| `ELE-CHAMADAS` | **60,64 m** | Linhas de chamada (setas de anotação), não eletrodutos. |
| `ELE-TAG-ALI` | **76,57 m** | Tags de alimentadores (texto), não infraestrutura física. |
| `COTAS` | 8,25 m | Linhas de cota. Não são materiais. |
| `CORTE` | 37,56 m | Linhas de corte (símbolo de seção transversal). |
| `CHAMADAS` | 33,25 m | Idem ELE-CHAMADAS. |
| `PEOPLE-BLOCK` | 7,28 m | Contorno de blocos de pessoas. |

### 5.2 Layers que DEVEM ter metragem

Apenas layers de infraestrutura física devem gerar metragem:

- `ELE-FIAÇÃO` — fiação/cabos (224 entidades! não apareceu no output)
- `ELE-ELA-ALIM_MT-PGMAK` — alimentadores de média tensão
- `ELE-ELA-ALIM_ELETROMEDICOS-PGMAK` — alimentadores de eletromédicos
- `ELE-ELA-ALIMENTADOR GER_PGMAK` — alimentadores gerais
- `PGMAK-ALM-CALHA-380` / `NB` / `220` — eletrocalhas
- `SPDA-T-APARENTE` / `SPDA-Cu-Nu` — condutores SPDA
- `ELE-LEITO-NB` — leito de cabos nobreak
- `ELE-ELO-GER-APA_PGMAK` — eletroduto aparente
- `XREF-SUBESTAÇÃO-3$0$ELE-PERFILADOS` — perfilados (mas filtrar lines de XREF auxiliares)

### 5.3 Filtro sugerido

Criar uma whitelist de layers que geram metragem (infraestrutura física) e uma blacklist de layers que nunca geram metragem:

```python
LINEAR_WHITELIST_KEYWORDS = ['ALIM', 'FIA', 'CALHA', 'LEITO', 'ELO', 'PERFILADO', 'SPDA', 'CANALETA']
LINEAR_BLACKLIST_KEYWORDS = ['TEXT', 'CHAMAD', 'TAG', 'COTA', 'CORTE', 'PEOPLE', 'arq', 'nome']
```

---

## 6. Itens Reais Faltantes no Output

### 6.1 Análise comparativa DXF vs. Output

Cruzando o DXF original com o Excel gerado, vários itens importantes estão ausentes ou mal representados:

| Item no DXF | Qtd | Layer | Status no Output |
|-------------|-----|-------|-----------------|
| Ponto de aterramento (`A$C3D5E4242-flat-1`) | 60 | `ELE-PTO-ATE` | ❌ **AUSENTE** |
| POT1 (ponto de força) | 43 | `POT` | ⚠️ generic (deveria ser electrical) |
| L-2X28-IP65 (luminária 2x28W IP65) | 13 | `LUMINARIAS` | ⚠️ generic (deveria ser electrical) |
| ILEMG (iluminação de emergência) | 5 | `LUMINARIAS` | ⚠️ generic (deveria ser electrical) |
| curva-4pol-vertical (curva eletrocalha) | 20 | `PGMAK-ALM-CALHA-NB` | ⚠️ generic (deveria ser electrical) |
| JUNC-INT-T-38X38 (junção T 38x38mm) | 3 | `A-ÁTICO - Alim$...` | ✅ electrical OK |
| BARRA-TERRA (barra de terra) | 1 | `-PMT` | ⚠️ generic (deveria ser electrical) |
| Leitos de cabos (via `*U36`/`*U175`) | 12 | `PGMAK-ALM-CALHA-380` | ❌ ilegível (*U36, *U175) |
| Fiação (ISE.01a, ISE.01b, TSE.EM1, TSE.T01) | 45 txt | `ELE-FIAÇÃO` | ❌ **AUSENTE** |
| Entidades layer ELE-FIAÇÃO (linhas) | 224 | `ELE-FIAÇÃO` | ❌ **AUSENTE** |

### 6.2 O que isso significa

**Os 60 pontos de aterramento** são um item crítico para orçamento de uma subestação e simplesmente sumiram. O layer `ELE-PTO-ATE` tem 60 INSERTs de blocos idênticos (`A$C3D5E4242-flat-1`) que precisam ser contados e descritos como "Ponto de Aterramento". Provavelmente o parser ignorou o layer porque não casou com nenhum keyword de disciplina.

**As 224 entidades de fiação** (layer `ELE-FIAÇÃO`) também sumiram completamente. Lá dentro há 45 entidades TEXT com tags como ISE.01a, ISE.01b, TSE.EM1, TSE.T01 (identificadores de circuito que o orçamentista precisa).

---

## 7. Enriquecimento de Descrições

### 7.1 Problema

Mesmo os blocos com nomes legíveis não estão sendo traduzidos para descrições humanas. O orçamentista precisa ler "Transformador a Seco 1000kVA, 380V primário, 15kV secundário", não `TRF1000-380-15KV-IP21-VF`.

### 7.2 Dicionário de blocos (esta planta)

| Nome do Bloco | Descrição Humana Sugerida |
|---------------|--------------------------|
| `TRF1000-380-15KV-IP21-VF` | Transformador a seco 1000kVA, 380V/15kV, IP21, ventilação forçada |
| `TRF1500-380-15KV-IP21-VL2` | Transformador a seco 1500kVA, 380V/15kV, IP21, ventilação lateral |
| `CUB36KV-DM1A-VS` | Cubículo 36kV, disjuntor MT tipo 1A, vista superior |
| `CUB36KV-DM1A-VF` | Cubículo 36kV, disjuntor MT tipo 1A, vista frontal |
| `CUB36KV-DM1A-VL` | Cubículo 36kV, disjuntor MT tipo 1A, vista lateral |
| `CUB36KV-GAM-VS` | Cubículo 36kV, gaveta de medição, vista superior |
| `CUB36KV-GAM-VF` | Cubículo 36kV, gaveta de medição, vista frontal |
| `E-T2MC` | Quadro elétrico tipo T2MC (distribuição) |
| `E-T2MSC` | Quadro elétrico tipo T2MSC (sub-distribuição) |
| `L-2X28-IP65` | Luminária 2x28W, grau de proteção IP65 (ambientes úmidos) |
| `ILEMG` | Luminária de iluminação de emergência |
| `POT1` | Ponto de força (tomada de energia) |
| `JUNC-INT-T-38X38` | Junção interna T para perfilado 38x38mm |
| `curva-4pol-vertical` | Curva vertical para eletrocalha 4 polos |
| `BARRA-TERRA` | Barra de aterramento (barramento de terra) |
| `do` | Símbolo de direção/origem (auxiliar de desenho — **não é material**) |
| `ca_pers058` | Bloco de pessoa (escala humana — **não é material**) |
| `cleito` | Referência de projeto/autor (**não é material**) |
| `base-P12` | XREF de planta de arquitetura P12 (**não é material elétrico**) |
| `A$C3D5E4242-flat-1` | Ponto de aterramento (60 ocorrências no layer ELE-PTO-ATE) |

### 7.3 Lógica de Enriquecimento

- Criar tabela `block_mappings` no banco com: `block_pattern → description, discipline, unit, is_material`
- Usar regex para decodificar padrões: `TRF(\d+)-(\d+)-(\d+)KV → Transformador {$1}kVA, {$2}V/{$3}kV`
- Blocos marcados como `is_material=false` (do, ca_pers, cleito, base-P12) são filtrados automaticamente
- Permitir ao usuário mapear blocos não reconhecidos na UI (feature de mapeamento custom já prevista no MVP)

---

## 8. Extração de Textos Técnicos

### 8.1 O que existe no DXF e não foi extraído

O DXF contém 608 entidades TEXT/MTEXT no modelspace com informações valiosas que não aparecem no output:

- **ELE-FIAÇÃO:** 45 textos com códigos de circuito: `ISE.01a`, `ISE.01b`, `TSE.EM1`, `TSE.T01`, `relé`
- **ELE-TEXTOS:** 211 textos com especificações: `"400x100mm F.I.L. = h2"`, `"200x100mm F.I.E. = h3"`, `"TENSÃO NOMINAL PRIMÁRIA: 380/220V"`
- **ELE-CHAMADAS:** 155 textos com números de chamada (01-26) que referenciam a legenda
- **ELE-EQUIPTOS:** 27 textos com `"PESO TOTAL: 3100kg"`, `"NOBREAK 5kVA"`, `"ÁREA LIVRE PARA MANUTENÇÃO"`
- **Paper Space:** Notas gerais com especificações de cabos AFUMEX 0,6/1kV, NBR-5410, referências a diagramas unifilares, memorial descritivo e lista de cabos

### 8.2 Como usar esses textos

- Associar textos próximos a blocos: TEXT no layer ELE-TEXTOS perto de um INSERT de eletrocalha pode conter a dimensão ("400x100mm")
- Extrair códigos de circuito do layer ELE-FIAÇÃO para enriquecer a tabela de fiação
- Usar números de chamada (ELE-CHAMADAS) como referência cruzada com a legenda da planta
- Exibir notas gerais do Paper Space como metadata do projeto (normas aplicáveis, tipos de cabo, observações)

---

## 9. Melhorias na Interface (Observações do Screenshot)

Com base no screenshot da página de resultados:

- **Métricas do topo:** "1378.69 / 206.20 / 374.76" — não tem label explícita. O usuário não sabe o que significam. Adicionar: "Total Blocos | Metragem Linear (m) | Área (m²)" com unidades claras.
- **Filtro por disciplina:** Existe mas não funciona bem — "generic" não deveria existir como disciplina visível ao usuário. Substituir por disciplinas reais.
- **Coluna "Bloco":** Mostra `*U182`, `zw$19EC`... ilegível. Resolver nomes (item 1) antes de exibir.
- **Coluna "Layer":** Exibe nomes crus como `A-ÁTICO - Alim$0$ELE-PER-GER_PGMAK`. Simplificar para: "ELE-PER-GER" (remover prefixos de XREF).
- **Ordenação:** A tabela parece não ter ordenação lógica. Ordenar por: disciplina > categoria > quantidade (desc).
- **Badges de disciplina:** Seguir o design system — electrical = laranja (#FF6B35), não só texto.
- **Itens não-material:** Blocos como "do", "ca_pers058", "cleito" não deveriam aparecer. Filtrar automaticamente.

---

## 10. Roadmap de Correções — Prioridade

### Sprint 1 — Correções Críticas (1-2 semanas)

| # | Prioridade | Tarefa | Impacto |
|---|-----------|--------|---------|
| 1 | **P0** | Corrigir mapeamento de disciplinas (tabela da seção 2.2) | Output inteiro |
| 2 | **P0** | Remover duplicação block/block_total | 342 → ~188 linhas |
| 3 | **P0** | Filtrar layers auxiliares (arq, PEOPLE, COTAS, CORTE, nome, Defpoints) | -50 linhas de lixo |
| 4 | **P0** | Incluir ELE-PTO-ATE no parsing (60 aterramentos sumidos) | Item crítico recuperado |
| 5 | **P0** | Incluir ELE-FIAÇÃO no parsing (224 entidades) | Disciplina inteira faltando |
| 6 | **P1** | Whitelist/blacklist de layers para metragem (seção 5.3) | Remover metragens falsas |

### Sprint 2 — Qualidade do Output (2-3 semanas)

| # | Prioridade | Tarefa | Impacto |
|---|-----------|--------|---------|
| 7 | **P1** | Resolução recursiva de blocos anônimos (seção 1.3) | 84% dos blocos ficam legíveis |
| 8 | **P1** | Detecção de escala via Paper Space (seção 3.3) | Metragens corretas |
| 9 | **P1** | Dicionário de blocos para descrições humanas (seção 7.2) | UX profissional |
| 10 | **P2** | Limpar nomes de layer de XREF (remover prefixos $0$) | Legibilidade |
| 11 | **P2** | Extrair e associar textos técnicos aos blocos (seção 8) | Enriquecimento |
| 12 | **P2** | Filtrar blocos não-material (do, cleito, ca_pers, base-P12) | Menos ruído |

### Sprint 3 — Frontend e UX (1-2 semanas)

| # | Prioridade | Tarefa | Impacto |
|---|-----------|--------|---------|
| 13 | **P2** | Labels com unidade nas métricas do topo | Clareza |
| 14 | **P2** | Badges de disciplina coloridos (design system) | Visual profissional |
| 15 | **P2** | Ordenação padrão: disciplina > categoria > qtd desc | Usabilidade |
| 16 | **P3** | UI de mapeamento custom de blocos | Escala do produto |
| 17 | **P3** | Metadados visíveis: escala, área do projeto, versão do parser | Confiança |

---

*DWGScanner | Diagnóstico v0.1.0 | Enviar ao desenvolvedor junto com este documento*