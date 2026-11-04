# Arquitetura

## Visão

**CONFIRMADO NA FASE 2:** `apps/web` contém a interface técnica React/TypeScript, `offline/` usa uma base IndexedDB com stores `records`, `queue` e `auth`, e o build gera manifest e service worker. `supabase/` contém a configuração local e uma migration de identidade/tenant/marca/recibo técnico. Nenhum fluxo de treino foi implementado.

**CONFIRMADO NA FASE 2.1:** a fila técnica preserva o dono da operação, consulta vínculo ativo e envia seu ID à RPC idempotente somente após login e retorno online. O teste com outro usuário no mesmo navegador não envia operações do dono anterior. Isso ainda não é sincronização de treino.

**CONFIRMADO NA FASE 3:** `services/business.ts` concentra acesso às entidades básicas, `IdentityApp` resolve sessão, vínculos ativos e seleção de tenant. RLS/grants autorizam todas as consultas e mutações de aluno e marca; convite/ativação são RPCs com verificações servidoras e auditoria. O módulo offline técnico foi preservado em `/diagnostico`, sem sincronização de dados de aluno.

**CONFIRMADO NO ONBOARDING LOCAL:** `/admin` cria tenant e convite ao personal por RPC transacional; `/ativar-profissional` vincula uma conta Auth com email confirmado ao tenant. Nenhuma dessas operações usa chave de serviço no navegador. O superadmin não adquire vínculo com o tenant criado. O fluxo está registrado no [ADR 0010](../decisions/0010-platform-onboarding.md).

**CONFIRMADO NA GESTÃO DA PLATAFORMA:** `/admin` também lista espaços/primeiros profissionais e altera plano, prazo e suspensão por RPCs verificadas. `tenant_plans` é metadado administrativo sem leitura direta pelo cliente; RLS restritiva bloqueia dados de espaços sem acesso vigente. Convites privilegiados verificam a mesma condição. A decisão está no [ADR 0011](../decisions/0011-platform-plan-and-access.md).

**CONFIRMADO NO PRIMEIRO CICLO DE TREINO:** `exercise_library`, `workout_plans`, `workout_plan_versions`, `workout_assignments`, `workout_sessions` e `workout_operation_receipts` separam biblioteca, rascunho, publicação, atribuição e execução. `publish_workout_plan` resolve nomes, instruções e vídeo na versão imutável. `sync_workout_session` valida aluno, atribuição, tenant e operação idempotente. O módulo `offline/workoutStore.ts` persiste prescrição, sessão e operações em IndexedDB; a PWA reabre o treino após uma carga online e o vídeo privado só é requisitado sob demanda quando conectado. O código de treino é carregado como módulo separado da entrada inicial.

**CONFIRMADO EM 2026-11-02:** ciclo e unidade de execução fazem parte do snapshot publicado, não de preferências mutáveis da interface. Semanas de ciclo são intervalos de sete dias a partir da data prescrita; versões legadas continuam na semana de calendário. O banco valida uma medida por série, completude do dia e resultado `PARTIAL`. A fila IndexedDB e os recibos idempotentes preservam a execução offline e a versão iniciada. A [decisão 0012](../decisions/0012-workout-cycle-and-partial-execution.md) registra a compatibilidade.

**DECISÃO APROVADA:** React + TypeScript em PWA mobile first; Supabase para autenticação e arquivos; PostgreSQL como fonte consolidada; IndexedDB para dados offline; Cache Storage para recursos da PWA; um repositório modular. Spring Boot não integra o MVP inicial.

**DECISÃO APROVADA:** a arquitetura serve a experiência própria de cada profissional. Identidade, biblioteca, mídia e conteúdo prescrito pertencem ao contexto autorizado do tenant. Conteúdo global, se existir, é auxiliar e não é dependência para criar um treino. O profissional é o autor da prescrição; o MVP não inclui sugestão nem geração automática de treinos. Esta diretriz complementa o [ADR 0007](../decisions/0007-white-label.md) e está registrada no [ADR 0009](../decisions/0009-professional-centric-white-label.md).

```text
PWA React/TypeScript
  ├─ interface do aluno e do profissional
  ├─ IndexedDB: prescrições, sessões e operações pendentes
  ├─ Cache Storage: recursos da aplicação
  └─ Supabase Auth + contratos autorizados
       ├─ PostgreSQL com RLS
       ├─ Supabase Storage privado
       └─ funções para operações que exigem autoridade/atomicidade
```

