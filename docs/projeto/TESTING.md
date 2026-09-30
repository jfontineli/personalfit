# Estratégia de testes

## Estado

**CONFIRMADO:** Vitest testa interface técnica, serviço sem configuração, IndexedDB e fila; `apps/web/e2e/` contém testes técnicos e de identidade/tenant/aluno/convite; `supabase/tests/technical_foundation.test.sql` e `identity_business.test.sql` verificam autorização, domínio e idempotência via pgTAP. A execução de E2E exige Chromium e chave de serviço somente no processo de teste; banco exige Supabase local ativo.

## Matriz inicial

| Risco | Verificação planejada | Estado |
|---|---|---|
| Tenant A lê recurso técnico de B | Testes negativos de RLS/API e E2E | CONFIRMADO |
| Anônimo lê ou chama RPC técnica | Testes negativos de privilégios/RLS | CONFIRMADO |
| Aluno A1 lê A2 | Teste negativo de RLS no banco; Storage ainda sem objetos | CONFIRMADO no banco |
| Usuário sem vínculo ou inativo escreve recibo técnico | Testes de autorização | CONFIRMADO |
| Cliente altera `tenant_id` | INSERT em B e URL/ID de aluno B com conta A | CONFIRMADO |
| Nova publicação muda histórico | Teste de versão e sessão | PENDENTE |
| Mesmo operationId técnico chega duas vezes | Teste de idempotência | CONFIRMADO |
| Resposta se perde após persistência | Reenvio sem duplicação | PENDENTE |
| App fecha offline no meio da sessão | Retomada via IndexedDB | PENDENTE |
| Dois dispositivos editam a mesma sessão | Política de conflito definida e testada | PENDENTE |
| Aluno inativado ainda possui fila | Comportamento aprovado e testado | PENDENTE |
| SW atualiza com sessão aberta | Dados locais preservados | PENDENTE |

## Dados de teste

**DECISÃO APROVADA:** usar ao menos Tenant A e Tenant B desde o primeiro incremento, com alunos distintos. Seeds devem ser fictícios e não devem conter dados da referência.

## Critérios

**HIPÓTESE:** testes unitários para regras puras, testes de banco para RLS/constraints, testes de contrato para funções/API e E2E para as jornadas críticas. Não escrever testes que apenas repetem a implementação sem verificar comportamento.

**CONFIRMADO:** `npm run test`, `npm run test:e2e` e `npm run db:test` são os comandos iniciais. A CI roda os testes de frontend; banco e E2E dependem de serviços/imagens adicionais e ainda não fazem parte da CI.

**RESULTADO FASE 2.1:** `npm ci` passou no checkout. `npm run lint`, `npm run test` (3 arquivos/5 testes), `npm run build` (manifest e service worker), `npm run test:e2e` (2 testes) e `npm run db:test` (19 testes pgTAP) passaram. O E2E validou offline/online, Auth A/B/sem vínculo, renovação, sessão após reload/nova aba, logout, isolamento e sincronização técnica com recibo. `npm run db:reset` validou migration e seed do zero.

**RESULTADO FASE 3:** `db:reset` aplicou ambas as migrations e o seed. `db:test` passou com 65 verificações em dois arquivos, incluindo email não confirmado e convite expirado. O E2E de identidade passou com profissional A/B, seleção de tenant para múltiplos vínculos, criação/edição/inativação/reativação de aluno, edição de marca, convite, criação da conta Auth pela tela, ativação, usuário sem vínculo e tentativa por URL/ID de outro tenant. Lint, 5 testes Vitest, build PWA e 3 E2E passaram; os comandos diretos das ferramentas Node foram usados porque `npm` não está no PATH do sandbox.
