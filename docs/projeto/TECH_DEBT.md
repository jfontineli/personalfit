# Dívida técnica e riscos abertos

Este arquivo não chama de dívida algo que ainda não foi implementado. Ele registra escolhas adiadas e riscos para evitar esquecimento.

| Item | Classificação | Condição para resolver |
|---|---|---|
| Matriz de permissões da Fase 3 | CONFIRMADO | Implementada em RLS/grants e documentada em AUTHORIZATION.md; ampliar para módulos futuros |
| Entrega e reenvio de convites | PENDENTE | Antes de operação com alunos reais; hoje o link é exibido para entrega manual |
| Troca de email após ativação | PENDENTE | Definir reconciliação entre Auth, perfil e cadastro |
| SUPER_ADMIN operacional | PENDENTE | Criação/listagem de espaços e gestão básica de plano/acesso usam RPCs auditadas; MFA, limites e operação real ainda pendentes |
| Plano comercial e cobrança | PENDENTE | Categorias de acesso e prazo existem; definir preços, benefícios, pagamentos, renovação e avisos antes de comercializar |
| Convite profissional | PENDENTE | Definir entrega automática, reenvio/cancelamento, expiração de tenants sem ativação e recuperação de conta |
| Auditoria e retenção | PENDENTE | Auditoria mínima existe; definir retenção, exportação e proteção operacional |
| Diagnóstico técnico com múltiplos tenants | PENDENTE | A fila de teste continua escolhendo o primeiro vínculo ativo; substituir por contexto explícito se esse diagnóstico continuar após a Fase 3. Não afeta dados de aluno |
| Política de conflito entre dispositivos | PENDENTE | O primeiro ciclo recusa revisão obsoleta; definir reconciliação para dois dispositivos e ação de recuperação na interface |
| Retenção de IDs de idempotência | PENDENTE | Recibos de sessão já existem; definir prazo e limpeza segura antes do piloto |
| Convenção de carga versus placa | PENDENTE | Primeiro ciclo registra apenas kg; definir unidade de placa antes de adicioná-la |
| Frequência e classificação de treino parcial | NECESSITA VALIDAÇÃO HUMANA | O status `PARTIAL` já existe e não é contado como dia completo; definir peso na frequência e correções antes dos relatórios |
| Acesso a pendências de aluno inativado | NECESSITA VALIDAÇÃO HUMANA | Antes de liberar inativação |
| Base legal, retenção e responsabilidade | NECESSITA VALIDAÇÃO HUMANA | Antes do piloto |
| Backup de objetos do Storage | PENDENTE | O bucket privado de logotipos já existe; definir backup e restauração antes do piloto |
| Validação binária de imagens | PENDENTE | O bucket limita tamanho e MIME; validar assinatura e processar imagens antes de aceitar mídia de maior risco |
| Biblioteca e mídia próprias do profissional | CONFIRMADO primeiro ciclo | Exercício, instruções e MP4 privado implementados; melhorar edição, processamento e limites da mídia antes do piloto |
| Revisão de prescrições importadas | CONFIRMADO no primeiro espaço local | O profissional concluiu a revisão e publicou a versão 1 de cinco dias; a trava em UI e banco continua disponível para próximos rascunhos importados |
| Preservação histórica de conteúdo próprio | CONFIRMADO primeiro ciclo | Publicação fixa nome, instruções e referência do vídeo; exclusão de vídeo publicado é negada |
| Plano de atendimento do aluno | PENDENTE regra comercial | Nome, vigência e estado existem sem cobrança ou bloqueio; definir tipos, serviços, avisos e efeito do vencimento |
| Execução completa do treino | PENDENTE | Ciclo atual registra repetições ou tempo, carga opcional, RIR e resultado completo/parcial; ampliar placa, timer, pulo e frequência |
| Mídia de exercícios | PENDENTE produção | Validar binário MP4, processar/comprimir, medir tráfego, backup/retensão e tratamento de vídeos antigos |
| Histórico de mídia | PENDENTE | A reprodução do treino atual usa mídia atual da biblioteca; uma futura tela de histórico deve distinguir mídia atual da referência preservada na versão e definir retenção dos arquivos antigos |
| White-label ampliado | PENDENTE | Cores, contatos e upload privado de logo existem; ampliar para foto, demais elementos e cache sem misturar tenants |
| Autoria de treinos | DECISÃO APROVADA | O profissional cria a prescrição; não incluir sugestão ou montagem automática no MVP |
| Subdomínio/domínio próprio | DECISÃO APROVADA: adiado | Quando plano comercial exigir |
| Implantação remota | CONFIRMADO ambiente de teste; validação pendente | Supabase Cloud e Cloudflare Pages recebem o código atual; validar login/RLS autenticados, Storage e PWA no celular antes de usar dados reais. Corrigir o gatilho GitHub → Cloudflare, que não publicou o commit `9d5ace7` automaticamente |
| Fixtures pgTAP dependentes do seed | PENDENTE | Tornar os testes de banco autossuficientes ou executá-los em ambiente descartável com seed, sem resetar o banco local preservado |
| Dieta estruturada | Primeiro fluxo e E2E CONFIRMADOS localmente | Validar CRN e conteúdo por humano, troca/revogação do parceiro, vigência, conflitos entre dispositivos e consentimento de compartilhamento; ver ADR 0015 |
| Fotos corporais | DECISÃO APROVADA: adiadas | Após política de privacidade e storage |

