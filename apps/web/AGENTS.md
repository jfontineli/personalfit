# Frontend e PWA

Complemente o [agente raiz](../../AGENTS.md). Consulte o [README web](README.md), os [contratos](../../docs/projeto/API.md) e a [matriz de acesso](../../docs/projeto/AUTHORIZATION.md).

- Em React/TypeScript/Vite, confira a rota em `src/routes/`, a entrada em `main.tsx` e a resolução de Auth, contexto e papel em `app/IdentityApp.tsx`. Ao trocar conta ou tenant, revise estado em memória, requisições em voo e filtros.
- Concentre acesso a dados em `src/services/`. Revise exceções existentes antes de espalhar chamadas Supabase nos componentes. A interface orienta navegação; o servidor autoriza o recurso.
- Um cache local nunca comprova autorização atual. Trate 401/403, resultado vazio, revogação e falta de rede separadamente. Confira o ciclo de logout em aparelho compartilhado e preserve pendências segregadas por usuário/tenant/aluno.
- IndexedDB guarda sessão Auth, prescrições, execução e filas. Grave alteração e operação na mesma transação. Reenvie o ID original, mostre confirmação real e trate conflitos e falhas sem descartar registros. Considere múltiplas abas, reconexão e operações antigas.
- Cache Storage serve o shell estático. Mídia privada exige download autorizado online e liberação da URL de objeto. Respeite versão de sessão histórica e conteúdo individual congelado ao resolver mídia ou instruções atuais.
- Preserve compatibilidade de schema local e contratos da PWA já instalada. Conforme impacto, valide lint, Vitest, build e Playwright em preview, com recarga offline, logout, reconexão, troca de versão e negação de acesso. Veja [como testar](../../docs/projeto/TESTING.md).
