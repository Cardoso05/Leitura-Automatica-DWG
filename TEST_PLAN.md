# Plano de Testes Manuais – TAKEOFF.AI

Documento para validar todas as funcionalidades críticas do MVP assim que o ambiente estiver publicado (Railway + Vercel + ASAAS). Estruture a execução em ondas (Smoke → Funcional → Resiliência → Segurança) e registre evidências com screenshots/IDs de pagamento.

---

## 1. Preparação do Ambiente

| Item | Ação |
| --- | --- |
| URLs | Confirmar domínios públicos do backend (`https://api.takeoff…`) e frontend (`https://app.takeoff…`). |
| Variáveis | Conferir `SECRET_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET`, URLs do banco/Redis e caminhos de storage (Railway). |
| Banco | Executar `app.db.session.init_db()` ou migração Alembic para garantir a tabela `payments`. |
| ASAAS | Criar cliente sandbox, webhook apontando para `/api/billing/webhook` com o mesmo segredo configurado no backend. |
| Dados de teste | Preparar pelo menos 2 arquivos DWG/DXF (um simples <5 MB e outro ~30 MB), credenciais ASAAS de teste e um usuário existente para validar upgrades. |
| Ferramentas de apoio | Postman ou Hoppscotch para chamadas diretas; ngrok/ASAAS painel para replays; navegador Chromium + DevTools para rede/logs. |

## 2. Smoke Test (10 minutos)

1. **Healthcheck** – `GET /health` deve retornar `{"status":"ok"}` sem headers sensíveis.  
2. **CORS** – Requisição OPTIONS a partir do domínio do frontend precisa retornar 200.  
3. **Landing** – Carregar `/` e validar ausência de erros no console.  
4. **Docs** – Garantir que `/docs` ou `/redoc` estejam protegidos (ideal: autenticados ou desativados em produção).  

## 3. Casos Funcionais Detalhados

### 3.1 Autenticação & Sessão

| ID | Cenário | Passos principais | Resultado esperado |
| --- | --- | --- | --- |
| AUTH-01 | Registro novo usuário | Preencher formulário `/register` com e-mail inédito. | usuário criado, token salvo, redirecionamento para `/dashboard`. |
| AUTH-02 | Login inválido | Usar senha errada 3x. | Resposta 401, mensagem amigável, sem detalhe técnico. |
| AUTH-03 | Expiração/token removido | Limpar `localStorage` e acessar `/dashboard`. | Página exige login e CTA visível. |
| AUTH-04 | Logout | Click em “Sair” no menu lateral. | Token removido, retorno ao login. |

### 3.2 Dashboard & Navegação

| ID | Cenário | Passos | Resultado |
| --- | --- | --- | --- |
| DASH-01 | Responsividade | Abrir dashboard em 320 px, 768 px e ≥1280 px. | Menu colapsa corretamente, sem overflow horizontal. |
| DASH-02 | Estatísticas | Com ≥2 projetos, verificar cards “Projetos totais/Concluídos”. | Números batem com dados reais do backend. |
| DASH-03 | Refresh projects | Clicar em “Atualizar”. | Requisição `GET /projects` disparada, tabela recomposta sem duplicar linhas. |

### 3.3 Upload & Limites

| ID | Cenário | Passos | Resultado |
| --- | --- | --- | --- |
| UP-01 | Upload DXF pequeno | Enviar arquivo válido. | Step muda para “Mapeamento”, layers listados, toast de sucesso. |
| UP-02 | Upload DWG → conversão | Enviar DWG (com ODA configurado). | Conversão concluída, `dxf_path` populado. |
| UP-03 | Tipo inválido | Enviar PDF. | Erro 400 “Formato não suportado”. |
| UP-04 | Limite tamanho | Arquivo >50 MB. | Rejeitar cliente antes de chamar API (UI) ou resposta 413. |
| UP-05 | Quota Free | Usuário plano Free com 3 projetos no mês tenta processar outro. | `/projects/{id}/process` retorna 402 com mensagem de upgrade. |

### 3.4 Mapeamento, Processamento e Resultados

