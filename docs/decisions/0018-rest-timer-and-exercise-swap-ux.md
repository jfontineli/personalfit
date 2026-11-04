# ADR 0018 — Descanso visível e troca de exercício orientada pelo personal

Data: 2026-11-04. Status: **DECISÃO APROVADA; implementação no frontend confirmada**.

## Contexto

Na execução pelo celular, a contagem do descanso ficava no topo da página e desaparecia após o avanço para a próxima série. O fluxo sem alternativas mostrava “Avisar: aparelho indisponível”, ação que confundia a necessidade principal do aluno: trocar por uma opção equivalente.

## Decisão

- O tempo total do treino fica visível durante a execução e após a conclusão. A contagem regressiva do descanso aparece no mesmo painel fixo enquanto corre e mostra minutos e segundos. Ao terminar, mostra um aviso visual breve; som e vibração continuam sujeitos ao navegador.
- O aluno escolhe apenas as alternativas aprovadas pelo personal na prescrição publicada, antes da primeira série daquele exercício. A troca vale somente para a sessão do dia; o exercício principal permanece na prescrição.
- Quando não houver alternativa aprovada, a interface explica que o aluno deve combinar a troca com seu personal. Não apresenta um exercício como equivalente por inferência de grupo muscular e não cria um aviso de aparelho indisponível como substituto da troca.
- O contrato e os registros históricos de `exercise_issues` permanecem legíveis; esta alteração de interface não modifica migrations ou versões publicadas.

## Consequências

O personal precisa definir alternativas no editor e publicar uma nova versão para que apareçam ao aluno. Sessões já iniciadas continuam vinculadas à versão com que começaram. A verificação visual em celular real permanece necessária.
