# Persistência e banco de dados

## Autoridade dos dados

**DECISÃO APROVADA:** PostgreSQL é a fonte consolidada. IndexedDB contém prescrição disponível offline, sessões em andamento e operações pendentes; `localStorage` guarda apenas preferências simples. Cache Storage guarda recursos da PWA. Supabase Storage privado guarda logotipos e vídeos próprios do profissional.

**HISTÓRICO CONFIRMADO NA FASE 2.1:** `db:reset` aplicou do zero `20260929000000_technical_foundation.sql` e o seed da época. Foram criadas `tenants`, `tenant_brand`, `tenant_memberships` e `technical_operation_receipts`, todas com RLS ativa, seis políticas e a RPC `record_technical_operation` em modo invoker. O seed daquela fase tinha 2 tenants, 2 marcas, 2 vínculos e 3 identidades fictícias sem senha. Os 19 testes pgTAP passaram; reenvio da mesma `(user_id, operation_id)` gerou só um recibo.

**CONFIRMADO NA FASE 3:** a nova migration `20260929010000_identity_business.sql` preserva a anterior e acrescenta `user_profiles`, `platform_admins`, `professionals`, `students`, `student_internal_notes`, `student_invitations` e `audit_events`, todas com RLS ativa. Os novos papéis dos vínculos são `PROFISSIONAL` e `ALUNO`; `SUPER_ADMIN` fica separado em `platform_admins`, sem policy de leitura de dados do tenant. `tenant_brand` recebeu nome de marca, cor secundária, URL opcional de logo e contatos. Colunas de `user_id` e `tenant_id` do aluno não são editáveis pelo cliente; associação usa RPC transacional de convite. O email do aluno é único por tenant com comparação sem caixa e espaços externos são rejeitados. O seed atual contém 2 tenants, 2 profissionais, 4 alunos e 6 identidades Auth fictícias sem senhas. O teste de banco tem 65 verificações pgTAP, incluindo as 19 técnicas originais e autorização de negócio.

**CONFIRMADO NO ONBOARDING LOCAL:** `20260930000000_professional_onboarding.sql` acrescenta `professional_invitations` com RLS e sem grants diretos para clientes. As RPCs criam tenant/convite e ativam profissional em transações, com hash SHA-256, prazo de 48 horas, email confirmado, consumo único e auditoria. A migration foi aplicada sem `db:reset`; os dados locais existentes foram preservados. Naquele marco, a suíte tinha 89 testes pgTAP em três arquivos.

**CONFIRMADO NA GESTÃO DA PLATAFORMA:** `20260930010000_platform_space_management.sql` adiciona `tenant_plans` (tipo, ativo, data final), sem leitura direta para clientes. Um gatilho cria avaliação de 30 dias em novos espaços; espaços preexistentes foram preservados como ativos sem vencimento. Policies restritivas usam `tenant_access_allowed` nas tabelas do espaço; RPCs privilegiadas de convite conferem o mesmo bloqueio. `list_platform_spaces` e `set_platform_space_plan` verificam superadmin ativo. A migration foi aplicada localmente sem reset; 111 testes pgTAP passaram em quatro arquivos.

**CONFIRMADO NO UPLOAD DE MARCA:** `20260930020000_brand_logo_storage.sql` cria o bucket privado `brand-logos` com máximo de 2 MB e tipos PNG/JPEG/WebP. O caminho armazenado em `tenant_brand.logo_url` é `<tenant-uuid>/<arquivo-uuid>.<extensão>`; arquivos são baixados com a sessão Auth, sem URL pública. A migration foi aplicada localmente sem reset. A função de autorização e a API de Storage foram testadas com permissão do profissional e negação fora do tenant.

**CONFIRMADO NO PRIMEIRO CICLO DE TREINO:** cinco migrations aditivas de 2026-10-01 foram aplicadas localmente sem reset. A primeira cria biblioteca, rascunhos, versões, atribuições, sessões e recibos; todas as seis tabelas têm RLS. A segunda cria bucket privado `exercise-videos` para MP4 até 25 MB; a terceira impede a exclusão de vídeo referenciado por versão publicada; a quarta cria `student_service_plans` com RLS e auditoria; a quinta valida que cada série enviada existe na prescrição e aparece uma só vez na sessão. O pgTAP isolado passou com 44 verificações e rollback, incluindo A/B, A1/A2, versão histórica, vídeo e idempotência. O plano de atendimento do aluno não altera `tenant_plans`.

**CONFIRMADO EM 2026-11-02:** `20261102000000_workout_prescription_details.sql` copia orientação geral e detalhes individuais do rascunho para o snapshot imutável e valida RIR opcional na sessão. `20261102010000_workout_review_gate.sql` bloqueia publicação quando `draft.reviewRequired = true`. Ambas foram aplicadas sem reset. Uma importação local autorizada criou inicialmente um rascunho de cinco dias e 36 exercícios no primeiro espaço; o ator profissional, o vínculo ativo, o plano vigente e o aluno foram conferidos na transação. O profissional publicou posteriormente a versão 1 com cinco dias e 36 exercícios, atribuída ao aluno. Os vídeos externos da referência não foram copiados.

