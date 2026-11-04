# Infraestrutura e operação

## Estado

**CONFIRMADO:** `supabase/config.toml` configura o stack local via CLI/Docker; `.github/workflows/ci.yml` executa instalação, lint, testes de frontend e build. O Supabase Cloud de teste foi criado em São Paulo e recebeu as migrations e os dados locais. Cloudflare Pages está conectado ao GitHub e responde em `https://personalfit-bd3.pages.dev/`; domínio próprio ainda não foi configurado.

**CONFIRMADO NA FASE 2.1:** o stack local subiu com PostgreSQL em `127.0.0.1:54322`, API/Auth/Storage em `127.0.0.1:54321`, Studio em `127.0.0.1:54323` e caixa de e-mail local em `127.0.0.1:54324`. Auth, Storage e Studio responderam HTTP 200; o Vector de logs reinicia neste host e requer diagnóstico operacional separado.

## Plataforma prevista

**DECISÃO APROVADA:** PWA React, Supabase Auth/Storage e PostgreSQL. Ambientes e credenciais devem ser separados. Variáveis públicas do frontend não incluem chaves privilegiadas.

**DECISÃO APROVADA (ADR 0014):** GitHub guarda o monorepo; Cloudflare Pages servirá o frontend React/PWA e Supabase Cloud servirá PostgreSQL, Auth, API e Storage. O primeiro ambiente remoto será de testes, preferencialmente em São Paulo, com produção em projeto Supabase separado. A configuração do build usará somente URL e chave publicável do ambiente. Planos gratuitos são ponto de partida para testes; disponibilidade e backups para clientes reais exigem revisão antes do piloto.

## Preparação para produção

**PENDENTE:** validar login e RLS pelo aplicativo contra o projeto remoto, confirmar a leitura do logotipo por uma conta vinculada, verificar as variáveis públicas do build no Pages, definir estratégia de branches/ambientes, domínio próprio, convites/e-mail, monitoramento de erros, métricas de fila, backups de banco e objetos, retenção, restauração ensaiada, limites de custo e política de incidentes. Nunca aplicar o seed fictício de desenvolvimento em produção.

**CONFIRMADO NA CÓPIA PARA TESTES (2026-11-02):** as 21 migrations foram aplicadas no projeto remoto sem seed. A cópia dos dados de `auth.users`, `auth.identities` e `public` foi ensaiada em transação revertida e então executada. O backup completo do PostgreSQL local e uma cópia do volume de Storage foram guardados apenas em `.build-tmp/`, ignorada pelo Git. Sessões e tokens Auth locais não foram importados. Após autorização específica do usuário, o único logotipo privado foi enviado ao bucket remoto; download e SHA-256 coincidiram com o arquivo local.

**CONFIGURAÇÃO DO CLOUDFLARE PAGES (2026-11-03):** conectar o repositório GitHub `jfontineli/personalfit` em **Workers & Pages → Create application → Pages → Import an existing Git repository**. Usar branch `main`, diretório raiz do repositório (`.`), comando `npm run build` e diretório de saída `apps/web/dist`. `.node-version` fixa Node 24. Configurar `VITE_SUPABASE_URL` com a URL do projeto Supabase de teste e `VITE_SUPABASE_PUBLISHABLE_KEY` com sua chave publicável (`sb_publishable_…`) nas variáveis de build do Pages. Não usar chave secreta. Sem `404.html` na saída, o Pages serve a SPA também nas rotas `/login`, `/admin` e `/aluno/inicio`. O domínio próprio é conectado ao projeto Pages depois da primeira publicação; a URL do GitHub Pages não é um domínio cadastrável no Cloudflare.

**CONFIRMADO NA PREPARAÇÃO DO FRONTEND (2026-11-03):** lint, 12 testes unitários e build PWA passaram com as variáveis públicas do Supabase remoto. O bundle contém a URL e a chave publicável esperadas; nenhuma chave `sb_secret_` completa foi encontrada. A autenticação da máquina no Wrangler e a publicação direta ocorreram em 2026-11-04.

**CONFIRMADO EM 2026-11-03, BANCO DE TESTE:** `supabase db push --linked --dry-run` listou 12 migrations pendentes de nutrição e execução guiada; `supabase db push --linked --yes` aplicou as 12 sem seed ou reset.

**CONFIRMADO EM 2026-11-04, PUBLICAÇÃO DE TESTE:** o commit `9d5ace7` foi enviado à `main`; CI e GitHub Pages passaram. O projeto Cloudflare Pages `personalfit` permaneceu no build anterior após o push, apesar de indicar Git provider conectado. Após OAuth com escopos de Pages e leitura da conta, `wrangler pages deploy apps/web/dist --project-name personalfit --branch main --commit-hash 9d5ace7` publicou o build com URL e chave publicável do Supabase Cloud. `https://personalfit-bd3.pages.dev/`, `/login` e `/aluno/inicio` passaram a servir o JS/CSS novo; o CSS contém o layout compacto de nutrição. O Auth remoto respondeu HTTP 200 com chave publicável. Chrome em 390 px renderizou os campos de login sem rolagem horizontal. **PENDENTE:** diagnosticar por que o push não acionou deploy automático do Cloudflare; testar login autenticado e fluxos reais no celular.

## White-label e domínios

**DECISÃO APROVADA:** marca básica é por tenant; domínio personalizado está adiado. A configuração não pode depender de um nome ou cor fixa do primeiro profissional.

**HIPÓTESE:** a primeira URL usará domínio da plataforma, com identificador de tenant. Trocar a origem da PWA no futuro muda o armazenamento do navegador; a migração deve exigir sincronização prévia e orientar reinstalação.

**NECESSITA VALIDAÇÃO HUMANA:** região de armazenamento, orçamento mensal, endereço comercial inicial e quem operará incidentes.
