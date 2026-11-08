# ADR 0012 — Ciclo prescrito e execução parcial

## Estado

Aceita em 2026-11-02.

## Contexto

O aluno precisa entender a sequência de dias e semanas definida pelo personal. Uma sessão com séries faltantes não representa treino completo. Há versões publicadas antes desta decisão, organizadas por semana de calendário.

## Decisão

O personal informa data de início e duração em semanas ao publicar versões novas. Esses valores, a orientação essencial e a unidade de registro de cada exercício entram no snapshot imutável. Cada semana do ciclo começa na data de início mais múltiplos de sete dias. Versões anteriores conservam a regra de segunda-feira. O aluno registra repetições ou segundos por série, com carga opcional. `COMPLETED` exige todas as séries prescritas do dia; `PARTIAL` encerra a sessão com faltas e preserva os lançamentos. Ambos são terminais. Validação de unidade, período e completude ocorre no banco. Operações offline mantêm ID e versão para reenvio idempotente.

A prévia da experiência do aluno antes da publicação foi excluída desta rodada por decisão explícita do usuário.

## Consequências

Sessões e versões antigas não são alteradas ou retroativamente classificadas. A interface ainda não oferece repetição ou correção de dia concluído, placa, timer, frequência calculada nem histórico completo de todas as versões. A política de conflito entre aparelhos continua pendente.

## Complemento aprovado em 2026-11-07

`COMPLETED` e `PARTIAL` encerram um dia para fins de avanço da sequência. Quando todos os dias da semana lógica estão em um desses estados, a próxima semana do treino fica disponível imediatamente, sem depender da próxima segunda-feira civil. Planos com duração prescrita nunca avançam além da última semana; versões legadas sem duração avançam somente uma semana por vez e apenas após o encerramento de todos os dias. Semanas anteriores permanecem disponíveis somente para consulta.

A publicação de uma nova versão durante ou depois da semana não reinicia seu progresso. Sessões terminais de versões anteriores contam para encerrar a mesma sequência quando preservam os IDs dos dias; a semana seguinte começa com a versão atualmente atribuída. O histórico de cada sessão continua vinculado à versão efetivamente executada.
