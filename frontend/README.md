## TAKEOFF.AI – Frontend

SPA criada com Next.js (App Router), TailwindCSS 4 e React Query. Responsável pelo fluxo completo do MVP:

- Landing page com posicionamento de produto baseado no documento de requisitos.
- Autenticação (login/registro) com contexto próprio e persistência em `localStorage`.
- Dashboard com listagem de projetos, status cards e integração ASAAS (checkout pay-per-use/upgrade).
- Wizard de upload (upload → mapeamento de layers → resultado) e página de resultados detalhados.

### Scripts principais

```bash
npm install        # instala dependências
npm run dev        # ambiente local em http://localhost:3000
npm run build      # build para produção
npm run start      # executa build em modo produção
npm run lint       # ESLint
```

### Variáveis de ambiente

- `NEXT_PUBLIC_API_URL`: URL base do backend FastAPI (ex.: `http://localhost:8000/api` ou a URL do Railway).

Defina em `.env.local` ou via painel da Vercel.

### Deploy

1. Importar esta pasta no Vercel.
2. Definir `NEXT_PUBLIC_API_URL` apontando para o backend publicado.
3. `npm run build` é executado automaticamente.

### Stack

- Next.js 16 (App Router) + React 19
- TailwindCSS 4 (modo `@import`)
- @tanstack/react-query para dados e cache
- sonner para notificações
- lucide-react para ícones

Integração pronta para consumir o backend FastAPI/SQLModel localizado em `../backend`.
