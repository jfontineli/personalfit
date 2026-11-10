# ADR 0019 — Preparação simples e cardio prescrito

Data: 2026-11-04. Status: **DECISÃO APROVADA; implementação local confirmada**.

## Contexto

O aluno precisava digitar duração de cada etapa de um alongamento sem carga, embora desejasse apenas confirmar que o fez. O personal também não tinha uma forma clara de prescrever cardio no mesmo dia de treino.

## Decisão

- O personal escolhe, em cada item, entre séries com dados de execução e preparação sem carga. Alongamento com peso permanece como série. Preparação simples aparece ao aluno como uma ação para marcar o item como feito, sem inventar tempo, repetições, carga ou esforço; a sessão mantém as etapas prescritas como marcadores de conclusão.
- Cardio pertence à biblioteca do próprio personal, no grupo Cardio. Ele define uma meta em minutos no rascunho e publica uma nova versão; o aluno informa os minutos realizados. O registro usa segundos no contrato persistente, sem carga ou RIR.
- Versões já publicadas e sessões antigas não são reescritas. Alongamentos antigos sem carga e sem estilo explícito também admitem a marcação simples, mantendo os registros anteriores. A execução continua vinculada ao snapshot e à sessão do dia. Registros locais seguem na fila idempotente de sincronização.

## Consequências

O cardio é uma atividade prescrita individualmente, sem geração automática. O grupo da biblioteca organiza a escolha; não pressupõe equivalência para troca. A conclusão simples comprova o toque do aluno, não a duração nem a qualidade do alongamento. A evidência por ambiente fica em [infraestrutura](../projeto/INFRASTRUCTURE.md).
