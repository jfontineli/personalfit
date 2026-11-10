# Testes

## COMO EXECUTAR

Execute na raiz com Node 24 e dependências instaladas por npm ci.

| Verificação | Comando e requisitos |
|---|---|
| Estática e build | `npm run lint` e `npm run build`. O build inclui TypeScript, bundle Vite, manifest e service worker. |
| Vitest | `npm test`. As suítes em apps/web/src exercitam rotas, serviços, calendário, diagnóstico e stores IndexedDB. |
| pgTAP | Em Supabase local **descartável**, com Docker ativo, use `npm run db:start`, confira o alvo, execute `npm run db:reset` para replay e seed e depois `npm run db:test`. O reset apaga dados do alvo. |
| Playwright | Instale Chromium com `npx playwright install chromium`, faça build com variáveis públicas locais e execute `npm run test:e2e`. O runner usa preview em 127.0.0.1:4173. |
| CI atual | GitHub Actions em push/PR roda npm ci, lint, Vitest e build. Replay de migrations, pgTAP e Playwright ficam fora do workflow. |

**E2E potencialmente destrutivo.** Alguns specs criam contas com Auth Admin, alteram registros e removem fixtures e objetos na limpeza. Antes de executar, confirme que VITE_SUPABASE_URL, chave publicável do build e SUPABASE_SERVICE_ROLE_KEY do processo apontam para o mesmo backend descartável. A presença das variáveis, verificada pelos specs, não garante esse isolamento. Nunca usar projeto compartilhado ou de produção como alvo. Não persistir a chave administrativa no ambiente web.

## Cobertura e limitações

O pgTAP cobre identidade, superadmin, convite, A/B entre tenants e entre alunos, acesso suspenso, treino, mídia privada, publicação/versionamento, sessão, idempotência, nutrição, dupla atuação e notas individuais. Há suítes que pressupõem o seed e suítes que montam fixtures em transação. Os E2E atravessam cadastro, marca, nutrição, publicação e registro offline com reconexão. A ausência de fixtures ou variáveis pode pular casos.

**PENDENTE** — Usar IDs válidos de fixtures, inclusive entre tenants, para provar a barreira do recurso. Incluir versão histórica em segundo dispositivo, concorrência, revogação e proteção de mídia alternativa na validação dos respectivos reparos.

## RESULTADOS HISTÓRICOS

- **HISTÓRICO · 03/11/2026** — Registro de pgTAP de nutrição (29 verificações) e dupla atuação (15), com jornadas locais de publicação e leitura. Suítes legadas dependiam de fixtures ausentes no banco preservado.
- **HISTÓRICO · 04–05/11/2026** — Rodada isolada de guias/cardio registrou 101 verificações pgTAP, 14 testes unitários e build. Uma rodada E2E registrou seis aprovações, um pulo e timeout no cenário extenso de treino. Houve validação humana de um fluxo em celular, sem comprovar áudio em segundo plano.

**DESCONHECIDO** — Resultado integral atual em ambiente limpo. Nesta preparação documental não foram executados testes de aplicação. [Workflow](../../.github/workflows/ci.yml) · [pgTAP](../../supabase/tests) · [Playwright](../../apps/web/e2e)
