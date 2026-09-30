# Arquitetura

## Visão

**CONFIRMADO NA FASE 2:** `apps/web` contém a interface técnica React/TypeScript, `offline/` usa uma base IndexedDB com stores `records`, `queue` e `auth`, e o build gera manifest e service worker. `supabase/` contém a configuração local e uma migration de identidade/tenant/marca/recibo técnico. Nenhum fluxo de treino foi implementado.

**CONFIRMADO NA FASE 2.1:** a fila técnica preserva o dono da operação, consulta vínculo ativo e envia seu ID à RPC idempotente somente após login e retorno online. O teste com outro usuário no mesmo navegador não envia operações do dono anterior. Isso ainda não é sincronização de treino.

**CONFIRMADO NA FASE 3:** `services/business.ts` concentra acesso às entidades básicas, `IdentityApp` resolve sessão, vínculos ativos e seleção de tenant. RLS/grants autorizam todas as consultas e mutações de aluno e marca; convite/ativação são RPCs com verificações servidoras e auditoria. O módulo offline técnico foi preservado em `/diagnostico`, sem sincronização de dados de aluno.

**DECISÃO APROVADA:** React + TypeScript em PWA mobile first; Supabase para autenticação e arquivos; PostgreSQL como fonte consolidada; IndexedDB para dados offline; Cache Storage para recursos da PWA; um repositório modular. Spring Boot não integra o MVP inicial.

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

- **Identidade:** usuários, sessão, vínculo e papel no tenant.
- **Tenant e marca:** configuração visual e contatos, incluindo WhatsApp.
- **Alunos e equipe:** cadastro, status e vínculos.
- **Biblioteca:** exercícios da plataforma ou do tenant.
- **Prescrição:** rascunhos, versões publicadas e atribuição.
- **Execução:** sessões e séries realizadas, separadas de prescrição.
- **Avaliação:** peso, medidas básicas e observações.
- **Offline/sync:** persistência local, fila, confirmação, conflitos e reconciliação.

Nenhum módulo pode inferir acesso a partir da URL, do tema exibido ou de um `tenant_id` enviado pelo cliente.

## Fluxo de publicação

**DECISÃO APROVADA:** o profissional edita rascunho. Publicar cria uma versão imutável. Uma atribuição liga versão e aluno. A PWA baixa a versão disponível; uma sessão iniciada mantém a versão inicial, mesmo se outra for publicada antes da sincronização.

## Fluxo offline

**DECISÃO APROVADA:** uma operação crítica recebe ID único. Registro local e inclusão na fila ocorrem juntos no IndexedDB. A interface distingue `salvo neste aparelho`, `enviando`, `sincronizado` e `precisa de atenção`. O servidor valida identidade, vínculo, tenant, papel e recurso; grava de forma idempotente; então confirma o ID. Falhas transitórias permitem retry. Conflitos e erros permanentes exigem tratamento explícito.

**HIPÓTESE:** o cliente poderá usar sincronização em lote, preservando ordenação por sessão e dependências. O servidor terá registro de operações processadas com unicidade por identidade/operação.

## Diretrizes de evolução

**DECISÃO APROVADA:** white-label é configuração de tenant, não cópia do aplicativo. O primeiro tenant não aparece em regras fixas. Dieta futura ocupa módulo separado e não altera o domínio inicial de execução de treino.

**PENDENTE:** definir contratos detalhados, limites de lote, cache, navegação offline, serviço de hospedagem e observabilidade.
