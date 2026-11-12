# Banco e migrations

**CONFIRMADO** — PostgreSQL é a fonte consolidada. A configuração local usa PostgreSQL 17. Na base de 10/11 há 37 migrations rastreadas entre 20260929000000 e 20261104030000 e uma migration local de 09/11. O DDL declara 26 tabelas de aplicação, todas com RLS habilitada. O catálogo remoto requer verificação separada.

| Grupo | Tabelas |
|---|---|
| Plataforma e identidade | tenants, tenant_brand, tenant_memberships, user_profiles, platform_admins, professionals, professional_invitations, tenant_plans |
| Atendimento | students, student_internal_notes, student_invitations, student_service_plans, audit_events, technical_operation_receipts |
| Treino | exercise_library, workout_plans, workout_plan_versions, workout_assignments, workout_sessions, workout_operation_receipts |
| Alimentação | nutritionists, nutrition_assignments, nutrition_invitations, nutrition_plans, nutrition_plan_versions, nutrition_meal_events |

Membership é única por tenant/usuário. O enum app_role serve à identidade administrativa; a membership usa papel textual com CHECK. FKs compostas vinculam recursos ao mesmo tenant. Há unicidade de conta e email do aluno no espaço, versão por plano, convite aberto e atribuição nutricional ativa. Índices apoiam biblioteca, sessões por semana, indicadores e leitura de versões recentes. O índice por sessão/dia/semana não impõe unicidade por dia.

Triggers criam perfil e plano padrão, propagam estados de vínculo, auditam alterações selecionadas e validam publicação/execução. Rascunhos usam JSONB; publicação congela versões com autor, número e data. Sessões referenciam versão; recibos identificam replay e conflito de conteúdo. Alimentação mantém eventos por versão e operação. Conteúdo clínico passa por RPCs com verificação de atribuição.

**DECISÃO APROVADA · migration local validada** — [20261109000000](../../supabase/migrations/20261109000000_live_exercise_content.sql) cria student_exercise_content sem alterar versões, sessões ou atribuições. A função SECURITY DEFINER fixa search_path, qualifica objetos, restringe EXECUTE e valida identidade, perfil, membership ALUNO, aluno ativo, plano do tenant, versão mais recente atribuída e exercícios principais/alternativas. A mesma migration amplia a proteção de exclusão para mídia presente somente em alternativa publicada.

## Evolução

A sequência parte de identidade, onboarding e plataforma; acrescenta buckets privados, treino, versionamento, execução, nutrição, alternativas e guias/cardio. Correções de compatibilidade e de paths entram em migrations posteriores. Nunca edite migration já aplicada. Confirme replay em banco descartável com seed fictício, grants, RLS e pgTAP. Veja [migrations](../../supabase/migrations), [contratos atuais e legados](API.md), [testes](TESTING.md) e [ledger remoto e backups](INFRASTRUCTURE.md).
