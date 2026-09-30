# ADR 0002 — PostgreSQL como fonte consolidada

- Data: 2026-09-29
- Status: **DECISÃO APROVADA**

## Contexto

Prescrições, versões, atribuições, sessões e avaliações possuem relações duráveis. Um aluno deve manter histórico mesmo após mudanças no treino ou no dispositivo.

## Decisão

PostgreSQL será a fonte consolidada dos dados de negócio. IndexedDB permite trabalho local e retém operações ainda não confirmadas; não substitui a autoridade do servidor. A referência em planilhas não será copiada como modelo de persistência.

## Alternativas consideradas

- Sheets como fonte principal: reduz setup, porém complica concorrência e integridade relacional.
- Somente armazenamento local: perde continuidade entre dispositivos e gestão profissional.

## Consequências

- Schema, migrations, constraints, RLS e backups serão parte do trabalho de implementação.
- Dados privados e históricos terão IDs estáveis, sem depender de nome ou posição na tela.
- **PENDENTE:** modelagem física, índices, retenção e estratégia de restauração.