**CONFIRMADO EM 2026-11-02, NAVEGAÇÃO POR DIA:** `20261102020000_workout_day_week_sessions.sql` adiciona `day_id` e `week_start` opcionais às sessões, índice por aluno/semana/dia, valida segunda-feira e impede séries de outro dia ou mudança do dia de uma sessão. Sessões antigas mantêm colunas nulas e continuam sincronizáveis pelo contrato anterior. `20261102030000_authorize_workout_day_before_lookup.sql` nega acesso antes de consultar identificadores da prescrição. Ambas foram aplicadas localmente sem reset; o pgTAP de treino passou com 58 verificações e rollback.

## Grupos de dados previstos

**CONFIRMADO EM 2026-11-02:** a migration `20261102040000_workout_cycle_and_execution.sql` acrescenta `PARTIAL` ao resultado terminal de `workout_sessions`, valida séries por repetições ou segundos com carga opcional, exige todas as séries prescritas para `COMPLETED` e permite início de semana alinhado a `snapshot.startsOn` em ciclos de `snapshot.durationWeeks`. Versões anteriores sem início de ciclo mantêm a segunda-feira de calendário. A RPC de publicação fixa `importantNote`, `startsOn`, `durationWeeks` e `targetKind` no snapshot imutável; não reescreve publicações anteriores. RLS e autorização por aluno/tenant permanecem. A migration seguinte `20261102050000_legacy_zero_reps_compat.sql` preserva o formato de repetições das operações antigas pendentes. O pgTAP passou com 68 verificações e rollback.

**CONFIRMADO EM 2026-11-02:** `20261102060000_preparation_tracking.sql` acrescenta `recordingStyle` (`SERIES`/`PREPARATION`) à publicação de novos snapshots e valida esse valor. O trigger de sessão rejeita `loadKg` e `rir` nas etapas de `PREPARATION` dessas versões; para snapshots antigos sem o campo, mantém a validação anterior. A migration foi aplicada no banco local sem reset nem republicação do treino existente.

**CONFIRMADO EM 2026-11-02:** `20261102070000_exercise_groups.sql` adiciona `muscle_group` obrigatório com valor inicial `OUTROS` e lista restrita de grupos a `exercise_library`, cria índice por tenant/grupo/nome e classifica inicialmente exercícios existentes por termos genéricos do nome. Os 36 exercícios do espaço local ficaram distribuídos em nove grupos, sem alterar `workout_plan_versions` ou sessões. O profissional pode corrigir qualquer classificação; RLS por tenant da tabela permanece.

**CONFIRMADO EM 2026-11-02:** `20261102080000_refine_exercise_group.sql` corrige a classificação inicial de crucifixo inverso para Ombros. `20261102090000_exercise_group_grants.sql` acrescenta `INSERT` e `UPDATE` somente para a coluna nova ao papel `authenticated`; `anon` não recebe grants, e as policies existentes continuam restringindo a escrita ao profissional do próprio tenant.

**CONFIRMADO EM 2026-11-02:** `20261102100000_live_exercise_media.sql` adiciona a RPC de leitura de mídia atual por aluno e versão atribuída e amplia a autorização de leitura do bucket privado para o MP4 atual de exercício prescrito. A migration não altera snapshots, atribuições, sessões nem dados de negócio; foi aplicada no Supabase local sem reset.

**PENDENTE:** ampliar execução, avaliação e contratos comerciais do aluno em migrations futuras. A primeira modelagem de biblioteca, prescrição/versões/atribuições e execução já existe; detalhes estão em `DOMAIN_MODEL.md`.

## Invariantes de modelagem

- **DECISÃO APROVADA:** dados privados pertencem a um tenant e são acessados pelo vínculo correto.
- **DECISÃO APROVADA:** identidade de exercício, versão e execução deve permanecer estável. Posição e nome não são chaves históricas.
- **DECISÃO APROVADA:** publicação é versionada; execução referencia a versão usada.
- **DECISÃO APROVADA:** escrita crítica admite ID de operação para evitar duplicidade.
- **HIPÓTESE:** constraints compostas incluirão o tenant nas referências sensíveis, além de RLS, para impedir relações cruzadas.
- **HIPÓTESE:** exclusão lógica ou status inativo preservará histórico conforme a política de retenção definida.

## Migrations

**CONFIRMADO:** migrations recebem prefixo temporal UTC. A primeira migration técnica permanece intacta; a Fase 3 usa migration nova. Em ambientes compartilhados, migrations aplicadas devem ser preservadas; uma alteração posterior cria nova migration.

## Backup e recuperação

**PENDENTE:** escolher plano Supabase, periodicidade, retenção, cópia de objetos do Storage e ensaio de restauração. Backup do banco e backup dos arquivos são necessidades distintas.

**CONFIRMADO NA CÓPIA DE TESTE (2026-11-02):** as 21 migrations atuais foram aplicadas ao Supabase Cloud de teste em São Paulo. Dados atuais de `public`, `auth.users` e `auth.identities` foram copiados preservando identificadores, vínculos, versões e sessões de treino; 4 hashes de senha e 4 e-mails confirmados estão presentes. Sessões/tokens de Auth não foram copiados. O único logotipo privado foi enviado ao bucket remoto e conferido por download e SHA-256. O backup local pré-cópia está em diretório temporário ignorado; não constitui política de backup de produção.

**NECESSITA VALIDAÇÃO HUMANA:** prazo de retenção e política de exclusão/exportação de dados pessoais.
