# Regras de negócio aprovadas

**DECISÃO APROVADA EM 2026-11-04:** o treino do aluno privilegia a sequência de execução; conteúdo complementar é acessado em área própria, somente após preenchimento e publicação pelo profissional. O cardio prescrito pode detalhar inclinação e velocidade por intervalos, mas o aluno registra a duração total realizada. O treino de esteira informado pelo usuário foi aplicado como nova versão nos cinco dias do plano de teste do Jean, sem sobrescrever o histórico.

**DECISÃO APROVADA E CONFIRMADA LOCALMENTE EM 2026-11-04:** o personal decide por item se um alongamento exige registro de carga ou apenas conclusão. No segundo caso, o aluno usa “Marcar como feito”, sem declarar tempo ou repetições fictícios. O personal cadastra atividade Cardio na própria biblioteca e prescreve duração individual; o aluno informa os minutos executados. O sistema não gera treino nem troca cardio automaticamente.

## Tenant e aluno

**DECISÃO APROVADA:** cada tenant possui marca e dados próprios. Um profissional não acessa dados de outro tenant; um aluno não acessa outro aluno. O primeiro cliente não recebe exceção de arquitetura.

**CONFIRMADO:** o superadmin cria o tenant e um convite de uso único para o primeiro personal. O convite expira em 48 horas e exige conta Auth com email confirmado igual ao informado. O personal ativa o próprio acesso, sem receber senha do superadmin. A criação do tenant e a ativação são auditadas. O superadmin não recebe vínculo nem acesso aos dados privados desse tenant. O personal então cadastra e convida seus alunos pelo fluxo já implementado.

**CONFIRMADO NA GESTÃO DA PLATAFORMA:** novos espaços iniciam com avaliação de 30 dias. O superadmin pode escolher tipo de plano, data final ou prazo indeterminado e suspender/reativar o acesso. A data final inclui todo o dia em `America/Sao_Paulo`. Plano suspenso ou vencido bloqueia acesso ao espaço sem apagar alunos, vínculos ou histórico. Tipos de plano ainda não definem preço, recursos ou limites; cobrança e renovação automática não existem.

**DECISÃO APROVADA:** a experiência do aluno apresenta a identidade, os contatos e o conteúdo do seu profissional. Dados, exercícios, vídeos e orientações próprios são isolados por tenant; eventual conteúdo global da plataforma apenas auxilia o trabalho do profissional.

**CONFIRMADO NA FASE 3:** profissional com vínculo ativo pode cadastrar, editar, inativar e reativar alunos do próprio tenant. O aluno pode existir sem conta. Inativação desativa seu vínculo e impede leitura do cadastro pela conta, sem apagar o registro. A sessão Auth pode permanecer válida, mas RLS nega os recursos do tenant. Operações futuras offline e retenção seguem **PENDENTES**.

**CONFIRMADO NA FASE 3:** convite é gerado pelo profissional para aluno ativo ainda sem conta. Só o hash SHA-256 fica no banco; o link com token aparece uma vez na tela para entrega manual. Expira em 48 horas, só pode ser usado uma vez e exige conta Auth com email confirmado igual ao cadastro. Um novo convite invalida o anterior. A ativação cria vínculo ALUNO e liga `user_id` ao cadastro na mesma transação.

**CONFIRMADO NA FASE 3:** email de aluno não pode se repetir no mesmo tenant mesmo com letras em caixa diferente. O mesmo email pode existir em tenants diferentes; a identidade Auth é única e pode ter múltiplos vínculos. Troca de email após ativação e entrega automática de convites estão **PENDENTES**.

## Prescrição

**DECISÃO APROVADA:** treino possui dias, exercícios e séries prescritas. O profissional trabalha em rascunho e publica versão. Uma publicação anterior permanece interpretável e associada às sessões que a utilizaram. Atribuição determina qual versão o aluno pode usar.

