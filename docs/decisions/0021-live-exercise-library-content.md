# ADR 0021 — Conteúdo atual da biblioteca na experiência ativa

- Data: 2026-11-09
- Status: **DECISÃO APROVADA; implementação publicada em TESTE e validada localmente**

## Contexto

Nome, instruções e vídeo descrevem o exercício reutilizável criado pelo personal. Corrigir esse conteúdo na biblioteca e depois republicar individualmente o treino de cada aluno cria trabalho repetitivo e mantém orientações incorretas em prescrições ativas. Séries, descanso, ordem, alternativas e observações individuais, por outro lado, pertencem à prescrição daquele aluno e precisam continuar versionados.

## Decisão

Na experiência ativa, o aluno autenticado consulta nome, instruções e vídeo atuais dos exercícios presentes na versão que lhe está atribuída. A consulta autorizada valida conta, vínculo ativo, tenant, aluno, versão atribuída e exercício principal ou alternativa aprovada. Editar esses campos na biblioteca alcança todos os alunos que usam o exercício sem nova publicação individual.

O snapshot publicado continua imutável e conserva nome, instruções e referência de mídia existentes na publicação. Uma sessão da versão atualmente atribuída usa o conteúdo compartilhado ao vivo enquanto estiver aberta. Quando uma nova publicação substitui essa atribuição, a sessão anterior passa a usar integralmente o snapshot da versão em que começou. Sessões concluídas ou encerradas parcialmente sempre usam o snapshot. Séries, descanso, ordem, estilo de registro, metas, alternativas e orientação adicional do aluno continuam vindo exclusivamente da versão publicada e exigem nova publicação para mudar.

Esta decisão amplia o ADR 0013, antes restrito à mídia atual, sem revogar o versionamento de prescrições do ADR 0005.

## Consequências

- corrigir a explicação geral de um exercício é uma única ação na biblioteca;
- a interface precisa distinguir instrução geral reutilizável de orientação adicional individual;
- o conteúdo atual depende de conexão; o snapshot permanece como fallback offline e fonte histórica;
- a RPC não expõe a biblioteca completa nem exercícios de outro aluno ou tenant.
- nome, instrução e vídeo seguem a mesma fonte em cada estado; a alternativa escolhida usa o conteúdo ao vivo somente na versão atual aberta.