**CONFIRMADO LOCALMENTE:** a mesma conta pode atuar como personal e nutricionista após atribuição explícita ao aluno; ver ADR 0016. **PENDENTE:** checagem humana do CRN, fluxo de revogação e regras de substituição do responsável nutricional.

**PENDENTE — DIETA GH IMPORTADA:** o rascunho local do Jean requer revisão clínica linha a linha pelo nutricionista vinculado, inclusive medicações, suplementos, exames, equivalências, datas passadas e escolha do ciclo alto/baixo. Nenhuma versão foi publicada. TypeScript, lint e build PWA completos passaram em instalação isolada; os E2E ajustados ainda precisam ser executados. A instalação de dependências no workspace principal falhou por `EPERM` em binário em uso. A migration `20261103050000` e a interface de ciclos ainda não foram implantadas no Cloud.

**CONFIRMADO — ORGANIZAÇÃO DO EDITOR NUTRICIONAL:** TypeScript, lint, 13 testes unitários, build PWA e dois E2E de nutrição passaram após a reorganização da tela em etapas e cartões recolhidos. **PENDENTE:** validar a experiência com nutricionista; o rascunho importado continua sem revisão clínica e sem publicação.

**CONFIRMADO LOCALMENTE — NOTAS INDIVIDUAIS:** editor por aluno e filtro de publicação foram acrescentados; o texto importado permanece separado como fonte privada. **PENDENTE:** revisão humana de cada linha clínica e do CRN, teste manual da interface com nutricionista e aplicação da migration `20261103060000` no Cloud. O rascunho real do Jean permanece sem publicação.

**PENDENTE:** a fila de treino envia ao voltar online e expõe pendência/erro; faltam reconciliação entre dispositivos, recuperação de erro permanente, retenção de recibos e política de operações após inativação. A fila do diagnóstico técnico permanece separada. O ícone PWA é temporário. Essas pendências precisam ser resolvidas antes de dados reais ou piloto.

**PENDENTE:** sessões anteriores à identificação de dia/semana permanecem sem essa classificação; não foram inferidas a partir de séries antigas. A navegação usa a versão atualmente publicada e não oferece histórico completo de versões antigas nem correção retroativa. A regra para repetir um mesmo dia na mesma semana exige desenho funcional. **DECISÃO APROVADA:** a prévia da experiência do aluno antes de publicar não integra esta rodada e permanece pendente.

**CONFIRMADO:** o bloqueio de validação da Fase 2 foi resolvido: Docker Desktop voltou a funcionar e migration, seed, pgTAP, login e E2E passaram. O host ainda tem pouco espaço livre em C:; o serviço Vector local reinicia por não alcançar a origem de logs do Docker. Monitorar capacidade e logs antes do piloto; esses pontos não invalidaram os serviços técnicos necessários da Fase 2.1.

**CONFIRMADO LOCALMENTE — TREINO GUIADO:** alternativa aprovada por item, mídia privada da alternativa, aviso de aparelho indisponível, pausa retomável, tempo ativo, descanso, última carga e progresso visual foram implementados e percorridos pelo E2E. **PENDENTE:** aplicar migrations e frontend no Cloud, testar som/vibração e cronômetro em celular real, decidir repetição do mesmo dia na semana, recuperar conflitos entre dois dispositivos, histórico completo de versões e exibir corretamente o nome do exercício de versões antigas no aviso ao personal. O valor de carga anterior é referência, não prescrição automática.
