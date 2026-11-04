# ADR 0017 — Execução guiada, pausa e troca aprovada de exercício

Data: 2026-11-03. Status: **DECISÃO APROVADA; implementação local confirmada**.

## Contexto

O treino prescrito deve continuar sob autoria do personal. Na academia, um aparelho pode estar indisponível; o aluno também precisa registrar séries com pouco esforço de navegação, descansar no tempo orientado e retomar um treino interrompido. O ADR 0012 tratou `PARTIAL` como encerramento terminal; isso permanece válido.

## Decisão

- O personal escolhe até cinco alternativas para cada exercício no rascunho individual. A publicação congela exercício principal e alternativas da mesma biblioteca do tenant.
- O aluno só pode escolher uma alternativa aprovada antes de registrar a primeira série do exercício. A escolha pertence à sessão daquele dia. A versão prescrita e os demais dias continuam com o exercício principal. O histórico guarda a versão, o item principal e o ID da alternativa executada.
- Se não houver alternativa, o aluno pode registrar `APARELHO_INDISPONIVEL` para o personal. Esse aviso pertence à sessão e segue a mesma fila offline e autorização da execução.
- `PAUSED` preserva a sessão para retomada; `PARTIAL` encerra definitivamente um dia incompleto. O relógio soma tempo ativo e exclui o intervalo pausado. Os tempos de início, fim e duração são metadados da sessão.
- Após registrar uma série, o descanso prescrito aparece em contagem regressiva. Som e vibração são tentados quando o navegador permitir. A interface mostra a série seguinte e abre automaticamente o próximo exercício quando o atual termina.
- Referências opcionais de carga e repetições que sobrariam são editadas pelo personal e congeladas na versão publicada. O aluno vê essas referências e a última carga registrada, sem preenchimento automático do seu resultado.
- A sequência de dias pode ser feita em qualquer dia da semana vigente; a interface não pressupõe que o aluno treinou no dia civil anterior. Sessões encerradas permanecem no histórico. Repetição do mesmo dia na mesma semana exige decisão futura.

## Consequências

As migrations `20261103070000` a `20261103110000` são aditivas, com RPC versionada e compatibilidade das operações antigas. A validação de tenant, aluno ativo, versão, dia e alternativa é feita no banco. A mídia atual da alternativa aprovada segue a autorização privada da versão atribuída; a migration `110000` corrige a validação de caminho MP4 da `100000` já aplicada. Nenhum dado da referência proprietária foi incorporado. O áudio depende das permissões e políticas do navegador; a indicação visual sempre permanece.
