# Modelo de domínio

| Conceito | Identidade e relações implementadas |
|---|---|
| Plataforma e espaço | A plataforma administra tenants e planos de acesso. O tenant identifica a operação white-label com marca, equipe e alunos. |
| Conta e vínculo | Auth identifica a pessoa. O perfil representa a conta na aplicação. Membership relaciona usuário, tenant, papel e estado. Superadmin é um registro de plataforma separado. |
| Profissional e aluno | O profissional atua no espaço. O cadastro do aluno pode preceder a conta; a ativação liga o cadastro à identidade. Notas internas e plano de atendimento pertencem ao contexto individual. |
| Biblioteca | Exercício, grupo, instrução geral e mídia pertencem ao tenant. A biblioteca serve aos profissionais autorizados no mesmo espaço. Agrupamento muscular organiza busca. |
| Prescrição | Um plano individual tem rascunho. A publicação congela dias, ordem, exercícios, séries, metas, descanso, alternativas, guias e cardio em versão com autoria e atribuição. |
| Execução | Sessão registra versão, dia prescrito, semana, revisão, séries realizadas, tempo, troca e resultado. Dia da divisão, data de calendário e sessão são conceitos distintos. |
| Alimentação | Registro do nutricionista e atribuição ao aluno delimitam autoria. Rascunho, versões publicadas, notas individuais e eventos de refeição têm escopo clínico próprio. |
| Acompanhamento | O personal consulta indicadores e sessões do espaço. Auditoria registra metadados de ações selecionadas. |

**DECISÃO APROVADA · implementação publicada em TESTE e validada localmente** — A versão preserva o conteúdo da publicação. A experiência aberta da versão atual atribuída pode apresentar nome, instruções gerais e vídeo atuais da biblioteca sem reescrever o snapshot. Sessões terminais ou de versão anterior usam os três campos do snapshot, e séries executadas conservam a versão original. [ADR 0021](../decisions/0021-live-exercise-library-content.md)

**PENDENTE** — Modelo versionado de anamnese, medidas e frequência consolidada. Consulte [contexto](PROJECT_CONTEXT.md) e [autorização](AUTHORIZATION.md).