| ID | Cenário | Passos | Resultado |
| --- | --- | --- | --- |
| PROC-01 | Sugestões de disciplina | Na etapa 2, revisar se layers com “ELET” vêm pré-preenchidos como elétrica. | Sugestões coerentes. |
| PROC-02 | Ajuste escala | Alterar escala para 0,5 e processar. | Quantidades lineares devem refletir novo fator (comparar com run anterior). |
| PROC-03 | Resultado resumo | Após processamento, conferir cards de resumo e itens. | Valores >0, download Excel funcional. |
| PROC-04 | Export | Ação “Exportar Excel” baixa arquivo válido (abrir no Excel/LibreOffice). | Planilhas “Quantitativo/Resumo/Metadata” preenchidas. |
| PROC-05 | Persistência | Recarregar `/dashboard/results/{id}`. | Dados são carregados do backend sem repetir processamento. |

### 3.5 ASAAS / Billing

| ID | Cenário | Passos | Resultado |
| --- | --- | --- | --- |
| PAY-01 | Checkout Pay-per-use | Estando logado, clicar “Pagar por projeto”. | `POST /billing/checkout` retorna `invoice_url`, pagamento aparece na aba ASAAS. |
| PAY-02 | Webhook assinatura inválida | Reenviar evento ASAAS com assinatura alterada. | Webhook responde 401; status do pagamento local mantém `PENDING`. |
| PAY-03 | Webhook válido | Usar replay oficial ASAAS. | `payments` atualiza para `RECEIVED` e, se plano Pro/Business, campo `user.plan` muda. |
| PAY-04 | Valor divergente | Alterar `value` manualmente via painel e disparar webhook. | API retorna 400 “Valor divergente”. |
| PAY-05 | Pagamento inexistente | Webhook com `paymentId` desconhecido. | Resposta 200 com `ignored`, log indicando ausência. |

### 3.6 Block Mappings

| ID | Cenário | Passos | Resultado |
| --- | --- | --- | --- |
| MAP-01 | Criar mapeamento | POST `/block-mappings` via UI (quando adicionarem tela) ou API. | Registro vinculado ao `user_id` atual. |
| MAP-02 | Remover mapeamento próprio | DELETE do ID recém-criado. | 204. |
| MAP-03 | Tentar remover default | DELETE em um mapping `user_id=null`. | 403 “globais não podem ser removidos”. |

### 3.7 Segurança & Resiliência

| ID | Cenário | Passos | Resultado |
| --- | --- | --- | --- |
| SEC-01 | JWT inválido | Modificar payload e reusar token. | 401 em qualquer endpoint protegido. |
| SEC-02 | Rate limit manual | Fazer 50 requisições `/auth/login` em <1 min. | Verificar se há bloqueio ou necessidade de configurar WAF. |
| SEC-03 | Upload sem token | `POST /upload` sem Authorization. | 401. |
| SEC-04 | Storage path traversal | Emular upload com filename `../../etc/passwd`. | Arquivo salvo com UUID sem respeitar nome original. |
| SEC-05 | Replay ASAAS | Reexecutar webhook antigo (mesmo payload). | Atualização idempotente (sem duplicar upgrades). |

### 3.8 Observabilidade e Alertas

1. Confirmar logs estruturados (Logtail/Railway) para cada etapa (upload, processamento, webhook).  
2. Validar métricas básicas: número de processamentos/dia, tempo médio.  
3. Se usar S3/R2, garantir que objetos são versionados ou possuem lifecycle para limpeza.

### 3.9 Experiência do Usuário (UI/UX)

- Verificar contraste AA (WCAG) principalmente em textos em azul sobre fundo branco.  
- Garantir feedback inline em formulários (exibir erros abaixo do input).  
- Confirmar que toasts não acumulam indefinidamente.  
- Testar flows mobile: upload (drag drop não funciona em mobile – oferecer input visível).  
- Checar se CTA “Nova Planta” fica visível quando a tabela é longa (talvez duplicar botão no topo).  

## 4. Pós-teste

1. Limpar arquivos de storage de teste (tanto local quanto bucket).  
2. Remover clientes/payments de sandbox ASAAS para evitar faturas pendentes.  
3. Registrar anomalias no issue tracker com: data, ID do projeto/pagamento, logs relevantes e passos para reproduzir.  
4. Atualizar este documento conforme novas features (ex.: viewer 3D, fila assíncrona, integrações SINAPI).

---

> **Dica:** ao automatizar parte desses cenários no futuro, use Playwright para o frontend e pytest + httpx para as rotas críticas (upload, billing, webhook). Entretanto, mantenha este checklist manual como “gate” antes de releases públicos ou ajustes estruturais (billing, storage, parsing).
