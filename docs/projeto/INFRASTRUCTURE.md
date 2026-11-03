# Infraestrutura e operação

## Estado

**CONFIRMADO:** `supabase/config.toml` configura o stack local via CLI/Docker; `.github/workflows/ci.yml` executa instalação, lint, testes de frontend e build. `infra/` permanece sem deploy. Não há projeto Supabase remoto, domínio ou hospedagem web configurados.

**CONFIRMADO NA FASE 2.1:** o stack local subiu com PostgreSQL em `127.0.0.1:54322`, API/Auth/Storage em `127.0.0.1:54321`, Studio em `127.0.0.1:54323` e caixa de e-mail local em `127.0.0.1:54324`. Auth, Storage e Studio responderam HTTP 200; o Vector de logs reinicia neste host e requer diagnóstico operacional separado.

## Plataforma prevista

**DECISÃO APROVADA:** PWA React, Supabase Auth/Storage e PostgreSQL. Ambientes e credenciais devem ser separados. Variáveis públicas do frontend não incluem chaves privilegiadas.

**DECISÃO APROVADA (ADR 0014):** GitHub guarda o monorepo; Cloudflare Pages servirá o frontend React/PWA e Supabase Cloud servirá PostgreSQL, Auth, API e Storage. O primeiro ambiente remoto será de testes, preferencialmente em São Paulo, com produção em projeto Supabase separado. A configuração do build usará somente URL e chave publicável do ambiente. Planos gratuitos são ponto de partida para testes; disponibilidade e backups para clientes reais exigem revisão antes do piloto.

## Preparação para produção

**PENDENTE:** criar e validar projeto Supabase remoto, confirmar a região escolhida, configurar Cloudflare Pages e variáveis de build, definir estratégia de branches/ambientes, domínio inicial, certificados, convites/e-mail, monitoramento de erros, métricas de fila, backups de banco e objetos, retenção, restauração ensaiada, limites de custo e política de incidentes. Nunca aplicar o seed fictício de desenvolvimento em produção.

## White-label e domínios

**DECISÃO APROVADA:** marca básica é por tenant; domínio personalizado está adiado. A configuração não pode depender de um nome ou cor fixa do primeiro profissional.

**HIPÓTESE:** a primeira URL usará domínio da plataforma, com identificador de tenant. Trocar a origem da PWA no futuro muda o armazenamento do navegador; a migração deve exigir sincronização prévia e orientar reinstalação.

**NECESSITA VALIDAÇÃO HUMANA:** região de armazenamento, orçamento mensal, endereço comercial inicial e quem operará incidentes.
