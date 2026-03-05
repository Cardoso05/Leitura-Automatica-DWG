# TAKEOFF.AI

SaaS de levantamento automático de materiais a partir de plantas DWG/DXF. Processa arquivos elétricos, hidráulicos, SPDA, HVAC e outros, gera quantitativos por disciplina e exporta para Excel.

## Arquitetura

```
takeoff-ai/
├── frontend/          # Next.js 16 (App Router) + Tailwind + shadcn/ui
├── backend/           # FastAPI + SQLModel + PostgreSQL + Redis
├── docker-compose.yml
├── README.md
└── .env.example
```

- **Frontend**: Next.js 16 (App Router), TypeScript, TailwindCSS. Fluxo completo: landing → dashboard → upload wizard → seleção de layers → visualização de resultados → exportação Excel → mapeamento de blocos.
- **Backend**: FastAPI, SQLModel, PostgreSQL, Redis, ezdxf para parsing, integração ASAAS para planos Free/Pro/Business/pay-per-use.
- **Processamento**: Upload → conversão DWG→DXF (ODA) → parser v0.4 → filtro visual → mapeamento de disciplinas → consolidação de vistas → exportação Excel.

## Capacidades do Parser (v0.4)

### Resolução de blocos anônimos
Blocos com nomes ilegíveis gerados pelo AutoCAD/ZWCAD (`*U`, `*X`, `zw$`, `A$`) são resolvidos recursivamente via inspeção dos blocos aninhados, recuperando o nome legível original. Quando não é possível resolver, o bloco é descrito pela sua composição (`Bloco composto (73 INSERTs + 47 HATCHes)`).

### Filtro de blocos visuais (`is_likely_material`)
Antes de incluir qualquer bloco anônimo no quantitativo, o parser avalia se ele representa material físico real ou apenas indicação visual (hatch, preenchimento, linhas de referência). Blocos com geometria simples (1–2 entidades, só `LWPOLYLINE + HATCH`) são descartados automaticamente.

### Dicionário de blocos e layers
`backend/app/utils/block_dictionary.py` mapeia:
- **Nomes de blocos** → descrição humana, disciplina, unidade, `is_material` (fixos e regex)
- **Nomes de layers lineares** → descrição legível via `LAYER_DESCRIPTIONS` (ex.: `PGMAK-ALM-CALHA-380` → `Eletrocalha 380V`)
- **Padrões regex** para transformadores, cubículos, luminárias, quadros elétricos e outros equipamentos com nomenclatura codificada
- Blocos não-materiais (pessoas, selos, XREFs de arquitetura, direções) são automaticamente filtrados

### Consolidação de vistas
Blocos com sufixos de vista (`-VS`, `-VF`, `-VL`, `-VL2`, `-VP`, `-VC`) são agrupados como um único material. Ex.: `CUB36KV-DM1A-VS (4) + CUB36KV-DM1A-VF (2) + CUB36KV-DM1A-VL (1)` → `Cubículo 36kV, disjuntor MT tipo 1A — 7 un`.

### Detecção de escala
1. Lê `$INSUNITS` do header do DXF (mm → fator 0.001, cm → 0.01, m → 1.0, polegadas → 0.0254).
2. Se indefinido, varre o Paper Space por textos com padrão `ESCALA 1:25` ou `SCALE 1:50` via regex.
3. Assume mm como padrão para projetos brasileiros (AutoCAD/ZWCAD) quando não há informação.
4. Reporta `scale_detected`, `scale_factor` e `scale_source` no metadata do resultado.

### Classificação de disciplinas
Keywords expandidas por disciplina com suporte a prefixos de XREF (`XREF-*$0$LAYER`):

| Disciplina | Exemplos de keywords |
|---|---|
| electrical | `ELE-`, `ELET`, `LUMIN`, `CALHA`, `PGMAK`, `LEITO`, `FIA`, `POT`, `CANALETA` |
| spda | `SPDA` |
| plumbing | `HID`, `ÁGUA`, `SAN-`, `ESGOTO`, `PPR` |
| networking | `NET`, `DADOS`, `CFTV`, `LAN` |
| fire | `INCEND`, `SPRINK`, `HIDRANTE` |
| hvac | `HVAC`, `AR-COND`, `DUTO`, `SPLIT` |
| architecture | `ARQ`, `ALVENARIA`, `FORRO`, `PISO` → **ignorado** |
| auxiliary | `PEOPLE`, `COTAS`, `CORTE`, `DEFPOINTS` → **ignorado** |

### Metragem linear seletiva
Whitelist/blacklist de keywords por layer garante que apenas infraestrutura física gera metragem (fiação, eletrocalha, leitos, SPDA). Layers de texto, chamadas, cotas e arquitetura são excluídos.

### Extração de textos técnicos
Textos de layers como `ELE-FIAÇÃO`, `ELE-TEXTOS`, `ELE-CHAMADAS`, `ELE-EQUIPTOS` são extraídos e armazenados no metadata do resultado para enriquecer descrições.

### Limpeza de nomes de layer
Prefixos de XREF (`XREF-NOME$0$`) são removidos automaticamente dos nomes exibidos.

## API

