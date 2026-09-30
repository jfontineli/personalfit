# Desenvolvimento

## Estado e ferramentas

**CONFIRMADO:** o monorepo usa npm workspaces, Node 24, React 19, TypeScript 5, Vite 8, Vitest 5 e Supabase CLI 2.118.0. Existem scripts de dev, lint, test, build, E2E e banco no `package.json` raiz.

**DECISÃO APROVADA:** monorepo modular, React + TypeScript, PWA, Supabase e PostgreSQL; sem Spring Boot inicialmente.

## Fluxo de trabalho

1. Leia `CURRENT_STATE.md`, este documento, `AGENTS.md` e os ADRs relevantes.
2. Inspecione código, migrations/configuração e testes antes de alterar.
3. Registre impacto em tenant, autorização, publicação, histórico e offline.
4. Faça a menor alteração coerente com a fase aprovada.
5. Crie migration e contrato junto da mudança persistente.
6. Execute testes proporcionais, principalmente isolamento e recuperação offline.
7. Revise diff, segredos e documentação; atualize `CURRENT_STATE.md`.

## Convenções ainda abertas

**CONFIRMADO:** npm workspaces, Vite, `idb`, ESLint, Vitest, Playwright e CI GitHub Actions foram escolhidos para a base técnica. Ainda não há roteador porque existe apenas uma tela.

## Ambientes e configuração

1. Instale Node 24 e Docker Desktop; execute `npm install` na raiz.
2. Execute `npm run db:start`, `npm run db:reset` e `npm run db:test`. O primeiro start pode baixar imagens grandes.
3. Copie `.env.example` para `apps/web/.env.local`. Preencha `VITE_SUPABASE_PUBLISHABLE_KEY` com a chave pública local mostrada por `npx supabase status`; não use service role.
4. Execute `npm run dev` para desenvolvimento. Para PWA/offline, execute `npm run build` e `npx vite preview --host 127.0.0.1` em `apps/web`.
5. Execute `npm run lint` e `npm run test`. Instale o navegador com `npx playwright install chromium` antes de `npm run test:e2e`. Para o E2E completo, mantenha Supabase local ativo e passe `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` somente ao processo de teste. Obtenha os valores com `npx supabase status -o env`; a chave de serviço nunca entra em `.env.local` nem em variável `VITE_`.

O seed contém identidades sem senha, usadas apenas para RLS. Para login manual local, crie uma conta técnica no Supabase Studio e use o formulário da aplicação; ela não recebe vínculo automaticamente. HOMOLOG e PROD futuros usam as mesmas variáveis públicas com valores próprios e segredos somente no ambiente servidor.

**CONFIRMADO NESTE HOST:** `db:start`, `db:reset` e `db:test` passaram depois de iniciar o Docker Desktop. O disco virtual do Docker permanece em C:, com espaço livre limitado; o cache de build Docker foi limpo sem remover imagens ou volumes. Se C: voltar a encher, investigue antes de limpar dados persistentes.

## Material de referência

O HTML em `referencia/` é somente referência funcional. Conteúdo, marca, nomes, imagens e assets não entram no novo projeto.
