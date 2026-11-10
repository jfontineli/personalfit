# Infraestrutura e operação

## CONFIRMADO AGORA — escopo da evidência

O repositório configura npm workspaces, Node 24, CI GitHub Actions e Supabase local via CLI/Docker. A configuração local usa API/Auth/Storage em 54321, PostgreSQL em 54322, Studio em 54323 e email local em 54324. Cadastro local tem confirmação de email desabilitada. Consulte [config.toml](../../supabase/config.toml). O seed fictício destina-se a desenvolvimento e testes descartáveis.

Na auditoria de 10/11/2026, o [Pages de teste](https://personalfit-bd3.pages.dev/) respondeu HTTP 200. O HTML apontou para index-4UDQS1DH.js e index-EKvPnJqc.css; o dist web local existente referenciava index-DrQi4zVn.js e index-jLjniyJy.css. Isso identifica shells distintos. A verificação foi pública, sem autenticação ou consulta a dados privados.

## HISTÓRICO — publicação e migrations

GitHub guarda o monorepo. O processo de teste registrado usa a branch main, raiz do projeto, npm run build e saída apps/web/dist. O build recebe apenas VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY do Supabase Cloud correspondente. O workflow versionado valida a aplicação web. Em novembro, pushes deixaram o Pages com bundle antigo e houve publicação direta via Wrangler após compilação para o projeto remoto. Não inferir deploy de um push ou CI verde.

Em 02/11 houve aplicação inicial de 21 migrations em teste. Em 03/11 foram aplicadas as 12 de nutrição e execução guiada e em 04/11 as de acompanhamento e guias/cardio até 20261104030000. O procedimento registrado conferiu o projeto ligado e o dry-run, aplicou migrations sem seed/reset e verificou o resultado. Houve cópia de segurança local de banco e objetos em diretório ignorado. Nenhum dado operacional individual é necessário para repetir a verificação do schema.

## DESCONHECIDO — estado remoto atual

SHA implantado, ledger efetivo de migrations, configuração Auth/SMTP/MFA, grants efetivos no Cloud, restauração dos objetos e funcionamento do gatilho GitHub → Pages precisam de evidência operacional recente. Disponibilidade do shell não valida login, autorização, Storage ou sync autenticados.

## Recuperação e produção

**DECISÃO APROVADA** — Produção terá projeto Supabase separado, credenciais próprias e revisão de capacidade e custos antes do piloto. **PENDENTE** — ensaio de rollback do frontend com PWA instalada e fila antiga, correção progressiva do banco, backup/restauração coordenados de PostgreSQL e objetos, domínio, monitoramento e resposta a incidentes. A troca de origem da PWA pode separar o usuário de sua fila local. Verificar sincronização e plano de transição antes de mudança de domínio.

Para cada publicação autorizada, registrar ambiente, SHA, versão do schema, identificador do bundle e validação executada. Não registrar usuários, links de convite, tokens nem conteúdo clínico. [ADR de hospedagem](../decisions/0014-cloudflare-pages-supabase-hosting.md) · [Estado atual](CURRENT_STATE.md)