**CONFIRMADO NA NAVEGAÇÃO:** o personal define a sequência dos dias e dos exercícios no rascunho e a publicação a preserva. Nas novas versões ele também define o início e a duração do ciclo. O aluno vê um dia por vez, consulta as semanas do ciclo e registra cada execução no dia prescrito e na semana correspondente. Versões antigas continuam organizadas pela semana de calendário. O primeiro dia sem resultado terminal é destacado; a plataforma não escolhe exercícios nem reescreve a prescrição.

**DECISÃO APROVADA:** o profissional cria seus exercícios, vídeos e instruções e é responsável por criar o treino. O MVP não sugere nem monta treinos automaticamente. Alterar um exercício, vídeo ou orientação na biblioteca não reescreve o conteúdo efetivamente prescrito nas versões publicadas nem o histórico do aluno.

**CONFIRMADO NO PRIMEIRO CICLO:** o personal cadastra e edita seus exercícios/instruções, envia vídeo MP4 privado e organiza rascunho por dias para um aluno. Publicar cria outra versão, preserva o snapshot anterior e atribui a nova ao aluno. Vídeo referenciado por versão publicada não pode ser excluído pela API do profissional. O cadastro do plano de atendimento do aluno registra nome, início, fim previsto e estado, sem cobrança ou bloqueio automático nesta etapa.

**HIPÓTESE:** editar um plano publicado abre novo rascunho a partir da versão mais recente. Publicar poderá exigir confirmação e motivo, para auditoria. O produto não aplicará progressão automática no MVP.

## Execução

**DECISÃO APROVADA:** aluno registra carga, placa, repetições, tempo e RIR opcional por série; marca série concluída; conclui ou pula exercício; pode terminar treino parcial; usa timer de descanso. Uma sessão iniciada usa a versão da prescrição capturada no início.

**HIPÓTESE:** `concluído`, `pulado` e `não realizado` serão estados distintos; treino parcial não será contado como treino integral na frequência. A regra exata de frequência e correção de sessão exige validação no desenho funcional.

**DECISÃO APROVADA:** histórico não desaparece nem muda porque a prescrição foi editada. Carga em kg e número de placa não são a mesma unidade e não serão convertidos sem configuração de equipamento.

## Avaliação

**DECISÃO APROVADA:** avaliação básica guarda peso/medidas, data, responsável e observações. Não há análise corporal complexa no MVP.

## Offline

**DECISÃO APROVADA:** dados críticos da execução são salvos localmente antes de depender da rede; status local e remoto são diferenciados. Reenvio não cria duplicatas. Erro permanente não elimina a operação local silenciosamente.

**DECISÃO APROVADA:** não há botão de download offline. O aluno pode lançar séries e concluir uma sessão sem internet usando a prescrição já disponível no aparelho; o aplicativo envia os lançamentos ao reconectar e mostra a confirmação ou pendência. Vídeos próprios do profissional permanecem para consulta online no MVP.

**CONFIRMADO NO CICLO ATUAL:** repetições ou segundos, carga opcional e repetições que sobrariam opcionais por série são gravados com a operação pendente na mesma transação IndexedDB. Reenvio da mesma operação mantém uma única sessão no servidor. A versão de uma sessão iniciada não muda se outra for publicada. Dia completo exige todas as séries; dia encerrado com faltas fica `PARTIAL` e não conta como completo. Placa, pulo explícito de exercício e relatório de frequência ainda não foram implementados.

**CONFIRMADO EM 2026-11-02:** descanso prescrito e tipo/alvo de cada série aparecem no treino; RIR opcional pode ser lançado e sincronizado. Observação individual não é gravada na biblioteca reutilizável. Rascunho marcado para revisão não pode ser publicado até o profissional declarar a revisão concluída e salvar/publicar o plano.

**CONFIRMADO EM 2026-11-02:** o profissional escolhe no item prescrito entre série de treino e preparação. Preparação usa etapas com tempo ou repetições, sem campo de carga ou RIR; o servidor também rejeita esses campos nas novas versões. Após o último registro de um exercício, a interface avança para o próximo exercício pendente do dia. O aluno ainda pode abrir outro exercício manualmente.

