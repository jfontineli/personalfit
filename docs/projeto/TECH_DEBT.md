# Dívida técnica e riscos abertos

Este arquivo não chama de dívida algo que ainda não foi implementado. Ele registra escolhas adiadas e riscos para evitar esquecimento.

| Item | Classificação | Condição para resolver |
|---|---|---|
| Matriz de permissões da Fase 3 | CONFIRMADO | Implementada em RLS/grants e documentada em AUTHORIZATION.md; ampliar para módulos futuros |
| Entrega e reenvio de convites | PENDENTE | Antes de operação com alunos reais; hoje o link é exibido para entrega manual |
| Troca de email após ativação | PENDENTE | Definir reconciliação entre Auth, perfil e cadastro |
| SUPER_ADMIN operacional | PENDENTE | Criar contratos servidor auditados e MFA antes de administração real |
| Auditoria e retenção | PENDENTE | Auditoria mínima existe; definir retenção, exportação e proteção operacional |
| Diagnóstico técnico com múltiplos tenants | PENDENTE | A fila de teste continua escolhendo o primeiro vínculo ativo; substituir por contexto explícito se esse diagnóstico continuar após a Fase 3. Não afeta dados de aluno |
| Política de conflito entre dispositivos | PENDENTE | Antes da API de sincronização |
| Retenção de IDs de idempotência | PENDENTE | Antes da API de sincronização |
| Convenção de carga versus placa | PENDENTE | Antes da tela de registro |
| Frequência e treino parcial | NECESSITA VALIDAÇÃO HUMANA | Antes dos relatórios |
| Acesso a pendências de aluno inativado | NECESSITA VALIDAÇÃO HUMANA | Antes de liberar inativação |
| Base legal, retenção e responsabilidade | NECESSITA VALIDAÇÃO HUMANA | Antes do piloto |
| Backup de objetos do Storage | PENDENTE | Antes de guardar arquivos privados |
| Subdomínio/domínio próprio | DECISÃO APROVADA: adiado | Quando plano comercial exigir |
| Dieta estruturada | DECISÃO APROVADA: adiada | Quando escopo e autoria forem aprovados |
| Fotos corporais | DECISÃO APROVADA: adiadas | Após política de privacidade e storage |

**PENDENTE:** a fila só envia manualmente operações técnicas; não há worker de negócio, política de conflito nem retenção de recibos. O ícone PWA é temporário. Essas pendências precisam ser resolvidas antes de dados reais ou piloto.

**CONFIRMADO:** o bloqueio de validação da Fase 2 foi resolvido: Docker Desktop voltou a funcionar e migration, seed, pgTAP, login e E2E passaram. O host ainda tem pouco espaço livre em C:; o serviço Vector local reinicia por não alcançar a origem de logs do Docker. Monitorar capacidade e logs antes do piloto; esses pontos não invalidaram os serviços técnicos necessários da Fase 2.1.
