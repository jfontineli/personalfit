# Registros de decisão de arquitetura

Cada ADR registra contexto, decisão, alternativas e consequências. Uma decisão aprovada alterada recebe novo ADR que aponta o anterior; a documentação corrente é atualizada junto.

| ADR | Tema | Status |
|---|---|---|
| [0001](0001-supabase.md) | Supabase inicial | DECISÃO APROVADA |
| [0002](0002-postgresql-source-of-truth.md) | PostgreSQL como fonte consolidada | DECISÃO APROVADA |
| [0003](0003-multi-tenancy.md) | Multi-tenancy | DECISÃO APROVADA |
| [0004](0004-indexeddb-offline.md) | IndexedDB e offline | DECISÃO APROVADA |
| [0005](0005-prescription-versioning.md) | Versionamento de prescrições | DECISÃO APROVADA |
| [0006](0006-monorepo.md) | Monorepo modular | DECISÃO APROVADA |
| [0007](0007-white-label.md) | White-label por tenant | DECISÃO APROVADA |
| [0008](0008-identity-roles-invitations.md) | Identidade, papéis e ativação de aluno | DECISÃO APROVADA |
| [0009](0009-professional-centric-white-label.md) | Produto centrado no profissional e white-label | DECISÃO APROVADA |
| [0010](0010-platform-onboarding.md) | Entrada de profissionais pela plataforma | DECISÃO APROVADA |
| [0011](0011-platform-plan-and-access.md) | Plano e acesso administrativo por espaço | DECISÃO APROVADA |
| [0012](0012-workout-cycle-and-partial-execution.md) | Ciclo prescrito e execução parcial | DECISÃO APROVADA |
| [0013](0013-live-exercise-media.md) | Mídia atual da biblioteca em treinos publicados | DECISÃO APROVADA |
| [0014](0014-cloudflare-pages-supabase-hosting.md) | Cloudflare Pages e Supabase Cloud | DECISÃO APROVADA |
| [0015](0015-nutritionist-authored-diet.md) | Autoria da prescrição alimentar pelo nutricionista parceiro | DECISÃO APROVADA |
| [0016](0016-dual-professional-nutrition-capability.md) | Personal com capacidade de nutricionista na mesma conta | DECISÃO APROVADA |
| [0017](0017-workout-execution-guidance.md) | Troca aprovada, pausa e execução guiada do treino | DECISÃO APROVADA |
| [0018](0018-rest-timer-and-exercise-swap-ux.md) | Descanso visível e troca orientada | DECISÃO APROVADA |
| [0019](0019-simple-preparation-and-cardio.md) | Preparação simples e cardio prescrito | DECISÃO APROVADA |
| [0020](0020-guides-separate-from-workout.md) | Orientações separadas da execução do treino | DECISÃO APROVADA |

Os ADRs 0001 a 0008 foram registrados em 2026-09-29; os ADRs 0009 a 0011, em 2026-09-30; os ADRs 0012 a 0014, em 2026-11-02; os ADRs 0015 a 0017, em 2026-11-03. A aprovação da arquitetura não significa que a implementação já exista.

## Relações entre decisões

- 0009 complementa 0007 e prioriza a biblioteca do espaço e a autoria do profissional.
- 0016 complementa 0015 com dupla atuação mediante atribuição individual.
- 0018 restringe a interação de 0017 quando não há alternativa aprovada e preserva o contrato histórico de ocorrências.

Para saber o que chegou a cada ambiente, consulte [estado atual](../projeto/CURRENT_STATE.md) e [infraestrutura](../projeto/INFRASTRUCTURE.md).
