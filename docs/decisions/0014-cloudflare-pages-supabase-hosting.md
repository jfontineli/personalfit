# ADR 0014 — Hospedagem web e banco gerenciado

- Data: 2026-11-02
- Status: **DECISÃO APROVADA**, implantação pendente

## Contexto

O aplicativo precisa abrir no celular por HTTPS, preservar a PWA e acessar Auth, PostgreSQL e Storage. O objetivo é iniciar com custo zero e manter um caminho de operação para clientes reais.

## Decisão

Manter um monorepo com frontend em `apps/web/` e backend declarativo em `supabase/`. O código fica no GitHub. Cloudflare Pages hospedará a aplicação React/PWA; Supabase Cloud hospedará PostgreSQL, Auth, API e Storage. O primeiro projeto remoto será de testes, preferencialmente na região São Paulo. Produção terá projeto Supabase separado. O navegador receberá somente URL e chave publicável do projeto correspondente; chaves privilegiadas ficam fora do build. Começar nos planos gratuitos conforme os limites vigentes, com revisão de capacidade, backups e disponibilidade antes do uso por clientes reais.

## Consequências

- O deploy do frontend e as migrations do banco são processos separados, com configuração por ambiente.
- A hospedagem estática deve entregar as rotas da SPA e os recursos da PWA sob HTTPS.
- Um projeto gratuito pode pausar por inatividade; disponibilidade e backups de produção exigem plano e operação adequados.
- **PENDENTE:** criar os projetos remotos, configurar variáveis públicas no Cloudflare Pages, aplicar migrations sem seed fictício de desenvolvimento, validar Auth/Storage/RLS, configurar domínio e testar a PWA no celular.
