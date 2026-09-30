# Modelo de domínio inicial

Este documento distingue os conceitos aprovados do schema efetivamente criado até a Fase 3. Treino e execução ainda não têm schema.

## Identidade e isolamento

| Conceito | Responsabilidade | Estado |
|---|---|---|
| Plataforma | Operação do SaaS | DECISÃO APROVADA |
| Tenant | Organização isolada do cliente | DECISÃO APROVADA |
| Marca | Nome, cores, mídia e contato do tenant | DECISÃO APROVADA |
| Usuário Auth | `auth.users`: identidade e credenciais | CONFIRMADO |
| Perfil | `user_profiles`: dados comuns da própria pessoa, sem senha | CONFIRMADO |
| Vínculo | `tenant_memberships`: usuário, tenant, PROFISSIONAL/ALUNO e atividade | CONFIRMADO |
| Profissional | `professionals`: dados profissionais no tenant, vinculados à identidade | CONFIRMADO |
| Aluno | `students`: cadastro de acompanhamento, inicialmente sem `user_id`; observações em tabela separada | CONFIRMADO |
| SUPER_ADMIN | `platform_admins`: papel de plataforma sem acesso a dados privados do tenant | CONFIRMADO |
| Convite | `student_invitations`: hash de token, expiração e uso único | CONFIRMADO |
| Auditoria | `audit_events`: ator, tenant, ação, recurso e horário, sem payload | CONFIRMADO |

**Invariante:** usuário, profissional e aluno não são sinônimos. Uma pessoa pode ter mais de um vínculo. Nenhum vínculo dá acesso a outro tenant automaticamente.

**CONFIRMADO:** email do aluno é único por tenant sem distinguir maiúsculas/minúsculas; a conta do Auth só é associada após reivindicar um convite válido com o mesmo email confirmado. Profissional administra todos os alunos do tenant em que tem vínculo ativo; aluno lê apenas seu cadastro ativo. Inativar aluno ou profissional desativa o vínculo correspondente. Desativar perfil revoga todos os vínculos sem reativação automática posterior.

## Treino e execução

| Conceito | Responsabilidade | Estado |
|---|---|---|
| Exercício | Catálogo global ou particular do tenant | DECISÃO APROVADA |
| Plano de treino | Identidade durável do plano | HIPÓTESE de modelagem |
| Rascunho | Conteúdo editável antes de publicar | DECISÃO APROVADA |
| Versão publicada | Conteúdo imutável da prescrição | DECISÃO APROVADA |
| Dia do treino | Organização por divisão e ordem | DECISÃO APROVADA |
| Exercício prescrito | Exercício e instruções no dia | DECISÃO APROVADA |
| Série prescrita | Tipo, alvo de reps/tempo/carga e descanso, conforme necessidade | DECISÃO APROVADA |
| Atribuição | Versão destinada ao aluno e sua vigência | DECISÃO APROVADA |
| Sessão | Instância de treino iniciada pelo aluno | DECISÃO APROVADA |
| Exercício executado | Resultado feito, pulado ou parcial | DECISÃO APROVADA |
| Série executada | Carga ou placa, reps ou tempo, RIR opcional e conclusão | DECISÃO APROVADA |

**Invariante:** dia da divisão, data do calendário e sessão executada são conceitos diferentes. Séries executadas guardam referência à versão publicada ou cópia suficiente para interpretação histórica.

## Avaliação e sincronização

| Conceito | Responsabilidade | Estado |
|---|---|---|
| Avaliação | Data, profissional responsável e observações | DECISÃO APROVADA |
| Medida | Tipo, valor e unidade de peso/medida básica | DECISÃO APROVADA |
| Operação de sincronização | ID único, resultado idempotente e rastreio de erro | DECISÃO APROVADA |
| Evento de auditoria | Metadados das alterações de aluno, marca, notas e vínculo; publicação futura | CONFIRMADO para Fase 3 |

**PENDENTE:** cardinalidades, IDs, colunas e constraints de treino, execução e avaliação serão definidos nas migrations futuras.

**NECESSITA VALIDAÇÃO HUMANA:** conjunto preciso das medidas básicas e regras de autoria/retificação de avaliação.

## Conceitos adiados

**DECISÃO APROVADA:** dieta estruturada, fotos corporais, ranking, cobrança, chat e técnicas avançadas não entram no schema inicial. Uma extensão futura deverá preservar isolamento e autoria profissional.
