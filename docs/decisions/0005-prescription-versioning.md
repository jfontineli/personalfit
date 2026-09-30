# ADR 0005 — Prescrições publicadas versionadas

- Data: 2026-09-29
- Status: **DECISÃO APROVADA**

## Contexto

O profissional precisa ajustar treinos sem reescrever o significado de séries já realizadas. Um aluno pode executar offline uma versão enquanto outra é publicada.

## Decisão

Separar rascunho editável, publicação imutável, atribuição ao aluno e execução. A sessão guarda a versão com que começou. Editar/publicar uma versão nova não altera sessões e séries anteriores.

## Alternativas consideradas

- Sobrescrever prescrição atual: simples, mas compromete auditoria e interpretação do histórico.
- Guardar apenas texto livre da sessão: preserva parte do contexto, mas dificulta consultas e integridade.

## Consequências

- Publicação e atribuição precisam de operação controlada.
- Histórico poderá comparar sessões contra a prescrição vigente em cada data.
- **HIPÓTESE:** cada publicação receberá ID e número de versão por plano; o formato físico ainda não está definido.
- **PENDENTE:** regras de edição de rascunho, vigência e substituição de atribuições.
