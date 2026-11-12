# Estado atual — referência de 11/11/2026

## HEAD APROVADO

**CONFIRMADO** — Baseline documental e de agentes: `main`, `29239a5ac0a9083223b847cb04b3084ceeeb79fb` (10/11). O commit torna o bootstrap reproduzível no HEAD e está um commit à frente da referência local `origin/main`. O SHA por si só não atesta deploy.

## TRABALHO LOCAL NÃO COMMITADO

**TRABALHO LOCAL VALIDADO** — O ADR 0021, a migration de 09/11, o player, editor, serviço, estilo, pgTAP, E2E e documentação permanecem sem commit. Nome, instrução e vídeo atuais são resolvidos somente para a versão atual atribuída e aberta; sessões de versão anterior ou terminais usam o snapshot completo. O fluxo linear remove o adiamento isolado, preserva pausa e alternativa aprovada e mantém a versão original após republicação.

## PUBLICADO EM TESTE

**CONFIRMADO** — Na auditoria pública de 10/11, Pages respondeu HTTP 200 e apontou para assets diferentes dos do build local. **HISTÓRICO** — Há registro de migrations remotas até `20261104030000` e deploy direto do frontend de teste. **DESCONHECIDO** — SHA servido e ledger remoto atuais. Consulte a [evidência operacional](INFRASTRUCTURE.md).

## PLANEJADO

**DECISÃO APROVADA** — Anamnese configurável pelo personal e produção em ambiente separado. **PENDENTE** — modelo e acesso das respostas, avaliação básica, expansão do acompanhamento e preparação operacional. Veja o [escopo](PROJECT_CONTEXT.md).

## RISCOS ABERTOS

Prioridades: cache privado após negação e coerência perfil/vínculo. Filas, confirmação alimentar, segurança do alvo E2E e cobertura da CI também têm lacunas. Cada condição de encerramento está em [dívida aberta](TECH_DEBT.md). **NECESSITA VALIDAÇÃO HUMANA** — tratamento das revisões Git e cópias anteriores que contêm informações identificáveis.

## ÚLTIMA VALIDAÇÃO

**CONFIRMADO localmente** — Em 10–11/11, a árvore funcional passou por lint, 20 testes Vitest, build PWA, replay e seed em Supabase descartável separado, 278 verificações pgTAP e oito jornadas Playwright. Nenhuma publicação remota foi realizada. Veja [testes](TESTING.md).
