# Contratos da aplicação

**CONFIRMADO** — O cliente usa Data API com grants e RLS para contexto, alunos, marca, biblioteca, plano de atendimento, rascunho de treino e leituras autorizadas de versões, atribuições e sessões. Escritas compostas usam RPC. Downloads de marca e MP4 usam Storage autenticado. O servidor deriva o ator da sessão.

| Família | Operações e garantias |
|---|---|
| Plataforma | create_professional_tenant_invite, claim_professional_invite, list_platform_spaces e set_platform_space_plan criam/ativam espaço e administram acesso. |
| Aluno | create_student_invite e claim_student_invite vinculam cadastro e conta mediante convite individual. |
| Publicação de treino | publish_workout_plan valida rascunho e revisão, resolve exercícios, congela snapshot e cria atribuição atomicamente. A atribuição mais recente determina o treino atual. |
| Leitura | professional_workout_overview agrega indicadores; student_exercise_videos entrega mídia de exercícios e alternativas prescritos. A consulta atual de sessões limita o histórico geral a 80 linhas e a semana a 30. |
| Execução | sync_workout_day_session_v3 recebe ID de operação e sessão, versão, revisão, séries, estado, dia/semana, tempos, trocas e ocorrências. Reenvio idêntico é idempotente; conteúdo divergente ou revisão obsoleta pode conflitar. |
| Compatibilidade | O cliente seleciona sync_workout_day_session ou sync_workout_session para registros antigos sem o envelope moderno. A cadeia inclui sync_workout_day_session_v2. Preserve consumidores e operações já persistidas ao evoluir o contrato. |
| Nutrição | create_nutrition_invite, claim_nutrition_invite e nutrition_assign_self estabelecem autoria. nutrition_my_students, nutrition_student_status, nutrition_get_draft, nutrition_save_draft e nutrition_publish separam acompanhamento e conteúdo clínico. |
| Aluno na alimentação | nutrition_student_plan retorna a última versão com projeção autorizada. nutrition_log_meal valida aluno, versão, refeição, data e operation ID; nutrition_meal_day consulta o dia. A janela aceita registros de até 31 dias anteriores. |
| Diagnóstico | record_technical_operation confirma recibo técnico por usuário/operação. O diagnóstico usa a primeira membership ativa no envio. |

**PENDENTE** — Política de retry/backoff, recuperação de conflito, prazo de retenção dos recibos e distinção de erro transitório versus perda de autorização em todos os consumidores. Uma resposta vazia pode refletir RLS. Confira a [matriz](AUTHORIZATION.md) antes de alterar fallback de leitura.
