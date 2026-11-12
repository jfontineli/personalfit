# Dívida aberta

Cada linha é **PENDENTE** até haver evidência da condição de encerramento. Impactos possíveis identificados apenas por inspeção são **INFERIDOS**.

| Problema aberto | Impacto | Condição verificável de encerramento |
|---|---|---|
| Cache de treino/alimentação após leitura negada, vazia ou revogação | Conteúdo privado desatualizado pode permanecer em tela. | Testes distinguem ausência de rede, resultado vazio e 401/403; removem a exibição indevida e preservam as operações pendentes do titular. |
| Divergência entre perfil e membership | Convite de aluno ou reativação de cadastro pode criar vínculo ativo para perfil inativo. | pgTAP demonstra negação nas policies e RPCs afetadas, inclusive após convite e reativação. |
| NEEDS_ATTENTION e primeiro erro alimentar bloqueiam o restante da fila | Uma operação impede confirmações independentes. | Falha permanente fica visível e recuperável; operações independentes avançam mantendo a ordem por recurso. |
| Confirmação alimentar compara estado/mealId sem toda a identidade da operação em tela | Pode aparecer confirmação prematura para outra data, versão ou edição posterior. | Testar confirmação atrasada, estados repetidos e duas datas/versões preservando a pendência correta. |
| Concorrência entre abas/dispositivos e retenção dos recibos | Reenvio idempotente não resolve duas edições distintas ou sessão lógica duplicada. | Definir política de conflito e retenção e verificar concorrência, interrupção, replay e retomada com cliente antigo. |
| CI cobre apenas frontend | Regressões de schema, RLS e jornada podem passar no PR. | Workflow executa replay em banco descartável, pgTAP e jornadas críticas com resultado visível para falhas/skips. |
| Specs administrativos não garantem alvo descartável | Credencial/URL incorretas podem dirigir criação e limpeza a outro banco. | Pré-verificação recusa alvo não autorizado antes da primeira mutação; demonstrar em teste sem dados reais. |
| tenant_access_allowed exposto a authenticated por UUID | Revela um sinal de estado comercial sem membership no próprio helper. | Rever superfície pública e testar mínimo privilégio mantendo as policies consumidoras. |
| Logout, retenção e aparelho compartilhado | Dados privados e pendências sobrevivem à saída. | Política aprovada e testes para troca de conta, tenant, inativação e recuperação sem exposição ou perda. |
| Inspeção binária e ciclo de vida de mídia | MIME declarado e extensão não garantem conteúdo; custo e retenção não estão dimensionados. | Validar arquivos no servidor, demonstrar rejeição, preservação de referências e restauração de objetos. |
| Deploy, rollback e backups | CI verde não identifica bundle ativo; restauração conjunta de schema, objetos e cliente antigo não foi ensaiada. | Ligar SHA, bundle e ledger ao deploy, testar recuperação e documentar responsável e monitoramento. |
| Convites, troca de email, recuperação e MFA administrativo | Entrega manual e divergências entre Auth/cadastro dificultam operação. | Aprovar fluxos e validar expiração, revogação, recuperação e bloqueio administrativo. |
| Diagnóstico usa primeira membership ativa | Recibo técnico pode ir a outro espaço da mesma conta. | Usar contexto explícito e testar duas memberships, ou retirar o diagnóstico com decisão registrada. |
| Indicadores de sete dias, frequência, unidades e alertas em celular | Sinais simples e áudio em segundo plano têm limites para acompanhamento. | Profissionais aprovam interpretação de parcial e unidades; testes em aparelho registram limites de som, vibração e tela bloqueada. |
| Operação clínica, retenção e memória histórica identificável | Acesso, troca de nutricionista, revisão e descarte precisam de responsáveis. | Responsáveis validam credenciais, atribuições, conteúdo, acesso às cópias anteriores, retenção e exportação. |

[Segurança](SECURITY.md) · [Como verificar](TESTING.md) · [Infraestrutura](INFRASTRUCTURE.md)
