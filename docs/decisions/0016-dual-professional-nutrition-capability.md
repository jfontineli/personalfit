# ADR 0016 — Personal que também atua como nutricionista

- Data: 2026-11-03
- Status: **DECISÃO APROVADA**; fluxo local **CONFIRMADO**; verificação profissional humana **PENDENTE**

## Contexto

O ADR 0015 separou a autoria da prescrição alimentar do papel de personal. O primeiro modelo admitia somente um papel por conta e espaço. O usuário esclareceu que o mesmo profissional pode exercer as duas funções.

## Decisão

A conta mantém o vínculo `PROFISSIONAL` e pode receber uma capacidade clínica adicional por registro em `nutritionists` e atribuição individual em `nutrition_assignments`. Não há segunda conta nem promoção automática de todo personal. O personal pode assumir explicitamente o acompanhamento nutricional de um aluno sem nutricionista ativo, informando seu CRN, ou aceitar convite de outro personal. A prescrição continua identificada pelo usuário autor e restrita aos alunos atribuídos. O registro informado não equivale a verificação profissional; esta exige conferência humana antes de atendimento real.

Esta decisão complementa o ADR 0015: a autoria continua sendo do nutricionista, mesmo quando a mesma pessoa também é o personal.

## Consequências

- **CONFIRMADO localmente:** uma membership `PROFISSIONAL` permanece intacta após atribuição ou convite nutricional; RPCs clínicas exigem também `nutritionists` e atribuição ativa ao aluno.
- **CONFIRMADO localmente:** a aba Alimentação oferece “Sou nutricionista” e editor do plano do aluno após vínculo; a rota `/nutricionista` também atende uma conta com os dois papéis.
- **PENDENTE:** verificação humana do CRN, troca/revogação de atribuição e política de compartilhamento de registros alimentares.