Documentação interativa disponível em http://localhost:8000/docs após subir o projeto.

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cadastro de usuário |
| POST | `/api/auth/login` | Login (retorna JWT) |
| POST | `/api/upload` | Upload de DWG/DXF |
| GET | `/api/projects` | Lista projetos do usuário |
| GET | `/api/projects/{id}/layers` | Lista layers com disciplina sugerida |
| POST | `/api/projects/{id}/process` | Processa o takeoff |
| GET | `/api/projects/{id}/result` | Resultado do takeoff |
| GET | `/api/projects/{id}/export` | Download do Excel |
| GET | `/api/blocks/{project_id}/{block_name}/preview` | SVG miniatura de um bloco (autenticado) |
| GET | `/api/block-mappings` | Lista mapeamentos de blocos |
| POST | `/api/block-mappings` | Cria mapeamento customizado |
| PUT | `/api/block-mappings/{id}` | Atualiza mapeamento |
| DELETE | `/api/block-mappings/{id}` | Remove mapeamento |
| GET | `/api/block-mappings/unmapped/{project_id}` | Lista blocos sem mapeamento |
| GET | `/api/billing/plans` | Lista planos disponíveis |
| POST | `/api/billing/subscribe` | Cria assinatura ASAAS |

## Como rodar localmente

### 1. Pré-requisitos

- Docker Desktop ≥ 4.x (recomendado — sobe tudo de uma vez)
- Node.js ≥ 20 e Python ≥ 3.11 (apenas para desenvolvimento manual)
- ODA File Converter (opcional — necessário apenas para DWG; DXF funciona sem ele)

### 2. Variáveis de ambiente

```bash
# Raiz (para o frontend no Docker)
cp .env.example .env

# Backend
cp backend/.env.example backend/.env
```

Edite `backend/.env` com atenção a:
- `SECRET_KEY` — mínimo 32 caracteres aleatórios (`openssl rand -hex 32`)
- `DATABASE_URL` — manter `postgresql+asyncpg://postgres:postgres@db:5432/takeoff` para Docker
- `ASAAS_API_KEY` — chave da conta ASAAS (sandbox para testes)

> **Atenção:** Não use espaços antes dos nomes de variável no `.env`. Cada linha deve começar com `VARIAVEL=valor` sem espaço inicial.

### 3. Docker Compose (recomendado)

```bash
docker compose up --build
```

Serviços expostos:

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

### 4. Migração do banco

O projeto usa `create_all` no startup — cria as tabelas automaticamente na primeira execução. Se você já tinha o banco de uma versão anterior e adicionou colunas novas, rode manualmente:

```bash
# Adicionar colunas novas na tabela block_mappings (v0.2 → v0.3)
docker exec <container-db> psql -U postgres -d takeoff -c "
  ALTER TABLE block_mappings
    ADD COLUMN IF NOT EXISTS is_material BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS use_regex   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS category    VARCHAR;
"

# Adicionar disciplinas novas ao enum (v0.2 → v0.3)
docker exec <container-db> psql -U postgres -d takeoff -c "
  ALTER TYPE discipline ADD VALUE IF NOT EXISTS 'spda';
  ALTER TYPE discipline ADD VALUE IF NOT EXISTS 'architecture';
  ALTER TYPE discipline ADD VALUE IF NOT EXISTS 'auxiliary';
"
```

### 5. Rodar manualmente (sem Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

## Deploy

### Backend (Railway)
1. Criar serviço Postgres + Redis no Railway.
2. Criar serviço web apontando para `backend/` com start `uvicorn app.main:app --host 0.0.0.0 --port 8080`.
3. Configurar variáveis conforme `backend/.env.example`. `DATABASE_URL` deve usar o host interno do Railway.
4. Para armazenar DWGs/DXFs: configurar `STORAGE_PROVIDER=s3` e preencher `AWS_*`.

### Frontend (Vercel)
1. Importar `frontend/` no Vercel.
2. Definir `NEXT_PUBLIC_API_URL` apontando para o domínio público do Railway.
3. Build padrão (`npm run build`).
4. `NEXT_PUBLIC_*` são baked in no build — rebuildar o frontend ao mudar a URL da API.

### ASAAS (billing)
Informar `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET` e apontar o webhook para:
```
https://{backend-domain}/api/billing/webhook
```

## Tela de Resultados (v0.4)

A tela de resultados divide o output em três seções:

1. **Materiais Identificados** — blocos com nome resolvido e `is_material = true`, ordenados por quantidade.
2. **Metragens** — infraestrutura linear com descrição do layer em português, valor em metros.
3. **Não Identificados** — blocos sem mapeamento, com:
   - Preview SVG do símbolo (gerado em tempo real a partir do DXF, seguindo INSERTs aninhados)
   - Input inline para nomear o bloco e salvá-lo como mapeamento
   - Botão "Reprocessar com novos mapeamentos" para atualizar o quantitativo

## Próximos passos

1. Criar fila assíncrona (Celery + Redis) para processar arquivos grandes sem bloquear a API.
2. Adicionar Alembic para migrações de banco versionadas (substituir o `create_all`).
3. Visualizador DXF no frontend para destacar visualmente os itens contados.
4. Integrar preços SINAPI/TCPO ao quantitativo exportado.
5. Expandir o dicionário de blocos (`block_dictionary.py`) com padrões de outras especialidades (hidráulica, HVAC, incêndio).
6. Marketplace de mapeamentos: usuários compartilham mapeamentos de blocos entre si.
7. CI/CD com GitHub Actions (Railway + Vercel) e observabilidade (OpenTelemetry).

---

Consulte `melhorias-v2.md` para o diagnóstico detalhado da planta de referência (HSL — Subestação Elétrica) e o histórico de implementação do parser v0.4.
