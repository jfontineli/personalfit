# Arquitetura vigente

**CONFIRMADO** — Monorepo npm. A SPA React/TypeScript/Vite usa Supabase Auth, Data API, RPCs PostgreSQL e Storage. A autorização efetiva combina grants, RLS e validação de operações compostas no banco. Não há Edge Function de aplicação implementada. GitHub hospeda o repositório, Cloudflare Pages serve a PWA de teste e Supabase Cloud é o backend gerenciado previsto para o ambiente. Veja [evidências de hospedagem](INFRASTRUCTURE.md).

## Limites e fluxo de dados

A entrada seleciona diagnóstico ou IdentityApp conforme a rota. IdentityApp carrega sessão, memberships e contexto. Os módulos de treino, alimentação e painel consomem principalmente os serviços de domínio; Auth nas telas de identidade e a RPC do painel são exceções. O banco consolida o estado confirmado.

1. O profissional edita um rascunho privado. Publicação cria versão imutável e, no treino, atribuição individual. A sessão mantém a versão inicial.
2. O cliente autorizado carrega a versão. A PWA usa Workbox para o shell estático, sem runtime cache de respostas privadas. O SW é gerado no build e desregistrado no desenvolvimento.
3. IndexedDB tem bases separadas para diagnóstico/Auth, treino/contexto e alimentação. Sessão ou refeição e operação pendente são gravadas atomicamente. As filas de domínio segregam por conta e tenant; cada operação referencia aluno e versão.
4. Em conexão, a RPC valida o recurso e reconhece a operação ou retorna erro. As filas preservam a pendência. Backoff persistente e reconciliação entre aparelhos continuam em aberto.

**DECISÃO APROVADA · trabalho local validado** — A experiência aberta na versão atualmente atribuída resolve nome, instruções gerais e vídeo pela biblioteca atual por RPC autorizada. O snapshot serve de fallback offline e é a fonte de sessões terminais ou de versões anteriores. A sessão continua na versão inicial, inclusive após republicação e retomada em instalação limpa. [ADR 0013](../decisions/0013-live-exercise-media.md) · [ADR 0021](../decisions/0021-live-exercise-library-content.md)

[Contratos](API.md) · [Estrutura do banco](DATABASE.md) · [Frontend](../../apps/web/README.md)
