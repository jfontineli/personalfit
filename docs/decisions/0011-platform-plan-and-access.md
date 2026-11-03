# ADR 0011 — Gestão simples de plano e acesso por espaço

- Data: 2026-09-30
- Status: **CONFIRMADO** na implementação local
- Complementa: [ADR 0010](0010-platform-onboarding.md)

## Contexto

A criação por convite deixava o superadmin sem visão dos espaços cadastrados, do primeiro profissional e da vigência de acesso. A plataforma precisa suspender ou renovar um espaço sem apagar alunos ou conceder ao administrador acesso aos dados privados.

## Decisão

Cada espaço possui um registro administrativo de plano, com tipo `AVALIACAO`, `MENSAL` ou `ANUAL`, estado ativo e data final opcional. Novos espaços começam em avaliação por 30 dias; os espaços anteriores à migration recebem acesso ativo sem data final para preservar o estado local. Os tipos são categorias de acesso, sem preço, cobrança, renovação automática ou limites de uso.

O superadmin lista espaços e o primeiro profissional, altera tipo/prazo e suspende ou reativa por RPCs verificadas e auditadas. O painel não lista alunos nem concede leitura dos dados privados. RLS restritiva e validações das RPCs de convite negam acesso ao espaço suspenso ou vencido; a reativação preserva vínculos e histórico.

## Consequências

- A conta Auth continua existindo quando o espaço é suspenso; o usuário pode autenticar, mas não acessar seus dados do espaço.
- A data final vale até o fim do dia em `America/Sao_Paulo`; data vazia significa prazo indeterminado.
- **PENDENTE:** catálogo comercial, cobrança, pagamentos, renovação, avisos de vencimento, múltiplos profissionais por espaço e gestão detalhada de usuários.
