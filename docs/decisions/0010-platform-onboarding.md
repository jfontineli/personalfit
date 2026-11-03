# ADR 0010 — Entrada de profissionais pela plataforma

- Data: 2026-09-30
- Status: **CONFIRMADO** na implementação local
- Complementa: [ADR 0008](0008-identity-roles-invitations.md) e [ADR 0009](0009-professional-centric-white-label.md)

## Contexto

O fluxo do produto começa na plataforma: o superadmin habilita um personal, e esse personal cadastra e convida seus alunos. Contas criadas diretamente por ferramenta administrativa serviam apenas aos testes locais e não representavam a experiência prevista.

## Decisão

O superadmin autenticado cria um tenant com identidade inicial e emite convite para o primeiro profissional. O profissional cria ou usa sua própria conta Auth, confirma o email e consome o convite de uso único. A ativação cria vínculo `PROFISSIONAL` e perfil profissional no tenant. Depois, o profissional usa o cadastro e convite de aluno já implementados.

As operações de criação e ativação são RPCs transacionais com verificações explícitas. Apenas o hash SHA-256 do token fica no banco; o link é exibido uma vez para entrega manual. O papel de superadmin não concede leitura ou alteração de dados privados do tenant.

## Consequências

- Cada personal pode receber um tenant e marca próprios na mesma plataforma; a referência funcional em `referencia/` orienta a experiência sem fornecer código, marca ou modelo de persistência.
- A primeira entrega usa convite manual, sem envio de email pela plataforma nem senha definida pelo superadmin.
- **PENDENTE:** MFA administrativo, limites e proteção operacional, reenvio/cancelamento de convite, gestão posterior de profissionais e política comercial de criação de tenants.
