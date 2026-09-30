# PersonalFit

**DECISÃO APROVADA:** PersonalFit é o nome temporário de um produto SaaS para profissionais de treinamento físico. Cada operação é um tenant com marca, equipe, alunos e dados isolados. O primeiro profissional será o primeiro cliente da plataforma.

**ESTADO ATUAL:** a Fase 3 implementou identidade, papéis, contexto de tenant, cadastro básico de aluno, marca, convite e autorização por RLS, além da fundação técnica validada na Fase 2.1. Treino, deploy e demais módulos estão pendentes.

## Comece por aqui

1. Leia [docs/projeto/README.md](docs/projeto/README.md) e [docs/projeto/CURRENT_STATE.md](docs/projeto/CURRENT_STATE.md).
2. Consulte [AGENTS.md](AGENTS.md) antes de alterar o projeto com um agente.
3. Consulte as [decisões de arquitetura](docs/decisions/README.md) e a documentação do módulo afetado.

## Estrutura

- `apps/web/`: aplicação React + TypeScript, mobile first e PWA, com áreas mínimas profissional/aluno.
- `supabase/`: configuração local, migration, seed e testes pgTAP.
- `tests/`: futuras verificações de ponta a ponta, autorização e sincronização.
- `docs/projeto/`: memória persistente do produto e do estado de implementação.
- `docs/decisions/`: decisões de arquitetura registradas como ADRs.
- `infra/`: futura configuração operacional.
- `referencia/`: material fornecido para estudo funcional. Não é código, conteúdo ou identidade visual do produto e está excluído do Git.

## Execução local

Use Node 24 e Docker Desktop. Execute `npm install`, `npm run db:start`, `npm run db:reset` e `npm run db:test`. Copie `.env.example` para `apps/web/.env.local` e substitua a chave pública pelo valor de `npx supabase status -o env` (chave publicável/anon local). Depois execute `npm run dev`. `npm run lint`, `npm run test` e `npm run build` validam o frontend. `npm run test:e2e` exige build e Chromium do Playwright. Veja [DEVELOPMENT.md](docs/projeto/DEVELOPMENT.md) para detalhes.

Use `/login` para entrar, `/app` para o contexto profissional, `/aluno/inicio` para a área do aluno e `/diagnostico` para os testes técnicos. Nenhuma credencial real, treino, deploy ou commit foi incluído nesta fase.