**HIPÓTESE:** funções Supabase ou RPCs transacionais servirão publicação, atribuição e sincronização. A forma exata será decidida ao especificar API e ameaças. Consultas diretamente do navegador só serão permitidas com RLS completa e testada.

## Limites dos módulos

- **Identidade:** usuários, sessão, vínculo, papel no tenant e convites de personal/aluno.
- **Tenant e marca:** nome, foto/logo, cores, configuração visual e contatos, incluindo WhatsApp.
- **Alunos e equipe:** cadastro, status e vínculos.
- **Biblioteca:** exercícios criados pelo profissional para seu tenant, com instruções e vídeos próprios; eventual conteúdo global é auxiliar.
- **Prescrição:** rascunhos, versões publicadas e atribuição.
- **Execução:** sessões e séries realizadas, separadas de prescrição.
- **Avaliação:** peso, medidas básicas e observações.
- **Offline/sync:** persistência local, fila, confirmação, conflitos e reconciliação.

Nenhum módulo pode inferir acesso a partir da URL, do tema exibido ou de um `tenant_id` enviado pelo cliente.

## Fluxo de publicação

**DECISÃO APROVADA:** o profissional edita rascunho. Publicar cria uma versão imutável. Uma atribuição liga versão e aluno. A PWA baixa a versão disponível; uma sessão iniciada mantém a versão inicial, mesmo se outra for publicada antes da sincronização.

## Fluxo offline

**DECISÃO APROVADA:** uma operação crítica recebe ID único. Registro local e inclusão na fila ocorrem juntos no IndexedDB. A interface distingue `salvo neste aparelho`, `enviando`, `sincronizado` e `precisa de atenção`. O servidor valida identidade, vínculo, tenant, papel e recurso; grava de forma idempotente; então confirma o ID. Falhas transitórias permitem retry. Conflitos e erros permanentes exigem tratamento explícito.

**DECISÃO APROVADA:** a disponibilidade offline do shell e da prescrição previamente carregada é preparada automaticamente, sem ação de download pelo aluno. A mídia de instrução é carregada sob demanda quando houver conexão e não integra o pacote offline do MVP. O navegador pode limitar ou remover armazenamento local; a interface não apresenta uma operação pendente como se já estivesse confirmada no servidor.

**HIPÓTESE:** o cliente poderá usar sincronização em lote, preservando ordenação por sessão e dependências. O servidor terá registro de operações processadas com unicidade por identidade/operação.

## Diretrizes de evolução

**DECISÃO APROVADA:** white-label é configuração de tenant, não cópia do aplicativo. O primeiro tenant não aparece em regras fixas. Dieta futura ocupa módulo separado e não altera o domínio inicial de execução de treino.

**CONFIRMADO:** `student_service_plans` representa o atendimento do aluno com nome, datas e estado. Esse cadastro é distinto de `tenant_plans`, que controla o contrato SaaS do personal. Nesta versão, o atendimento do aluno é informativo; efeitos comerciais e de acesso aguardam decisão humana.

**DECISÃO APROVADA:** versões publicadas preservam a interpretação histórica do exercício e das orientações efetivamente prescritos, inclusive quando o profissional edita depois sua biblioteca ou mídia. Dieta e acompanhamento integram a visão do produto; o ADR 0015 definiu autoria dietética pelo nutricionista parceiro. O primeiro fluxo local já possui papel por vínculo, autorização, schema e interface; validação clínica, gestão do parceiro e implantação remota permanecem pendentes.

**CONFIRMADO EM 2026-11-02:** a exibição online do vídeo é resolvida pela mídia atual da biblioteca por RPC autorizada, separada da prescrição imutável. A consulta devolve apenas vídeos de exercícios na versão atribuída ao aluno autenticado; o bucket privado aplica a mesma restrição para MP4. O snapshot retém a referência histórica, e a sessão não troca de versão. Veja o [ADR 0013](../decisions/0013-live-exercise-media.md).

**PENDENTE:** ampliar o contrato da primeira sessão para os demais campos de execução, definir limites de lote, conflito entre dispositivos, retenção local/remota, hospedagem e observabilidade.
**CONFIRMADO LOCALMENTE — COMPOSIÇÃO DE PAPÉIS:** a membership continua única por usuário e tenant. O personal que também atua como nutricionista mantém `PROFISSIONAL`; `nutritionists` e `nutrition_assignments` acrescentam autorização clínica somente por aluno. As RPCs de nutrição verificam ambas as camadas; a interface permite alternar entre o espaço do personal e `/nutricionista` sem outra conta. Ver ADR 0016.
