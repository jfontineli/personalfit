# Instruções para agentes — PersonalFit

## 1. Bootstrap do contexto

Antes de alterar arquivos, leia `README.md`, `docs/projeto/README.md`, `docs/projeto/CURRENT_STATE.md` e os ADRs pertinentes. Verifique a árvore, os arquivos existentes e o estado do Git. Se o código ainda não existir, não descreva documentação como implementação.

## 2. Hierarquia das fontes de verdade

Quando houver divergência, verifique nesta ordem, exatamente:

1. Código atual.
2. Migrations e configuração atuais.
3. Testes.
4. Documentação persistente em `docs/projeto/` e ADRs.
5. Este `AGENTS.md`.
6. Histórico Git.
7. Conversa atual.

Essa ordem serve para **constatar o estado existente**; uma instrução explícita e recente do usuário sobre o trabalho solicitado continua sendo a autoridade para mudanças futuras. Não altere uma decisão aprovada silenciosamente: registre a nova decisão e atualize os documentos afetados.

## 3. Etiquetas de evidência

Use `CONFIRMADO` somente para comportamento demonstrado por código, migration, configuração, teste ou observação verificável. Use `DECISÃO APROVADA` para escopo ou arquitetura autorizados pelo usuário. Use `HIPÓTESE` para proposta ainda não validada. Use `PENDENTE` para trabalho não feito. Use `NECESSITA VALIDAÇÃO HUMANA` para decisão de produto, negócio, exercício profissional ou responsabilidade legal que não cabe ao agente assumir.

## 4. Preparação de mudanças

Leia a documentação relevante antes de cada alteração. Analise o impacto em tenant, autorização, versões de treino, execução, sincronização, offline, API e migrações. Preserve alterações existentes e não sobrescreva trabalho alheio sem entender seu estado. Mantenha alterações proporcionais à fase autorizada.

## 5. Isolamento e segurança

Toda leitura e escrita de dados privados valida: usuário autenticado → vínculo ativo → tenant → papel/permissão → recurso específico. `tenant_id` recebido do cliente nunca concede acesso. Um aluno só acessa seus próprios dados e vínculos. A interface não é a camada de autorização.

Use RLS em tabelas e Storage expostos pelo Supabase e complemente com validações de servidor para operações compostas ou privilegiadas. Teste negação entre Tenant A e Tenant B, entre alunos do mesmo tenant e para contas inativas. Negue por padrão. Não envie chaves privilegiadas, tokens administrativos, fotos, medidas ou logs sensíveis para o bundle público.

## 6. Contratos, migrations e histórico

Defina contratos estáveis e versionados para operações de sincronização e publicação. Qualquer mudança persistente deve ter migration revisável; não editar migrations já aplicadas em ambientes compartilhados. Separe prescrição de execução. Publicar cria versão imutável. Uma sessão mantém a versão com que começou, inclusive quando sincronizada depois de uma publicação nova. Nunca apague o histórico ao inativar aluno ou editar prescrição.

## 7. Offline e sincronização

Use IndexedDB para prescrições disponíveis offline, sessões em andamento e operações pendentes; `localStorage` fica restrito a preferências simples. Grave alteração local e operação pendente de forma atômica. Cada operação crítica tem ID estável, idempotência no servidor, retry apropriado, estado visível e tratamento explícito de conflito/erro. Não descarte pendências silenciosamente nem prometa sincronização quando somente o dispositivo confirmou a gravação. Cache Storage armazena recursos da PWA, respeitando privacidade e versão.

## 8. Testes e revisão

Escolha testes que verifiquem comportamento e riscos reais, em especial autorização, RLS, publicação, preservação do histórico, duplicidade e interrupção da sincronização. Antes de encerrar uma alteração, revise o diff e o estado do Git; confirme arquivos criados, conteúdo sensível acidental e documentação desatualizada. Não faça commit, push ou deploy sem autorização da tarefa atual.

## 9. Manutenção da memória persistente

Atualize `CURRENT_STATE.md` quando o estado real mudar. Atualize os documentos de domínio, API, banco, segurança e testes junto com os contratos correspondentes. Registre mudança arquitetural em novo ADR ou em ADR que ainda esteja proposto, preservando o histórico da decisão. Marque o que permanece pendente; não promova hipótese a fato sem evidência.

## 10. Material de referência

`referencia/` serve somente para análise funcional e de experiência. Não copie código, marca, textos, imagens, nomes, assets nem conteúdo proprietário para o produto. A pasta está ignorada pelo Git.
