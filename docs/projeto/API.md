# Contratos de API

**CONFIRMADO:** Supabase Auth valida login/logout/renovação/sessão e a RPC técnica `record_technical_operation(p_tenant_id, p_operation_id) → boolean`; `true` significa primeiro recibo, `false` significa repetição. O banco valida vínculo ativo por RLS. A fila IndexedDB envia manualmente apenas IDs de operações técnicas para essa RPC e marca confirmação local após a resposta.

**CONFIRMADO NA FASE 3:** `apps/web/src/services/business.ts` concentra consultas e mutações das tabelas de identidade, tenant, aluno e marca. `listMemberships` e `listTenants` resolvem o contexto visível ao usuário; o tenant selecionado é filtro, jamais autoridade. `createStudent`, `updateStudent`, `listStudents`, `getStudent` e `updateBrand` usam grants de coluna e RLS. Observações internas ficam em tabela e chamadas próprias, invisíveis ao aluno. `create_student_invite(p_student_id, p_token_hash) → timestamptz` registra somente o hash e devolve expiração; `claim_student_invite(p_token) → student_id` verifica hash, prazo, uso e email Auth confirmado, e associa identidade/vínculo atomicamente. Ambas são funções privilegiadas com verificações explícitas; apenas a última liga `user_id` ao aluno. A Fase 3 permitia ao titular ver seu papel em `platform_admins`, sem operação administrativa; o onboarding local acrescentou somente a criação auditada de tenant/convite.

**CONFIRMADO NO ONBOARDING LOCAL:** `create_professional_tenant_invite(p_tenant_name, p_professional_name, p_professional_email, p_token_hash) → {tenant_id, expires_at}` exige superadmin e perfil ativos; cria tenant, marca inicial, convite e auditoria atomicamente. `claim_professional_invite(p_token) → tenant_id` exige conta Auth com email confirmado igual ao convite; cria vínculo/perfil profissional e consome o convite uma vez. O frontend recebe somente chave pública. O superadmin não ganha leitura dos dados do tenant.

**CONFIRMADO NA GESTÃO DA PLATAFORMA:** `list_platform_spaces() → espaços e primeiro profissional` e `set_platform_space_plan(tenant_id, tipo, data_final, ativo)` exigem superadmin e perfil ativos. A segunda RPC audita a alteração. `tenant_access_allowed(tenant_id)` aplica o estado do plano em RLS e nas RPCs de convite. Tipo de plano é `AVALIACAO`, `MENSAL` ou `ANUAL`; data final nula significa prazo indeterminado. Não existe API de cobrança.

**CONFIRMADO PARA LOGOTIPOS:** `uploadBrandLogo`, `downloadBrandLogo` e `removeBrandLogo` usam a API do bucket privado `brand-logos`; `tenant_brand.logo_url` guarda o caminho do objeto, não uma URL pública. O frontend limita seleção a PNG/JPEG/WebP até 2 MB; o bucket repete esses limites e as policies de Storage conferem tenant, vínculo, papel e plano. `updateBrand` salva o caminho após upload bem-sucedido.

**CONFIRMADO NO PRIMEIRO CICLO DE TREINO:** `services/workouts.ts` consulta e grava biblioteca, rascunho e plano de atendimento do aluno sob RLS. `publish_workout_plan(plan_id) → version_id` valida profissional e aluno ativo, resolve exercícios do tenant e publica snapshot imutável com atribuição. `sync_workout_session(operation_id, session_id, version_id, revision, entries, status) → boolean` aceita as revisões da sessão atribuída ao aluno ativo, grava recibo e retorna `false` para reenvio idêntico; operação com mesmo ID e payload diferente gera conflito. A versão de uma sessão já iniciada é fixa. O primeiro envelope de série contém `itemId`, `setNumber`, `reps` e `loadKg`; a fila local conserva o ID e a revisão até confirmação remota.

**CONFIRMADO EM 2026-11-02:** o rascunho aceita `guidance` no plano e `notes`, `restSeconds` e `setLabels` por exercício; a RPC de publicação valida tamanho, contagem e valores e congela esses campos no snapshot. `reviewRequired = true` impede publicação no banco até revisão do profissional. A entrada de sessão aceita `rir` inteiro opcional de 0 a 10, validado no servidor e gravado com a mesma operação idempotente.

**CONFIRMADO NA EXECUÇÃO POR DIA:** `sync_workout_day_session(operation_id, session_id, version_id, revision, entries, status, day_id, week_start) → boolean` usa a autorização e a idempotência da RPC anterior, mas exige que `day_id` pertença à versão e que todas as entradas sejam desse dia. `week_start` é a segunda-feira da semana de calendário. O cliente mantém operações antigas na RPC anterior; sessões novas guardam dia e semana no IndexedDB e no banco. A ordem dos dias é a ordem do snapshot publicado, definida pelo personal no rascunho.

**CONFIRMADO PARA VÍDEOS:** o profissional envia MP4 ao bucket privado `exercise-videos` em caminho `<tenant>/<exercício>/<arquivo>.mp4`; `exercise_library.video_url` guarda `storage:<caminho>`. O aluno atribuído baixa a mídia somente quando pede reprodução online. Outro aluno ou tenant não recebe autorização pelo caminho. Vídeo publicado permanece protegido contra exclusão.

