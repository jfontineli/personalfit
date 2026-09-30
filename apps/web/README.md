# Aplicação web

**CONFIRMADO:** frontend técnico React 19, TypeScript 5, Vite 8 e PWA com service worker gerado no build.

A Fase 3 oferece `/login`, contexto do tenant em `/app`, lista/cadastro/detalhe de alunos em `/app/alunos`, marca em `/app/configuracoes`, área simples do aluno em `/aluno/inicio` e ativação por convite em `/ativar`. Os dados passam por `services/business.ts` e RLS/grants no Supabase. O diagnóstico da Fase 2 está em `/diagnostico`, incluindo login/logout/renovação técnica, IndexedDB e envio manual de operação técnica. Não há treino, prescrição nem sincronização de dados de aluno. A sessão Auth usa IndexedDB; a PWA guarda apenas arquivos estáticos no Cache Storage.

Contratos e limites: `../../docs/projeto/ARCHITECTURE.md`, `../../docs/projeto/AUTHORIZATION.md` e `../../docs/projeto/API.md`.
