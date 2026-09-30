# Regras de negócio aprovadas

## Tenant e aluno

**DECISÃO APROVADA:** cada tenant possui marca e dados próprios. Um profissional não acessa dados de outro tenant; um aluno não acessa outro aluno. O primeiro cliente não recebe exceção de arquitetura.

**CONFIRMADO NA FASE 3:** profissional com vínculo ativo pode cadastrar, editar, inativar e reativar alunos do próprio tenant. O aluno pode existir sem conta. Inativação desativa seu vínculo e impede leitura do cadastro pela conta, sem apagar o registro. A sessão Auth pode permanecer válida, mas RLS nega os recursos do tenant. Operações futuras offline e retenção seguem **PENDENTES**.

**CONFIRMADO NA FASE 3:** convite é gerado pelo profissional para aluno ativo ainda sem conta. Só o hash SHA-256 fica no banco; o link com token aparece uma vez na tela para entrega manual. Expira em 48 horas, só pode ser usado uma vez e exige conta Auth com email confirmado igual ao cadastro. Um novo convite invalida o anterior. A ativação cria vínculo ALUNO e liga `user_id` ao cadastro na mesma transação.

**CONFIRMADO NA FASE 3:** email de aluno não pode se repetir no mesmo tenant mesmo com letras em caixa diferente. O mesmo email pode existir em tenants diferentes; a identidade Auth é única e pode ter múltiplos vínculos. Troca de email após ativação e entrega automática de convites estão **PENDENTES**.

## Prescrição

**DECISÃO APROVADA:** treino possui dias, exercícios e séries prescritas. O profissional trabalha em rascunho e publica versão. Uma publicação anterior permanece interpretável e associada às sessões que a utilizaram. Atribuição determina qual versão o aluno pode usar.

**HIPÓTESE:** editar um plano publicado abre novo rascunho a partir da versão mais recente. Publicar poderá exigir confirmação e motivo, para auditoria. O produto não aplicará progressão automática no MVP.

## Execução

**DECISÃO APROVADA:** aluno registra carga, placa, repetições, tempo e RIR opcional por série; marca série concluída; conclui ou pula exercício; pode terminar treino parcial; usa timer de descanso. Uma sessão iniciada usa a versão da prescrição capturada no início.

**HIPÓTESE:** `concluído`, `pulado` e `não realizado` serão estados distintos; treino parcial não será contado como treino integral na frequência. A regra exata de frequência e correção de sessão exige validação no desenho funcional.

**DECISÃO APROVADA:** histórico não desaparece nem muda porque a prescrição foi editada. Carga em kg e número de placa não são a mesma unidade e não serão convertidos sem configuração de equipamento.

## Avaliação

**DECISÃO APROVADA:** avaliação básica guarda peso/medidas, data, responsável e observações. Não há análise corporal complexa no MVP.

## Offline

**DECISÃO APROVADA:** dados críticos da execução são salvos localmente antes de depender da rede; status local e remoto são diferenciados. Reenvio não cria duplicatas. Erro permanente não elimina a operação local silenciosamente.

## Contato e identidade

**DECISÃO APROVADA:** contato por WhatsApp vem da configuração do tenant. Nome, cores, logo, telefone e textos específicos não entram como constantes do produto.