## Contratos necessários

| Operação | Responsável | Estado |
|---|---|---|
| Resolver contexto autorizado do tenant | Vínculos ativos + RLS | CONFIRMADO |
| Cadastrar/editar/inativar aluno | Service do frontend + RLS/grants | CONFIRMADO |
| Convidar e ativar aluno | RPCs com hash, expiração e uso único | CONFIRMADO |
| Criar tenant/convidar personal e ativar acesso profissional | RPCs transacionais com autorização e uso único | CONFIRMADO localmente |
| Consultar biblioteca própria e cadastrar/editar exercício, instrução e vídeo | Biblioteca + Storage privado | CONFIRMADO primeiro ciclo |
| Criar/alterar rascunho | Prescrição + RLS | CONFIRMADO primeiro ciclo |
| Publicar versão e atribuir ao aluno | RPC transacional | CONFIRMADO primeiro ciclo |
| Obter versão atribuída | Leitura autorizada + cache local | CONFIRMADO primeiro ciclo |
| Enviar operações de sessão/revisão | RPC idempotente | CONFIRMADO primeiro ciclo; lote pendente |
| Consultar sessões/histórico/frequência | Execução | Sessões recentes CONFIRMADAS para o personal; histórico detalhado/frequência PENDENTES |
| Registrar e consultar avaliação básica | Avaliação | PENDENTE |
| Ler marca e contato do tenant | Vínculo ativo + RLS | CONFIRMADO |
| Enviar/ler/remover logotipo do espaço | Storage privado + policies por tenant | CONFIRMADO localmente |

## Envelope de sincronização

**CONFIRMADO EM 2026-11-02:** `sync_workout_day_session` aceita, dentro de `entries`, uma medida por série: `reps` (1–999) ou `durationSeconds` (1–3600), conforme o item publicado. `loadKg` e `rir` são opcionais. `status` pode ser `IN_PROGRESS`, `COMPLETED` ou `PARTIAL`; os dois últimos encerram a sessão. `COMPLETED` em sessão com dia exige todas as séries prescritas. `week_start` passa a ser o início da semana do ciclo quando `snapshot.startsOn` existe, e continua segunda-feira nas versões legadas. A mesma `operationId` continua idempotente; nenhuma chave privilegiada vai ao cliente.

**CONFIRMADO EM 2026-11-02:** itens novos aceitam `recordingStyle: 'SERIES' | 'PREPARATION'` no rascunho e no snapshot. Em `PREPARATION`, cada entrada de execução usa `reps` ou `durationSeconds` conforme `targetKind`, sem `loadKg` nem `rir`; o banco rejeita esses campos mesmo em chamada direta. O formato e a interpretação de versões antigas sem `recordingStyle` não são alterados.

**CONFIRMADO EM 2026-11-02:** `listExercises`, `createExercise`, `updateExercise` e o retorno de `uploadExerciseVideo` incluem `muscle_group` do catálogo do tenant. A categoria serve a busca e organização do profissional; publicação continua resolvendo o exercício do tenant e congelando o conteúdo prescrito, sem depender do grupo. `video_url` continua opcional.

**CONFIRMADO EM 2026-11-02:** `exercise_library.video_url` também pode conter URL HTTPS normalizada do YouTube. `updateExercise` salva metadados e URL ou remoção em uma atualização; `uploadExerciseVideo` pode atualizar metadados junto à referência do MP4 após o upload. O formulário oferece uma fonte por vez. O snapshot publicado conserva o endereço anterior mesmo quando a biblioteca é editada.

**CONFIRMADO EM 2026-11-02:** `student_exercise_videos(p_student_id, p_version_id)` devolve apenas `exercise_id` e `video_url` atuais dos exercícios da versão atribuída ao aluno autenticado, sob validação de vínculo, tenant, estado e papel. A interface consulta ao abrir/retomar online e usa o resultado somente para exibir mídia; não substitui o snapshot nem altera sessões. A política do Storage também permite ao aluno atribuído ler o MP4 atual do exercício, mantendo a proteção dos arquivos citados no histórico.

**DECISÃO APROVADA:** toda operação crítica tem ID único e resultado idempotente. A resposta precisa permitir que o cliente distinga confirmação, falha transitória, falha permanente e conflito. A confirmação remota é por operação, mesmo quando o envio for em lote.

**HIPÓTESE:** o contrato incluirá `operationId`, `operationType`, `schemaVersion`, ID estável do recurso, versão-base quando aplicável e payload validado. O servidor obterá usuário e permissões da sessão; qualquer referência de tenant fornecida no payload será apenas contexto a verificar, nunca autorização.

## Erros e concorrência

**DECISÃO APROVADA:** reenvio do mesmo ID não cria execução duplicada. O cliente preserva operação pendente até receber confirmação válida. Publicação posterior não muda a versão da sessão em andamento.

**PENDENTE:** definir formato JSON, status/códigos, tamanho máximo de lote, ordem de dependências, prazo de retenção dos IDs de idempotência, regras de conflito entre dispositivos e política de compatibilidade entre versões da PWA e da API.

**NECESSITA VALIDAÇÃO HUMANA:** comportamento desejado quando um aluno é inativado enquanto possui operações feitas offline ainda pendentes.
