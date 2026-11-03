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
| Nova publicação muda histórico | Teste de versão, snapshot e sessão antiga | CONFIRMADO no primeiro ciclo |
| Mesmo operationId técnico chega duas vezes | Teste de idempotência | CONFIRMADO |
| Resposta se perde após persistência | Reenvio sem duplicação | PENDENTE |
| App fecha offline no meio da sessão | E2E recarrega PWA offline e mantém lançamento | CONFIRMADO no primeiro ciclo |
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

**RESULTADO ONBOARDING LOCAL:** a migration nova foi aplicada sem reset. `db:test` passou com 89 verificações em três arquivos; o novo pgTAP cobre autorização de criação, hash/expiração/uso único, email confirmado, isolamento e auditoria. O E2E adicional percorreu superadmin → tenant/convite → cadastro/ativação do personal → cadastro de aluno. O teste usa Chrome instalado quando `PLAYWRIGHT_CHROME_PATH` é informado; sem essa variável, Playwright usa seu Chromium padrão.

**RESULTADO GESTÃO DA PLATAFORMA:** a migration de plano/acesso foi aplicada sem reset. `db:test` passou com 111 verificações em quatro arquivos: negação a anônimo e profissional comum, listagem administrativa, suspensão, vencimento, isolamento do Tenant B, bloqueio de convite e reativação sem perda de dados. O E2E de onboarding passou incluindo listagem, edição do plano, ativação e suspensão do espaço. Lint, 5 testes Vitest, TypeScript e build PWA passaram nesta alteração.

**RESULTADO UX DO PAINEL:** o resumo, a busca, a edição sob demanda, o convite copiável e a confirmação contextual substituem o formulário repetido em cada cartão. O retorno de quem já tem conta ao convite usa apenas fragmento local e uma lista permitida de destinos; dois testes Vitest verificam a aceitação dos convites e a rejeição de redirecionamento externo. A revisão visual foi feita em desktop e celular. Após a alteração, lint, TypeScript, build PWA, sete testes Vitest e quatro E2E passaram, incluindo o fluxo completo do superadmin ao aluno.

**RESULTADO UX DO PERSONAL E LOGOTIPO:** a migration privada de Storage foi aplicada sem `db:reset`. Um teste SQL em transação revertida verificou leitura/escrita pelo profissional, leitura sem escrita por aluno, e negação para superadmin sem vínculo, outro tenant, vínculo inativo e plano suspenso. A API de Storage confirmou upload/download permitido e negações reais, removendo o arquivo temporário ao final. O E2E isolado `professional-ux.spec.ts` passou com seleção de cores, upload, prévia, gravação de marca e cadastro de aluno; seu espaço fictício e arquivo foram removidos ao final. Os E2E antigos que dependem do seed A/B não devem ser executados contra o banco local limpo sem recriar os fixtures de forma isolada.

**RESULTADO COMPARTILHAMENTO DO CONVITE:** o E2E isolado do personal passou com geração de convite, cópia do link para a área de transferência, mensagem preparada no `wa.me` e confirmação antes de substituir o link. O teste não abriu o serviço externo nem enviou mensagem e removeu seus dados fictícios ao final.

**RESULTADO PRIMEIRO CICLO DE TREINO (2026-10-01):** as cinco migrations novas foram aplicadas localmente sem `db:reset`, preservando o espaço existente. `workout_first_slice.test.sql` passou com 44 verificações pgTAP em transação revertida: anon, A/B, A1/A2, plano de atendimento, vídeo privado, limites das séries, snapshot histórico, sessão em versão antiga, inativação e operação repetida. Lint, TypeScript, nove testes Vitest e build PWA passaram. O E2E isolado passou com exercício/vídeo próprio, plano de atendimento, publicação, login do aluno, upload/download privado, lançamento offline, reload offline e confirmação no banco após reconexão; removeu as contas, espaço e mídia fictícios ao final. Os E2E isolados de onboarding e da área profissional também passaram na mesma rodada, totalizando três testes. A suíte E2E legada que depende do seed A/B não foi usada contra o banco local limpo.

