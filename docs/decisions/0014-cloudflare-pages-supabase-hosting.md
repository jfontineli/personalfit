# ADR 0014 — Hospedagem web e banco gerenciado

- Data: 2026-11-02
- Status: **DECISÃO APROVADA**; ambiente remoto de teste publicado em 2026-11-04, produção pendente

## Contexto

O aplicativo precisa abrir no celular por HTTPS, preservar a PWA e acessar Auth, PostgreSQL e Storage. O objetivo é iniciar com custo zero e manter um caminho de operação para clientes reais.

## Decisão

Manter um monorepo com frontend em `apps/web/` e backend declarativo em `supabase/`. O código fica no GitHub. Cloudflare Pages hospedará a aplicação React/PWA; Supabase Cloud hospedará PostgreSQL, Auth, API e Storage. O primeiro projeto remoto será de testes, preferencialmente na região São Paulo. Produção terá projeto Supabase separado. O navegador receberá somente URL e chave publicável do projeto correspondente; chaves privilegiadas ficam fora do build. Começar nos planos gratuitos conforme os limites vigentes, com revisão de capacidade, backups e disponibilidade antes do uso por clientes reais.

## Consequências

- O deploy do frontend e as migrations do banco são processos separados, com configuração por ambiente.
- A hospedagem estática deve entregar as rotas da SPA e os recursos da PWA sob HTTPS.
- Um projeto gratuito pode pausar por inatividade; disponibilidade e backups de produção exigem plano e operação adequados.
- **CONFIRMADO NO AMBIENTE DE TESTE:** Supabase Cloud e Cloudflare Pages criados, migrations aplicadas sem seed, frontend publicado com URL e chave publicável. **PENDENTE:** validar Auth/Storage/RLS com sessões remotas, corrigir o deploy automático GitHub → Cloudflare, configurar domínio próprio quando houver e testar a PWA no celular.
