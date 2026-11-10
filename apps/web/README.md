# Aplicação web

A SPA React/TypeScript/Vite atende plataforma, personal, nutricionista e aluno. A entrada seleciona o diagnóstico técnico ou a aplicação de identidade. As rotas e áreas ficam em `src/routes/` e `src/app/`; `src/modules/` contém biblioteca, editor, player, alimentação e painel de acompanhamento. Os serviços em `src/services/` acessam Auth, Data API, RPCs e Storage.

A PWA gera manifest e service worker no build. Cache Storage contém os assets estáticos; IndexedDB mantém sessão, prescrições carregadas, registros e operações pendentes. O player e a alimentação distinguem salvamento local de confirmação remota. Vídeo requer conexão.

Da raiz, use Node 24, `npm ci` e `npm run dev` com as variáveis públicas do ambiente local. Para validar, use `npm run lint`, `npm test` e `npm run build`. Vitest acompanha os módulos em `src/`; Playwright usa o build em preview e specs de `e2e/`. Prepare um backend descartável antes de executar as jornadas.

[Desenvolvimento](../../docs/projeto/DEVELOPMENT.md) · [Testes](../../docs/projeto/TESTING.md) · [Arquitetura](../../docs/projeto/ARCHITECTURE.md) · [Agente web](AGENTS.md)