**RESULTADO IMPORTAÇÃO DE TREINO (2026-11-02):** 49 verificações pgTAP passaram, incluindo snapshot de orientação/observação/tipo de série, RIR inválido e bloqueio de rascunho não revisado. Lint, TypeScript, nove testes Vitest e build PWA passaram com pasta temporária controlada; o E2E de treino passou com orientação individual, descanso, rótulos de série, RIR, sincronização offline, publicação desabilitada durante revisão e liberação pelo profissional. A importação real foi conferida contra a aba TREINO atual: 36/36 linhas bateram em dia, ordem, nome, quantidade de séries, repetições e descanso. O banco confirmou inicialmente um rascunho sem versão; depois, o profissional publicou uma versão de cinco dias e 36 exercícios atribuída ao aluno. A suíte E2E antiga dependente do seed A/B não foi executada.

**RESULTADO EDITOR POR DIA (2026-11-02):** lint, TypeScript e build PWA passaram. O E2E de treino alternou entre dois dias, confirmou que os detalhes preenchidos no primeiro permaneceram após a troca, publicou ambos os dias e verificou a execução do aluno. A alteração é apenas de interface; a versão 1 publicada do primeiro espaço permanece intacta.

**RESULTADO SEQUÊNCIA DO PERSONAL E DIA/SEMANA DO ALUNO (2026-11-02):** lint, build PWA, 10 testes Vitest e E2E de treino passaram. O E2E moveu o dia no editor e voltou à ordem inicial, conferiu um único dia visível ao aluno, registrou uma série offline, recarregou offline com a fila ainda visível e confirmou a sincronização e os campos `day_id`/`week_start` no banco. O pgTAP passou com 58 verificações, incluindo dia errado, semana inválida, idempotência e negação para anon, com rollback.

**RESULTADO UX E CICLO DO TREINO (2026-11-02):** lint, 10 testes Vitest, build PWA, E2E isolado e 68 verificações pgTAP passaram. O E2E cobre publicação com início/duração, orientação destacada, navegação por dia, CSS de semana aplicado, registro offline e sincronização, bloqueio de conclusão com séries faltantes, série cronometrada sem carga e encerramento parcial. O pgTAP também confirma compatibilidade com operações antigas de zero repetição e alinhamento da semana do ciclo, negação de unidade errada, rejeição de conclusão incompleta, resultado parcial terminal, idempotência e isolamento. Os testes de banco usam transação revertida; a migration foi aplicada sem reset no Supabase local.

**LIMITE DO AMBIENTE LOCAL:** `npm run db:test` não iniciou porque `node_modules/supabase/dist/supabase.js` está ausente nesta instalação. O teste isolado de treino foi executado diretamente pelo `psql` no contêiner, com 68/68 verificações e rollback. Uma tentativa de executar a suíte SQL inteira parou em `identity_business.test.sql`, que pressupõe o seed A/B ausente deste banco local preservado; a transação do arquivo foi revertida. Não foi feito `db:reset` para não apagar o espaço real.

**RESULTADO PREPARAÇÃO E AVANÇO (2026-11-02):** lint, 10 testes Vitest, build PWA e E2E isolado de treino passaram. O E2E configurou um item como preparação cronometrada, publicou o estilo, verificou a ausência de carga/RIR, registrou duas etapas e confirmou que salvar a última série do exercício anterior abre o próximo automaticamente. O pgTAP isolado passou com 73 verificações e rollback, incluindo rejeição direta de carga/RIR na preparação e aceitação do tempo sem esses campos. A migration foi aplicada sem reset; não houve republicação do treino real.

**RESULTADO REGISTRO GUIADO (2026-11-02):** lint, 10 testes Vitest, build PWA e E2E isolado passaram. O E2E confirmou um formulário por vez, progresso após cada série, correção de registro salvo, continuidade após recarga offline, ausência de rolagem horizontal em largura de 390 px, avanço ao próximo exercício, sincronização e conclusão do dia. A alteração é de apresentação e estado da interface; o banco e o snapshot publicado não foram modificados nesta rodada.

