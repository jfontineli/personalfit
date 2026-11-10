# PersonalFit — agente do monorepo

## Bootstrap

1. Leia este arquivo e o [índice da memória](docs/projeto/README.md).
2. Leia o [estado atual](docs/projeto/CURRENT_STATE.md) e o [README do produto](README.md).
3. Consulte os documentos do módulo e os [ADRs pertinentes](docs/decisions/README.md). Em `apps/web/` e `supabase/`, aplique também o agente local.
4. Confira raiz, branch, HEAD, `git status --short --branch`, arquivos não rastreados e diff relevante. Entenda e preserve alterações preexistentes.

## Fontes de verdade

Para constatar o estado, siga a ordem: código atual → migrations/configuração/contratos → testes → documentação persistente e ADRs → AGENTS.md → histórico Git relevante → conversa atual → inferência. A instrução recente do usuário define o escopo futuro. Registre decisões novas e relações com as anteriores. Use as etiquetas e os limites de evidência do índice da memória.

## Invariantes

O SaaS é multi-tenant e white-label, centrado no profissional. Valide identidade, perfil e vínculo ativos, tenant, papel e recurso no servidor. O tenant_id do cliente nunca concede acesso. Isole alunos, inclusive entre colegas do mesmo espaço. A capacidade nutricional exige atribuição individual. Mantenha service role fora do browser.

Separe biblioteca, prescrição versionada e execução. Preserve snapshots, histórico e a versão da sessão, inclusive após inativação e reenvio offline. Isole dados locais por identidade, tenant e aluno. Diferencie gravação no aparelho de confirmação no servidor.

## Análise de impacto

Antes de implementar, avalie frontend, banco, migrations, RLS, RPCs, Storage, Auth, offline, IndexedDB, versões de treino e nutrição, auditoria, infraestrutura e compatibilidade com PWA instalada e operações antigas. Consulte [riscos abertos](docs/projeto/TECH_DEBT.md).

## Project knowledge maintenance

Ao encerrar cada tarefa, avalie mudanças reais em arquitetura, domínio, regras, banco/migration, API, RLS/autorização, segurança/Storage, offline/sincronização, treino, nutrição, infraestrutura e comportamento observável. Atualize o documento responsável na mesma tarefa e CURRENT_STATE quando mudar o estado real. Sem mudança de fato ou decisão, dispense edição documental. Use exemplos fictícios e evidência técnica mínima. Anexos locais e material de referência não são fontes de conteúdo distribuível.

## Definition of Done

Conforme o impacto, execute lint, Vitest, build, reset em banco descartável, pgTAP e Playwright. Revise migrations, RLS entre tenants e alunos, Storage, segurança, offline e compatibilidade. Confira diff, status, arquivos novos, links e documentação. Registre o que foi validado, em qual ambiente e o que ficou pendente.

## Proibições

Sem autorização explícita da tarefa: commit, push, deploy, alteração de produção ou secrets, reset remoto destrutivo, exclusão massiva, reescrita do histórico Git e alteração de migration histórica aplicada. Para evoluir o schema, use migration nova. Nunca exponha service role, tokens, dados clínicos ou backups no cliente ou na documentação. Não copie código, marca, textos ou mídias de `referencia/`.
