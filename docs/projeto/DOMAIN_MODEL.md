# Modelo de domínio inicial

**CONFIRMADO EM 2026-11-04:** `WorkoutDraft` pode conter orientações complementares individualizadas e etapas estruturadas de cardio; `WorkoutVersion` congela ambas na publicação. A execução usa a versão atribuída e não modifica a prescrição. No treino do Jean, a nova versão inclui cardio nos cinco dias e a versão antiga continua disponível no histórico.

**CONFIRMADO LOCALMENTE EM 2026-11-04:** o item prescrito tem estilo `SERIES`, `PREPARATION` ou `CARDIO`. Preparação simples preserva as etapas no snapshot, mas o aluno marca o item como feito em um toque; cada etapa recebe somente um marcador de conclusão. O alongamento com carga usa `SERIES`. Cardio usa exercício da biblioteca do personal, meta em minutos e duração realizada em segundos. Nenhum destes registros reescreve versões já publicadas.

Este documento distingue os conceitos aprovados do schema efetivamente criado. A base de identidade e o primeiro ciclo de treino/execução possuem migrations; funcionalidades posteriores permanecem conceituais.

**CONFIRMADO EM 2026-10-01:** o primeiro schema de treino já existe nas migrations `20261001000000` a `20261001040000`. A tabela conceitual abaixo continua indicando o escopo aprovado; parte da execução avançada e da avaliação segue pendente.

**CONFIRMADO EM 2026-11-02:** o rascunho e o snapshot publicado agora distinguem orientação geral, observação individual do exercício, descanso e rótulo de cada série. A sessão aceita RIR opcional por série. Um rascunho importado pode exigir revisão profissional antes de permitir publicação; isso não substitui a autoria e responsabilidade do profissional.

**CONFIRMADO EM 2026-11-02:** cada item do rascunho pode declarar `recordingStyle` como `SERIES` ou `PREPARATION`. A publicação fixa esse estilo na versão. `PREPARATION` representa etapas de tempo ou repetições sem carga e RIR; versões anteriores sem o campo permanecem imutáveis, com apresentação de alongamentos legados como preparação na interface.

**CONFIRMADO EM 2026-11-02:** `exercise_library.muscle_group` identifica um grupo principal organizacional do exercício do profissional. O campo pode ser alterado no catálogo; não determina prescrição, acesso ou histórico e não modifica snapshots publicados. Vídeo e instruções continuam opcionais na biblioteca.

## Identidade e isolamento

| Conceito | Responsabilidade | Estado |
|---|---|---|
| Plataforma | Operação do SaaS | DECISÃO APROVADA |
| Tenant | Organização isolada do cliente | DECISÃO APROVADA |
| Marca | Nome, foto/logo, cores e contatos próprios do profissional no tenant | DECISÃO APROVADA |
| Usuário Auth | `auth.users`: identidade e credenciais | CONFIRMADO |
| Perfil | `user_profiles`: dados comuns da própria pessoa, sem senha | CONFIRMADO |
| Vínculo | `tenant_memberships`: usuário, tenant, PROFISSIONAL/ALUNO e atividade | CONFIRMADO |
| Profissional | `professionals`: dados profissionais no tenant, vinculados à identidade | CONFIRMADO |
| Aluno | `students`: cadastro de acompanhamento, inicialmente sem `user_id`; observações em tabela separada | CONFIRMADO |
| SUPER_ADMIN | `platform_admins`: papel de plataforma sem acesso a dados privados do tenant | CONFIRMADO |
| Convite profissional | Tenant, email, nome e hash de token para ativação do primeiro personal | CONFIRMADO |
| Convite | `student_invitations`: hash de token, expiração e uso único | CONFIRMADO |
| Auditoria | `audit_events`: ator, tenant, ação, recurso e horário, sem payload | CONFIRMADO |

**Invariante:** usuário, profissional e aluno não são sinônimos. Uma pessoa pode ter mais de um vínculo. Nenhum vínculo dá acesso a outro tenant automaticamente.

**CONFIRMADO:** email do aluno é único por tenant sem distinguir maiúsculas/minúsculas; a conta do Auth só é associada após reivindicar um convite válido com o mesmo email confirmado. Profissional administra todos os alunos do tenant em que tem vínculo ativo; aluno lê apenas seu cadastro ativo. Inativar aluno ou profissional desativa o vínculo correspondente. Desativar perfil revoga todos os vínculos sem reativação automática posterior.

**CONFIRMADO:** um superadmin cria o tenant e convite, mas não se torna membro dele. O primeiro profissional cria ou usa sua conta Auth e reivindica o convite; somente então surgem `tenant_memberships` e `professionals` para esse tenant.

## Treino e execução

