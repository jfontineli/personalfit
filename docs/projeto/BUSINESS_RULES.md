# Regras de negócio

**DECISÃO APROVADA** — A marca e a biblioteca são do tenant. Aluno pertence ao espaço e só consulta o próprio atendimento. Inativação preserva histórico. O plano comercial pode suspender ou vencer o acesso ao espaço. O plano de atendimento do aluno registra nome, vigência e estado; preços, cobrança ou bloqueio individual automático exigem definição própria.

## Treino

- O profissional cria a prescrição individual. Salvar rascunho mantém a edição privada. Publicar cria nova versão e atribuição. Rascunho marcado para revisão exige liberação profissional antes da publicação.
- **DECISÃO APROVADA · implementação publicada em TESTE e validada localmente** — Vídeo, nome e instrução geral são compartilhados pela biblioteca. A versão atual atribuída reflete correções online sem republicação individual. Sessões terminais ou de versão anterior usam o snapshot completo. Séries, descanso, ordem, estilo de registro, metas, alternativas e orientação adicional mudam mediante nova publicação. [ADR 0013](../decisions/0013-live-exercise-media.md) · [ADR 0021](../decisions/0021-live-exercise-library-content.md)
- A sessão aceita apenas itens do dia prescrito e troca por alternativa aprovada antes da primeira série do item. A troca vale para a sessão. Pausa permite retomar. A árvore local privilegia execução linear e remove o adiamento isolado.
- Séries registram repetições ou duração conforme a prescrição; carga e esforço são opcionais quando aplicáveis. Preparação simples admite confirmação. Cardio pode prescrever etapas; o aluno registra a duração total. Guias complementares só aparecem quando publicados.
- Encerramento completo e parcial têm estados distintos. A progressão semanal considera dias encerrados pelos IDs estáveis, inclusive ao mudar a versão, e respeita a duração prescrita quando existe. A referência de carga anterior não prescreve progressão automática.
- Gravar no aparelho permite continuar offline. O servidor valida a operação e confirma separadamente. Vídeo exige conexão. Indicadores de sete dias orientam revisão pelo profissional.

## Alimentação

O personal pode convidar um nutricionista. Dupla atuação exige registro e atribuição ativa ao aluno. Somente o autor autorizado edita e publica o plano individual. O aluno vê a versão publicada, opções e notas liberadas e registra refeição conforme, adaptada ou não feita. A fonte importada e as notas privadas ficam fora da projeção publicada. Importações sinalizadas requerem revisão explícita.

**NECESSITA VALIDAÇÃO HUMANA** — Verificação de credenciais, equivalências e conteúdo clínico; compartilhamento de adesão; regras de frequência, medidas e efeito comercial do vencimento do atendimento.
