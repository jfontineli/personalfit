# Infraestrutura e operação

## CONFIRMADO AGORA — escopo da evidência

O repositório configura npm workspaces, Node 24, CI GitHub Actions e Supabase local via CLI/Docker. A configuração local usa API/Auth/Storage em 54321, PostgreSQL em 54322, Studio em 54323 e email local em 54324. Cadastro local tem confirmação de email desabilitada. Consulte [config.toml](../../supabase/config.toml). O seed fictício destina-se a desenvolvimento e testes descartáveis.

Em 11/11/2026, o [Pages de teste](https://personalfit-bd3.pages.dev/) recebeu por Wrangler o SHA `d8f040f555aa239a17e3b314f5c46e7e1a48d587`, deployment `2b9f102b-cac4-45d6-b5d2-d5fad3d38c11`. O Cloudflare chama a branch `main` de `Environment=Production`, mas ela é a production branch do projeto lógico de TESTE `personalfit`, não produção comercial. O domínio canônico e a URL imutável do deployment serviram `index-C3GZEETU.js`, `index-jLjniyJy.css`, manifest e service worker com HTTP 200.

## HISTÓRICO — publicação e migrations

GitHub guarda o monorepo. O processo de teste registrado usa a branch main, raiz do projeto, npm run build e saída apps/web/dist. O build recebe apenas VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY do Supabase Cloud correspondente. O workflow versionado valida a aplicação web. Em novembro, pushes deixaram o Pages com bundle antigo e houve publicação direta via Wrangler após compilação para o projeto remoto. Não inferir deploy de um push ou CI verde.

Em 02/11 houve aplicação inicial de 21 migrations em teste. Em 03/11 foram aplicadas as 12 de nutrição e execução guiada e em 04/11 as de acompanhamento e guias/cardio até 20261104030000. Em 11/11, o projeto ligado foi confirmado como `PersonalFit Teste`, região `sa-east-1`, e o ledger remoto coincidiu com as 38 migrations locais até `20261109000000`. A migration de 09/11 já estava aplicada; o dry-run retornou banco atualizado e nenhuma migration, seed ou role pendente. Não houve reset, seed nem escrita manual no banco remoto.

## CONFIRMADO EM TESTE — smoke de 11/11/2026

GitHub e `origin/main` apontaram para `d8f040f`; o workflow do push concluiu com sucesso. O gatilho GitHub → Pages não publicou esse SHA, por isso foi usado apenas o deploy direto documentado. Auth respondeu HTTP 200; a RPC `student_exercise_content` negou chamada anônima com `42501`; `brand-logos` e `exercise-videos` permaneceram `public=false` e sem listagem anônima. Em navegador, `/login`, `/app` e `/aluno/inicio` carregaram sem erro, e as duas rotas protegidas exibiram login sem sessão. **NÃO VALIDADO remotamente** — login com fixture, áreas autenticadas, conteúdo atual versus snapshot, alternativa e mídia privada, pois não há conta fictícia remota documentada e não foram criados dados para o smoke. Configuração Auth/SMTP/MFA, restauração e comportamento em aparelho físico continuam desconhecidos.

## Recuperação e produção

**DECISÃO APROVADA** — Produção terá projeto Supabase separado, credenciais próprias e revisão de capacidade e custos antes do piloto. **PENDENTE** — ensaio de rollback do frontend com PWA instalada e fila antiga, correção progressiva do banco, backup/restauração coordenados de PostgreSQL e objetos, domínio, monitoramento e resposta a incidentes. A troca de origem da PWA pode separar o usuário de sua fila local. Verificar sincronização e plano de transição antes de mudança de domínio.

Para cada publicação autorizada, registrar ambiente, SHA, versão do schema, identificador do bundle e validação executada. Não registrar usuários, links de convite, tokens nem conteúdo clínico. [ADR de hospedagem](../decisions/0014-cloudflare-pages-supabase-hosting.md) · [Estado atual](CURRENT_STATE.md)