**RESULTADO BIBLIOTECA POR GRUPOS E ABAS (2026-11-02):** lint, 10 testes Vitest, build PWA e dois E2E isolados passaram. Os E2E cobrem cadastro de exercício com grupo e vídeo, cadastro sem vídeo, filtro e busca, abas Cadastro/Atendimento/Treino, preservação da aba Treino após recarga, publicação, execução offline e convite. O pgTAP isolado passou com 75 verificações e rollback; incluiu edição do grupo pelo profissional do Tenant A e negação para exercício do Tenant B. A primeira rodada encontrou o grant de coluna ausente, corrigido pela migration `20261102090000_exercise_group_grants.sql`; outra rodada encontrou seletores desatualizados do teste, corrigidos sem mudar o contrato do produto. Os testes fictícios foram removidos ao final.

**RESULTADO VÍDEO NO FORMULÁRIO (2026-11-02):** lint, 12 testes Vitest e build PWA passaram. O E2E isolado passou com MP4 no cadastro e link do YouTube na edição, ambos pelo botão único do formulário; confirmou a opção de arquivo ausente quando o link está selecionado e o endereço normalizado no banco. Os testes unitários rejeitam domínio falso, HTTP e ID inválido. A primeira tentativa de E2E consultou o banco antes da conclusão assíncrona da gravação; a espera foi corrigida e a segunda execução passou.

**RESULTADO MÍDIA ATUAL SEM REPUBLICAÇÃO (2026-11-02):** a consulta ao Supabase local confirmou link novo na biblioteca e referência vazia na versão 1 do exercício real. Sob o papel autenticado do aluno real, a RPC devolveu uma mídia atual para sua versão atribuída. A migration aditiva foi aplicada sem reset; o pgTAP isolado passou com 82 verificações, incluindo acesso autorizado ao MP4 atual e negações para anon, aluno sem atribuição, outro tenant e conta inativa. Lint, 12 testes Vitest, build e E2E isolado passaram. O E2E altera um vídeo após publicar, confirma o link atualizado na área do aluno e a referência original ainda no snapshot; a versão e as séries não mudam.

**RESULTADO MODAL DE VÍDEO (2026-11-02):** lint, 12 testes Vitest, build PWA e E2E isolado passaram. O E2E confirmou player incorporado do YouTube no modal, fechamento por botão e Esc, foco devolvido ao exercício, rota mantida e MP4 privado reproduzido no mesmo modal. O teste não garante que qualquer vídeo externo aceite incorporação; essa permissão depende do publicador no YouTube.

**LIMPEZA DA RODADA:** uma tentativa de E2E expirou ao procurar um seletor de fixture. O espaço fictício e suas duas contas `example.invalid` deixados por essa tentativa foram identificados e removidos em transação, sem versões publicadas nem objetos de Storage. A conferência final do banco mostrou 1 tenant, 1 aluno, 36 exercícios, 1 versão e 0 contas `example.invalid`.

**LIMPEZA DE TESTE (2026-11-02):** uma execução que expirou deixou um tenant fictício com dois exercícios e três contas `example.invalid` (uma órfã). Após conferir IDs, nome do tenant, e-mails, exercícios e ausência de versão publicada, esses registros e a mídia de teste foram removidos. A conferência final do banco voltou a 1 tenant, 1 aluno, 1 versão publicada, 36 exercícios e zero contas `example.invalid`.

**RESULTADO IDENTIDADE DO ALUNO (2026-11-02):** lint, 10 testes Vitest, build PWA e E2E isolado passaram. O E2E verifica marca e cor do tenant no cabeçalho, ausência do título genérico, orientações recolhidas, aplicação do layout da semana e ausência de rolagem horizontal em 390 px; também percorre execução offline, sincronização e encerramento parcial. Uma captura temporária do resultado em celular foi inspecionada visualmente e descartada.

**VALIDAÇÃO ANTES DO ENVIO AO GITHUB (2026-11-02):** lint, 12 testes Vitest e build PWA passaram. `db:test` foi executado com a CLI instalada em pasta temporária e falhou nas suítes antigas que pressupõem os tenants e usuários fictícios do seed; eles não existem mais no banco local após a limpeza autorizada. O teste do primeiro ciclo de treino passou. Não executar `db:reset` sobre esse banco para satisfazer as fixtures, pois isso apagaria os dados locais mantidos pelo usuário. O teste de banco em ambiente descartável com seed e a independência dessas suítes do estado local permanecem pendentes.
