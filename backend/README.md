 # TAKEOFF.AI – Backend

API FastAPI responsável por autenticação, upload/conversão de DWG/DXF, execução do motor de takeoff e exportação em Excel. Projetado para deploy no Railway.

## Stack

- **FastAPI + Uvicorn**
- **SQLModel + PostgreSQL**
- **Redis** (cache/fila leve)
- **ezdxf** para parsing de DXF
- **ASAAS** como gateway BR (PIX, boleto, cartão)
- **S3/R2** (ou storage local) para manter os arquivos enviados

## Variáveis de ambiente (arquivo `.env`)

```
# Básico
API_V1_PREFIX=/api
PROJECT_NAME=TAKEOFF.AI
BACKEND_CORS_ORIGINS=["http://localhost:3000","https://takeoff-ai.vercel.app"]
# Gere algo aleatório (openssl rand -hex 32)
SECRET_KEY=GERE_UMA_CHAVE_ALEATORIA_DE_32_CARACTERES
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Banco / Redis
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/takeoff
REDIS_URL=redis://redis:6379/0

# Storage
STORAGE_PROVIDER=local            # local | s3
STORAGE_LOCAL_PATH=storage/uploads
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=us-east-1

# Conversor DWG -> DXF
ODA_CONVERTER_PATH=/opt/ODAFileConverter/ODAFileConverter
ODA_INPUT_FORMAT=ACAD2018
ODA_OUTPUT_FORMAT=ACAD2018

# Planos / ASAAS
ASAAS_API_KEY=coloque_sua_chave
ASAAS_API_URL=https://www.asaas.com/api/v3
# Usado para validar webhooks (HMAC SHA256)
ASAAS_WEBHOOK_SECRET=defina-um-segredo-unico
FREE_PROJECTS_PER_MONTH=3

# Observabilidade
LOG_LEVEL=INFO
```

## Como rodar localmente

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

Ou via Docker (recomendado junto com Postgres/Redis):

```bash
docker compose up --build backend
```

## Estrutura

```
app/
  api/          # Rotas FastAPI
  core/         # Configurações, segurança e deps
  db/           # Engine e inicialização
  models/       # Tabelas SQLModel
  schemas/      # Pydantic
  services/     # Conversão, parsing, ASAAS, storage
  utils/        # Helpers (mapeamento de layers)
```

## Fluxo MVP

1. Usuário registra/login → recebe JWT.
2. Faz upload DWG/DXF (`POST /api/upload`).
3. Backend guarda arquivo, converte para DXF (ODA) e executa parser base.
4. `GET /api/projects/{id}/layers` mostra layers detectados e sugestões de disciplina.
5. `POST /api/projects/{id}/process` roda `takeoff_engine` com mapeamento enviado.
6. `GET /api/projects/{id}/result` retorna JSON estruturado.
7. `GET /api/projects/{id}/export` baixa Excel formatado.

## Integração ASAAS

`services/asaas_client.py` encapsula chamadas REST (`/customers`, `/payments`). É necessário informar o `ASAAS_API_KEY`. O endpoint `/api/billing/checkout` gera pagamento pay-per-use ou upgrade de plano e retorna o link do ASAAS.  
Cada checkout é persistido na tabela `payments` (valor, tipo escolhido, usuário). O webhook `/api/billing/webhook` valida o HMAC enviado pelo ASAAS (`ASAAS_WEBHOOK_SECRET`) e consulta o pagamento via API antes de atualizar o status/planos, garantindo que valores e IDs batem com o que foi gerado pelo backend.

## Deploy Railway

1. Criar serviço PostgreSQL e Redis (add-ons nativos).
2. Criar serviço web apontando para este backend com build `pip install .` + `uvicorn app.main:app`.
3. Configurar variáveis conforme `.env.example`.
4. Configurar webhooks ASAAS → `https://{railway-app}/api/billing/webhook`.

## Testes

```bash
pytest
```

Testes unitários podem ser adicionados em `app/tests/`.

---

> Documento base: TAKEOFF AI – Levantamento Inteligente de Materiais. Adaptações feitas para garantir deploy rápido em Railway e integrações com ASAAS/Vercel.