| Conceito | Responsabilidade | Estado |
|---|---|---|
| Exercício | Item criado pelo profissional na biblioteca do tenant; eventual catálogo global é auxiliar | DECISÃO APROVADA |
| Instrução e vídeo próprios | Conteúdo do profissional associado ao exercício e disponível ao aluno autorizado | DECISÃO APROVADA |
| Plano de treino | Identidade durável do plano | HIPÓTESE de modelagem |
| Rascunho | Conteúdo editável antes de publicar | DECISÃO APROVADA |
| Versão publicada | Conteúdo imutável da prescrição | DECISÃO APROVADA |
| Dia do treino | Organização por divisão e ordem | DECISÃO APROVADA |
| Exercício prescrito | Exercício e instruções no dia | DECISÃO APROVADA |
| Série prescrita | Tipo, alvo de reps/tempo/carga e descanso, conforme necessidade | DECISÃO APROVADA |
| Atribuição | Versão destinada ao aluno e sua vigência | DECISÃO APROVADA |
| Sessão | Instância de treino iniciada pelo aluno | DECISÃO APROVADA |
| Dia e semana da sessão | Dia da versão publicada; início da semana do ciclo definido pelo personal, ou segunda-feira nas versões legadas; sessões antigas podem não ter esses campos | CONFIRMADO localmente |
| Exercício executado | Resultado feito, pulado ou parcial | DECISÃO APROVADA |
| Série executada | Carga ou placa, reps ou tempo, RIR opcional e conclusão | DECISÃO APROVADA |

**Invariante:** dia da divisão, data do calendário e sessão executada são conceitos diferentes. Séries executadas guardam referência à versão publicada ou cópia suficiente para interpretação histórica. A versão preserva os exercícios e as orientações efetivamente prescritos, mesmo após alterações na biblioteca do profissional. O treino é criado pelo profissional; não há sugestão nem geração automática no MVP.

**CONFIRMADO NO SCHEMA ATUAL:** `exercise_library` guarda exercício/instruções e referência de vídeo; `workout_plans.draft` organiza dias, itens, início e duração; `workout_plan_versions.snapshot` fixa o conteúdo publicado; `workout_assignments` mantém versões atribuídas; `workout_sessions` guarda revisão, séries, resultado completo ou parcial e versão usada. O plano de atendimento do aluno (`student_service_plans`) é distinto do plano SaaS do tenant. Uma série executada contém repetições ou segundos, carga opcional e RIR opcional. Placa, pulo de exercício e frequência calculada permanecem pendentes.

## Avaliação e sincronização

| Conceito | Responsabilidade | Estado |
|---|---|---|
| Avaliação | Data, profissional responsável e observações | DECISÃO APROVADA |
| Medida | Tipo, valor e unidade de peso/medida básica | DECISÃO APROVADA |
| Operação de sincronização | ID único, resultado idempotente e rastreio de erro | DECISÃO APROVADA |
| Evento de auditoria | Metadados das alterações de aluno, marca, notas e vínculo; publicação futura | CONFIRMADO para Fase 3 |

**PENDENTE:** ampliar o contrato de execução, avaliações e regras comerciais do plano do aluno; revisar cardinalidades e limites conforme uso real.

**NECESSITA VALIDAÇÃO HUMANA:** conjunto preciso das medidas básicas e regras de autoria/retificação de avaliação.

## Conceitos adiados

**DECISÃO APROVADA:** dietas e acompanhamento pertencem à visão do produto, com isolamento por tenant. Conforme os ADRs 0015 e 0016, a prescrição alimentar individual tem autoria e publicação de nutricionista autorizado para o aluno; o personal pode ser esse nutricionista mediante atribuição individual. Fotos corporais do aluno, ranking, cobrança, chat e técnicas avançadas continuam adiados. Foto de perfil e logo do profissional são mídia de identidade, não fotos corporais do aluno.

**CONFIRMADO LOCALMENTE EM 2026-11-03:** o schema contém `nutritionists`, `nutrition_assignments`, `nutrition_invitations`, `nutrition_plans`, `nutrition_plan_versions` e `nutrition_meal_events`. Uma versão publicada congela refeições, opções e orientações. Um lançamento do aluno referencia a versão e o ID estável da refeição, não a posição do cartão. O personal não lê o rascunho ou o snapshot nutricional.
**CONFIRMADO LOCALMENTE — DUPLA ATUAÇÃO:** uma pessoa pode ter vínculo `PROFISSIONAL` e capacidade de nutricionista no mesmo tenant. A capacidade é representada por `nutritionists` e por `nutrition_assignments` por aluno, sem segunda conta. A autoria de cada versão continua sendo o usuário nutricionista, inclusive quando ele também é o personal. Ver ADR 0016.

**CONFIRMADO LOCALMENTE — DIETA EM CICLOS:** o rascunho pode classificar refeições como `ALTO`, `BAIXO` ou comum a ambos. A escolha diária do ciclo fica como preferência local do aluno; o sistema não a infere da data. O rascunho individual importado preserva contexto de origem privado e um sinal de revisão clínica. Nenhuma versão desse rascunho foi publicada.

**CONFIRMADO LOCALMENTE — INFORMAÇÕES INDIVIDUAIS:** `sourceImport.rows` guarda o texto original privado; `individualNotes` guarda a cópia editável por aluno. A nota tem ID estável e visibilidade explícita. O snapshot publicado contém apenas notas visíveis ao aluno e nunca inclui a fonte importada. Editar o rascunho depois da confirmação reabre a revisão clínica.

**CONFIRMADO LOCALMENTE — ALTERNATIVA NA EXECUÇÃO:** o item publicado contém o exercício principal e alternativas autorizadas. A sessão de um dia guarda `exercise_swaps[itemId]` para a alternativa efetivamente escolhida e `exercise_issues[itemId]` para aparelho indisponível; ambos pertencem à execução, não ao plano. `PAUSED` preserva a execução em curso e o tempo ativo acumulado; `PARTIAL` e `COMPLETED` são terminais. O histórico continua vinculado à versão usada no início, conforme ADR 0017.