**CONFIRMADO EM 2026-11-02:** cada exercício da biblioteca própria pode receber um grupo principal para busca e organização, editável pelo profissional. A classificação não altera a versão publicada. Instrução em vídeo é opcional: sua ausência não bloqueia cadastro nem publicação do treino, e o aluno vê vídeo apenas quando há um link válido no exercício publicado.

**CONFIRMADO EM 2026-11-02:** o profissional salva os dados e a escolha de vídeo do exercício em um único fluxo. Pode manter ou remover o vídeo, indicar link HTTPS do YouTube ou enviar MP4 privado. As fontes são alternativas e o link externo depende de internet e da disponibilidade/visibilidade configurada no YouTube. Prescrições publicadas preservam o endereço de vídeo do snapshot original.

**DECISÃO APROVADA NO ADR 0013:** vídeo de instrução é mídia compartilhada da biblioteca própria. Atualizá-lo não exige publicar novamente o plano de cada aluno: quem tem o exercício prescrito consulta a mídia atual quando está online. A publicação individual continua necessária para mudar séries, ordem, instruções e orientações do aluno. O snapshot antigo permanece como registro histórico.

## Contato e identidade

**DECISÃO APROVADA:** contato por WhatsApp vem da configuração do tenant. Nome, cores, logo, telefone e textos específicos não entram como constantes do produto.

**DECISÃO APROVADA:** nome e foto do profissional, logo, cores e contatos compõem sua identidade no produto. Dietas e acompanhamento fazem parte da experiência oferecida no espaço do personal. Conforme os ADRs 0015 e 0016, a prescrição alimentar individual é criada e publicada por nutricionista autorizado para o aluno; o personal só pode fazê-lo quando também atuar como nutricionista vinculado. O primeiro editor estruturado funciona localmente, com validação clínica e implantação remota pendentes.

**CONFIRMADO LOCALMENTE — TRANSCRIÇÃO GH:** a dieta individual do Jean foi copiada da planilha fornecida pelo usuário para rascunho privado, distinguindo dia alto e baixo. O nutricionista atribuído deve revisar o conteúdo e confirmar a transcrição antes de publicar. A escolha do ciclo pelo aluno é explícita; o sistema não prescreve nem alterna os dias automaticamente. Medicamentos, suplementos, exames e orientações com datas vencidas exigem revisão clínica e não são mostrados automaticamente ao aluno a partir da importação.
**DECISÃO APROVADA — PERSONAL NUTRICIONISTA:** o personal que também é nutricionista pode assumir explicitamente a prescrição de um aluno sem nutricionista ativo, usando a mesma conta. Isso não concede acesso clínico automático aos demais alunos. A verificação humana do CRN continua obrigatória antes de uso real; ver ADR 0016.

**DECISÃO APROVADA — PERSONALIZAÇÃO DA FONTE:** informações trazidas da referência são ponto de partida editável para o aluno específico, não uma prescrição pronta. O nutricionista pode corrigir quantidades e orientações, acrescentar ou remover notas e decidir individualmente o que será mostrado ao aluno. O conteúdo importado permanece privado por padrão e requer confirmação clínica antes de publicar.

**CONFIRMADO LOCALMENTE — EXECUÇÃO GUIADA (ADR 0017):** o personal publica alternativas individuais aprovadas; o aluno escolhe uma somente para a sessão daquele dia, antes da primeira série. O principal continua prescrito. Sem alternativa, pode registrar aparelho indisponível para o personal, inclusive offline. `PAUSED` é retomável; `PARTIAL` continua terminal. Há relógio de tempo ativo, descanso visual com tentativa de som/vibração, avanço ao próximo exercício, referência de carga e esforço e última carga registrada. A ordem dos dias segue a prescrição, mas o aluno pode fazer o dia pendente em qualquer data da semana vigente.
