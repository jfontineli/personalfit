# ADR 0008 — Identidade, papéis e ativação de aluno

- Data: 2026-09-29
- Status: **CONFIRMADO** na implementação da Fase 3
- Complementa: [ADR 0003](0003-multi-tenancy.md)

## Contexto

O aluno pode ser cadastrado antes de ter conta, enquanto o profissional precisa administrar apenas os alunos do tenant autorizado. O papel de administração da plataforma não deve virar bypass de RLS.

## Decisão implementada

`auth.users` guarda identidade/credenciais; `user_profiles` guarda dados comuns da própria pessoa; `tenant_memberships` guarda papel e atividade por tenant; `professionals` e `students` guardam os perfis de domínio. Os papéis de tenant são `PROFISSIONAL` e `ALUNO`. `SUPER_ADMIN` fica em `platform_admins`, sem policy que conceda acesso a dados privados de tenant. Operações administrativas futuras exigirão contrato servidor e auditoria próprios.

O aluno nasce sem `user_id`. O profissional emite token aleatório; só o hash SHA-256 é persistido por 48 horas. Uma RPC associa conta Auth com email confirmado igual ao cadastro, cria vínculo ALUNO e consome o convite na mesma transação. Observações internas ficam em tabela separada para que a leitura do próprio cadastro não exponha texto profissional.

## Consequências

- Profissional ativo administra todos os alunos do próprio tenant nesta fase, sem atribuições individuais.
- Inativar aluno/profissional revoga seu vínculo; inativar o perfil revoga todos os vínculos sem reativação automática.
- Convite é entregue manualmente nesta fase; envio, reenvio e troca de email precisam de contrato posterior.
- A auditoria registra metadados da ação, sem copiar dados do aluno ou token.
