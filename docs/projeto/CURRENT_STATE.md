# Estado atual — referência de 11/11/2026

## HEAD APROVADO

**CONFIRMADO** — `main` e `origin/main` apontam para `d8f040f555aa239a17e3b314f5c46e7e1a48d587`, que contém o checkpoint agent-ready `29239a5` e a implementação do ADR 0021. O workflow GitHub do push concluiu com sucesso.

## ADR 0021

**CONFIRMADO no código e schema de TESTE; comportamento autenticado validado localmente** — Nome, instrução e vídeo atuais são resolvidos somente para a versão atual atribuída e aberta; sessões de versão anterior ou terminais usam o snapshot completo. O fluxo linear remove o adiamento isolado, preserva pausa e alternativa aprovada e mantém a versão original após republicação. O cenário autenticado integral não foi repetido no remoto por ausência de fixture fictícia documentada.

## PUBLICADO EM TESTE

**CONFIRMADO · 11/11/2026** — O Supabase `PersonalFit Teste` tem ledger coincidente com as 38 migrations locais, inclusive `20261109000000`, que já estava aplicada quando verificada. O Pages de TESTE serve o SHA `d8f040f` pelo deployment `2b9f102b-cac4-45d6-b5d2-d5fad3d38c11`; o domínio canônico entrega o bundle `index-C3GZEETU.js`, manifest e service worker. Consulte a [evidência operacional](INFRASTRUCTURE.md).

## PLANEJADO

**DECISÃO APROVADA** — Anamnese configurável pelo personal e produção em ambiente separado. **PENDENTE** — modelo e acesso das respostas, avaliação básica, expansão do acompanhamento e preparação operacional. Veja o [escopo](PROJECT_CONTEXT.md).

## RISCOS ABERTOS

Prioridades: cache privado após negação e coerência perfil/vínculo. Filas, confirmação alimentar, segurança do alvo E2E e cobertura da CI também têm lacunas. Cada condição de encerramento está em [dívida aberta](TECH_DEBT.md). **NECESSITA VALIDAÇÃO HUMANA** — tratamento das revisões Git e cópias anteriores que contêm informações identificáveis.

## ÚLTIMA VALIDAÇÃO

**CONFIRMADO** — Em 10–11/11, a árvore funcional passou por lint, 20 testes Vitest, build PWA, replay e seed em Supabase descartável separado, 278 verificações pgTAP e oito jornadas Playwright. Após o deploy, o Pages, SPA, login, manifest, service worker e assets responderam; rotas profissional e aluno permaneceram protegidas sem sessão. Auth remoto respondeu, a RPC negou anônimo e os buckets continuaram privados. Veja [testes](TESTING.md).
