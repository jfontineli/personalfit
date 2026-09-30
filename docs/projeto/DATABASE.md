# Persistência e banco de dados

## Autoridade dos dados

**DECISÃO APROVADA:** PostgreSQL é a fonte consolidada. IndexedDB contém prescrição disponível offline, sessões em andamento e operações pendentes; `localStorage` guarda apenas preferências simples. Cache Storage guarda recursos da PWA. Supabase Storage será usado quando houver arquivos do produto.

**HISTÓRICO CONFIRMADO NA FASE 2.1:** `db:reset` aplicou do zero `20260929000000_technical_foundation.sql` e o seed da época. Foram criadas `tenants`, `tenant_brand`, `tenant_memberships` e `technical_operation_receipts`, todas com RLS ativa, seis políticas e a RPC `record_technical_operation` em modo invoker. O seed daquela fase tinha 2 tenants, 2 marcas, 2 vínculos e 3 identidades fictícias sem senha. Os 19 testes pgTAP passaram; reenvio da mesma `(user_id, operation_id)` gerou só um recibo.

**CONFIRMADO NA FASE 3:** a nova migration `20260929010000_identity_business.sql` preserva a anterior e acrescenta `user_profiles`, `platform_admins`, `professionals`, `students`, `student_internal_notes`, `student_invitations` e `audit_events`, todas com RLS ativa. Os novos papéis dos vínculos são `PROFISSIONAL` e `ALUNO`; `SUPER_ADMIN` fica separado em `platform_admins`, sem policy de leitura de dados do tenant. `tenant_brand` recebeu nome de marca, cor secundária, URL opcional de logo e contatos. Colunas de `user_id` e `tenant_id` do aluno não são editáveis pelo cliente; associação usa RPC transacional de convite. O email do aluno é único por tenant com comparação sem caixa e espaços externos são rejeitados. O seed atual contém 2 tenants, 2 profissionais, 4 alunos e 6 identidades Auth fictícias sem senhas. O teste de banco tem 65 verificações pgTAP, incluindo as 19 técnicas originais e autorização de negócio.

## Grupos de dados previstos

**HIPÓTESE:** migrations futuras criarão, em ordem de dependência, biblioteca, prescrição/versões/atribuições, execução e avaliação. A lista conceitual está em `DOMAIN_MODEL.md`; ela não autoriza criar todas as tabelas antecipadamente.

## Invariantes de modelagem

- **DECISÃO APROVADA:** dados privados pertencem a um tenant e são acessados pelo vínculo correto.
- **DECISÃO APROVADA:** identidade de exercício, versão e execução deve permanecer estável. Posição e nome não são chaves históricas.
- **DECISÃO APROVADA:** publicação é versionada; execução referencia a versão usada.
- **DECISÃO APROVADA:** escrita crítica admite ID de operação para evitar duplicidade.
- **HIPÓTESE:** constraints compostas incluirão o tenant nas referências sensíveis, além de RLS, para impedir relações cruzadas.
- **HIPÓTESE:** exclusão lógica ou status inativo preservará histórico conforme a política de retenção definida.

## Migrations

**CONFIRMADO:** migrations recebem prefixo temporal UTC. A primeira migration técnica permanece intacta; a Fase 3 usa migration nova. Em ambientes compartilhados, migrations aplicadas devem ser preservadas; uma alteração posterior cria nova migration.

## Backup e recuperação

**PENDENTE:** escolher plano Supabase, periodicidade, retenção, cópia de objetos do Storage e ensaio de restauração. Backup do banco e backup dos arquivos são necessidades distintas.

**NECESSITA VALIDAÇÃO HUMANA:** prazo de retenção e política de exclusão/exportação de dados pessoais.
