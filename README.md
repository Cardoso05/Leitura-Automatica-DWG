 # TAKEOFF.AI – MVP

MVP completo para o SaaS de levantamento automático de materiais baseado em plantas DWG/DXF descrito no documento “TAKEOFF AI – Levantamento Inteligente de Materiais”. O projeto foi criado em uma pasta independente para publicação em outro repositório e deploy separado em Railway (backend) + Vercel (frontend) com billing via ASAAS.

## Arquitetura

```
takeoff-ai/
├── frontend/   # Next.js (App Router) + Tailwind + shadcn/ui-ready
├── backend/    # FastAPI + SQLModel + PostgreSQL + Redis
├── docker-compose.yml
├── README.md
└── .env.example
```

- **Frontend**: Next.js 14 (App Router), Typescript, TailwindCSS. Inclui páginas iniciais do fluxo (landing, dashboard, upload wizard, viewer de resultados) e hooks para consumir a API.
- **Backend**: FastAPI, SQLModel, PostgreSQL, Redis (fila/cache futura), ezdxf para parsing, integração ASAAS para planos Free/Pro/Business/pay-per-use.
- **Processamento**: Upload → conversão DWG→DXF (ODA) → parser (layers, blocos, linhas) → mapeamento disciplina → consolidação → exportação Excel.

## Como rodar localmente

### 1. Pré-requisitos

- Node.js ≥ 20
- Python ≥ 3.11
- Docker (opcional, mas recomendado para Postgres/Redis)
- ODA File Converter instalado para suportar DWG (ou suba apenas DXF durante o desenvolvimento)

### 2. Variáveis de ambiente

1. Copie `.env.example` para `.env` na raiz e ajuste `NEXT_PUBLIC_API_URL`.
2. Copie `backend/.env.example` para `backend/.env` e configure banco, Redis, ASAAS etc.

### 3. Docker Compose

```bash
cd takeoff-ai
docker compose up --build
```

Serviços expostos:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Postgres: localhost:5432 (user/pass padrão definidos no compose)
- Redis: localhost:6379

### 4. Rodar manualmente

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload

# Frontend
cd ../frontend
npm install
npm run dev
```

## Deploy

- **Backend (Railway)**:
  1. Criar serviço Postgres + Redis no Railway.
  2. Criar serviço web apontando para `backend/` com build `pip install .` e start `uvicorn app.main:app --host 0.0.0.0 --port 8080`.
  3. Configurar variáveis conforme `backend/.env.example`.
  4. Adicionar volumes ou bucket S3/R2 se quiser guardar DWGs fora do contêiner.
- **Frontend (Vercel)**:
  1. Importar `frontend/`.
  2. Definir `NEXT_PUBLIC_API_URL` apontando para o domínio público do Railway.
  3. Usar build padrão (`npm install && npm run build`).
- **ASAAS**:
  - Informar `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET` e apontar o webhook para `https://{backend-domain}/api/billing/webhook` (endpoint já previsto, basta conectar na ASAAS UI).

## Próximos passos sugeridos

1. Adicionar visualizador DWG (p. ex. `@dxf-viewer/core` no frontend) para destacar itens contados.
2. Criar fila Celery/BullMQ para processamento assíncrono de arquivos grandes (placeholder Redis já previsto).
3. Integrar preços SINAPI/TCPO.
4. Implementar AI de reconhecimento para blocos customizados e marketplace de mapeamentos.
5. Automatizar deploy com GitHub Actions (Railway + Vercel) e observabilidade (OpenTelemetry).

---

Projeto isolado pronto para ser enviado a um novo repositório e publicado de forma independente. Consulte `TAKEOFF AI Analise Mercado Requisitos.pdf` (fornecido) para contexto de produto.
