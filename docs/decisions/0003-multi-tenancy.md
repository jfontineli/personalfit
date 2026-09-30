# ADR 0003 — Multi-tenancy desde o primeiro incremento

- Data: 2026-09-29
- Status: **DECISÃO APROVADA**

## Contexto

O primeiro personal é apenas o primeiro cliente. Profissionais e alunos de tenants diferentes não podem ver ou alterar dados uns dos outros.

## Decisão

Modelar tenant, usuário, vínculo, papel, profissional e aluno separadamente. Toda operação privada valida usuário → vínculo → tenant → papel → recurso. `tenant_id` vindo do frontend não é autorização. Usar RLS onde aplicável e testar com Tenant A e Tenant B desde o início.

## Alternativas consideradas

- Uma instalação por profissional: simplifica isolamento, mas multiplica operação e dificulta o SaaS inicial.
- Estrutura para um único personal com adaptação futura: posterga riscos centrais e torna migração cara.

## Consequências

- Todas as relações privadas, arquivos, contratos e testes precisam contemplar tenant.
- Políticas devem negar acesso por padrão e impedir referências cruzadas.
- **HIPÓTESE:** iniciar com schema compartilhado e `tenant_id` nas entidades privadas.
- **PENDENTE:** matriz fina de equipe, suporte excepcional e múltiplos vínculos.
