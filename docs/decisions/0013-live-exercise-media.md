# ADR 0013 — Mídia atual da biblioteca em treinos publicados

- Data: 2026-11-02
- Status: **DECISÃO APROVADA**

## Contexto

O vídeo de instrução pertence ao exercício criado pelo personal e pode ser usado por vários alunos. Exigir uma publicação individual para cada correção ou inclusão de vídeo torna a manutenção da biblioteca impraticável. As versões de treino, por outro lado, preservam séries, ordem, instruções e orientações específicas do aluno.

## Decisão

Ao abrir o treino com internet, o aluno autorizado consulta a mídia atual dos exercícios presentes em sua versão atribuída. A consulta é feita no servidor com identidade, vínculo ativo, tenant, aluno, versão atribuída e exercício específico. Um MP4 próprio permanece no bucket privado; links externos abrem online. Adicionar, trocar ou retirar vídeo na biblioteca é refletido na próxima consulta, inclusive em uma sessão em andamento, sem republicar o plano para cada aluno.

O snapshot publicado continua imutável e guarda a referência de mídia existente na publicação para auditoria. Séries, ordem, nome, instruções e orientações prescritas continuam vindos do snapshot e a sessão mantém sua versão. Mudanças específicas do aluno exigem nova publicação para aquele aluno. Vídeos não integram o pacote offline; a prescrição e os lançamentos locais continuam disponíveis sem rede.

Este ADR ajusta somente a regra de **exibição da mídia atual** do [ADR 0009](0009-professional-centric-white-label.md). Preserva o versionamento da prescrição definido no [ADR 0005](0005-prescription-versioning.md) e no [ADR 0012](0012-workout-cycle-and-partial-execution.md).

## Consequências

- Uma atualização de vídeo na biblioteca alcança os alunos que têm o exercício prescrito, sem uma publicação por aluno.
- O histórico de prescrições ainda contém o endereço da mídia na época; uma futura tela de histórico deverá distinguir mídia atual de mídia histórica e sua política de retenção.
- A consulta de mídia não concede leitura da biblioteca completa ao aluno nem acesso a exercícios de outros alunos ou tenants.
