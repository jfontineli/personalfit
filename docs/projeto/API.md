# Contratos de API

**CONFIRMADO:** Supabase Auth valida login/logout/renovação/sessão e a RPC técnica `record_technical_operation(p_tenant_id, p_operation_id) → boolean`; `true` significa primeiro recibo, `false` significa repetição. O banco valida vínculo ativo por RLS. A fila IndexedDB envia manualmente apenas IDs de operações técnicas para essa RPC e marca confirmação local após a resposta.

**CONFIRMADO NA FASE 3:** `apps/web/src/services/business.ts` concentra consultas e mutações das tabelas de identidade, tenant, aluno e marca. `listMemberships` e `listTenants` resolvem o contexto visível ao usuário; o tenant selecionado é filtro, jamais autoridade. `createStudent`, `updateStudent`, `listStudents`, `getStudent` e `updateBrand` usam grants de coluna e RLS. Observações internas ficam em tabela e chamadas próprias, invisíveis ao aluno. `create_student_invite(p_student_id, p_token_hash) → timestamptz` registra somente o hash e devolve expiração; `claim_student_invite(p_token) → student_id` verifica hash, prazo, uso e email Auth confirmado, e associa identidade/vínculo atomicamente. Ambas são funções privilegiadas com verificações explícitas; apenas a última liga `user_id` ao aluno. `platform_admins` só revela ao próprio usuário o papel ativo, sem API administrativa de dados do tenant.

## Contratos necessários

| Operação | Responsável | Estado |
|---|---|---|
| Resolver contexto autorizado do tenant | Vínculos ativos + RLS | CONFIRMADO |
| Cadastrar/editar/inativar aluno | Service do frontend + RLS/grants | CONFIRMADO |
| Convidar e ativar aluno | RPCs com hash, expiração e uso único | CONFIRMADO |
| Consultar biblioteca e cadastrar exercício particular | Biblioteca | PENDENTE |
| Criar/alterar rascunho | Prescrição | PENDENTE |
| Publicar versão e atribuir ao aluno | Operação transacional | PENDENTE |
| Baixar versão atribuída | Leitura autorizada | PENDENTE |
| Enviar lote de operações de execução | Sincronização | PENDENTE |
| Consultar sessões/histórico/frequência | Execução | PENDENTE |
| Registrar e consultar avaliação básica | Avaliação | PENDENTE |
| Ler marca e contato do tenant | Vínculo ativo + RLS | CONFIRMADO |

## Envelope de sincronização

**DECISÃO APROVADA:** toda operação crítica tem ID único e resultado idempotente. A resposta precisa permitir que o cliente distinga confirmação, falha transitória, falha permanente e conflito. A confirmação remota é por operação, mesmo quando o envio for em lote.

**HIPÓTESE:** o contrato incluirá `operationId`, `operationType`, `schemaVersion`, ID estável do recurso, versão-base quando aplicável e payload validado. O servidor obterá usuário e permissões da sessão; qualquer referência de tenant fornecida no payload será apenas contexto a verificar, nunca autorização.

## Erros e concorrência

**DECISÃO APROVADA:** reenvio do mesmo ID não cria execução duplicada. O cliente preserva operação pendente até receber confirmação válida. Publicação posterior não muda a versão da sessão em andamento.

**PENDENTE:** definir formato JSON, status/códigos, tamanho máximo de lote, ordem de dependências, prazo de retenção dos IDs de idempotência, regras de conflito entre dispositivos e política de compatibilidade entre versões da PWA e da API.

**NECESSITA VALIDAÇÃO HUMANA:** comportamento desejado quando um aluno é inativado enquanto possui operações feitas offline ainda pendentes.
