# Segurança e privacidade

## Estado

**CONFIRMADO:** o frontend aceita somente URL e chave publicável do Supabase. O E2E confirmou restauração/renovação da sessão Auth em IndexedDB e `localStorage` vazio. A chave de serviço local foi usada somente no processo de testes e sua ausência no bundle JS foi verificada por comparação exata. `apps/web/.env.local` contém apenas valores públicos locais e é ignorado pelo Git. As tabelas têm RLS ativa e `anon` foi negado pelos testes. Buckets privados atendem logotipos e vídeos; `referencia/` segue ignorada.

**CONFIRMADO NA FASE 3:** RLS habilitada nas sete novas tabelas; grants e policies separam profissional, aluno e administrador da plataforma. Um profissional não lê/altera aluno de outro tenant; um aluno só lê seu próprio cadastro ativo e não acessa observações internas. `tenant_id` enviado pelo navegador é validado pelo vínculo e recurso. Convite guarda apenas SHA-256 de token aleatório de 256 bits, expira em 48 horas e é consumido uma vez; reivindicação exige email confirmado igual ao cadastro. A URL do convite é exibida uma vez e não entra em logs da aplicação. Triggers de auditoria gravam somente ação, ator, tenant, recurso e horário. `SUPER_ADMIN` não recebe acesso de leitura aos dados privados do tenant.

**CONFIRMADO NO ONBOARDING LOCAL:** convite profissional também guarda apenas hash de token aleatório, expira em 48 horas e exige email confirmado. `professional_invitations` tem RLS ativa e nenhum grant direto a `anon`/`authenticated`. A RPC de criação confere superadmin e perfil ativos; a ativação consome o convite e cria vínculo profissional atomicamente. Os testes negam criação anônima, por profissional comum, email divergente, email não confirmado e convite expirado/reutilizado. O superadmin permanece sem acesso privado ao tenant criado.

**CONFIRMADO NA GESTÃO DA PLATAFORMA:** `tenant_plans` tem RLS ativa e nenhum grant direto para clientes. A listagem administrativa expõe apenas espaço, primeiro profissional e metadados de plano ao superadmin ativo; não inclui alunos. Alterações são auditadas. Policies restritivas e validações das RPCs privilegiadas bloqueiam espaço suspenso ou vencido. Testes cobrem negação a anônimo/profissional comum, isolamento de outro tenant, vencimento e reativação.

**CONFIRMADO NA EXPERIÊNCIA DE ATIVAÇÃO:** o retorno ao convite após login usa o fragmento da URL, não um parâmetro de consulta enviado ao servidor. O destino é aceito somente nas rotas de ativação de aluno ou profissional com token de 64 caracteres hexadecimais; destinos externos e arbitrários são rejeitados pelos testes unitários. O link não é persistido no navegador pela aplicação nem enviado a logs próprios.

**CONFIRMADO NO COMPARTILHAMENTO DO CONVITE:** o botão de copiar usa a área de transferência após ação explícita. O botão do WhatsApp abre `wa.me` com mensagem pré-preenchida, sem escolher destinatário nem enviar automaticamente; o profissional confirma o envio fora do aplicativo. O token integra a mensagem preparada e, ao abrir o WhatsApp, é transmitido a esse serviço por decisão do usuário. A navegação usa `noopener`, `noreferrer` e sem referenciador. Criar novo convite invalida o link anterior, com confirmação contextual na interface.

**CONFIRMADO NO UPLOAD DE MARCA:** o bucket de logotipos é privado, aceita apenas PNG/JPEG/WebP até 2 MB e aplica RLS por tenant, papel, perfil e plano. O frontend valida tipo/tamanho antes do envio, baixa com Auth e exibe a imagem por URL local de objeto; não usa bucket público nem chave privilegiada no navegador. A verificação da assinatura binária do arquivo no servidor ainda não foi implementada; o MIME informado pelo cliente não constitui validação de conteúdo.

**CONFIRMADO NO PRIMEIRO CICLO DE TREINO:** as seis novas tabelas de treino e `student_service_plans` têm RLS; versões, atribuições, sessões e recibos não permitem escrita direta do cliente. A RPC de sincronização valida autoria e atribuição, congela a versão da sessão e recusa conflito de operation ID. A fila local é segregada por usuário e tenant. O bucket de vídeo é privado, limitado a MP4 de 25 MB, com leitura por profissional ou aluno atribuído e sem cache offline deliberado; o E2E confirmou upload/leitura autorizados. A política de exclusão protege objetos referenciados em versões publicadas. O servidor ainda precisa validar assinatura/conteúdo binário do MP4 antes de aceitar mídia em produção.

**CONFIRMADO EM 2026-11-02:** observações específicas do aluno ficam no rascunho privado e, após publicação, somente no snapshot autorizado a esse aluno e ao profissional do espaço; a biblioteca reutilizável não recebe notas individuais. A trava de revisão no banco impede publicar rascunhos sinalizados antes da confirmação do profissional. O profissional concluiu essa revisão e publicou a versão 1 local. Naquela data, dados de dieta/medicamentos da referência não tinham sido importados; a importação privada solicitada ocorreu em 2026-11-03, conforme abaixo.

**CONFIRMADO EM 2026-11-02:** a coluna `muscle_group` da biblioteca concede escrita apenas ao papel `authenticated` e continua protegida pelas policies de profissional ativo do próprio tenant. O pgTAP confirmou que o profissional A altera a classificação do seu exercício e não altera a do Tenant B. `anon` não recebeu grant; agrupamento no frontend não concede acesso.

**CONFIRMADO EM 2026-11-02:** o formulário novo aceita apenas links HTTPS com domínio e ID de vídeo do YouTube e normaliza o endereço antes de salvar. O vídeo do YouTube abre em player incorporado sob demanda; sua visibilidade é controlada no YouTube e não recebe a proteção do bucket privado do PersonalFit. O MP4 continua no bucket privado e sem chave privilegiada no navegador. A validação de formato do link é do cliente; a RLS segue responsável pelo acesso ao registro do exercício.

**CONFIRMADO EM 2026-11-02:** o aluno não recebe SELECT na biblioteca completa. A RPC `student_exercise_videos` exige conta, vínculo e tenant ativos, papel ALUNO, titularidade do aluno e versão atribuída; retorna somente vídeo dos exercícios dessa versão. O Storage exige também que o MP4 seja a mídia atual de um exercício prescrito ou uma referência preservada no snapshot. O pgTAP negou anon, outro aluno do mesmo tenant, outro tenant e aluno inativo. Nenhuma chave de serviço entra no frontend.

**CONFIRMADO EM 2026-11-02:** o player incorporado recebe somente ID validado do YouTube e usa `youtube-nocookie.com`; o iframe só existe enquanto o modal está aberto, com política de referrer restrita à origem. O MP4 privado continua baixado sob autorização do Storage e seu objeto temporário é revogado ao fechar. Links externos legados continuam com `noopener noreferrer`.

**CONFIRMADO LOCALMENTE EM 2026-11-03:** rascunho, versão e registros nutricionais ficam em tabelas com RLS e sem grants diretos a clientes. As RPCs de escrita e leitura checam Auth, perfil, vínculo ativo, plano do tenant, papel e aluno específico. O personal não recebe conteúdo clínico; o superadmin não recebe bypass. A fila offline fica no IndexedDB segregada por conta/tenant/aluno, e o servidor rejeita mesmo `operation_id` com conteúdo diferente. O CRN informado pelo convidado ainda não é verificado: uso clínico real requer conferência humana e definição de privacidade/base legal.

## Requisitos aprovados

- **DECISÃO APROVADA:** Supabase Auth para autenticação e autorização efetiva no servidor/banco.
- **DECISÃO APROVADA:** nenhum acesso depende apenas da interface; isolamento entre tenant e alunos é obrigatório.
- **DECISÃO APROVADA:** RLS se aplica onde pertinente, inclusive acesso a arquivos privados.
- **DECISÃO APROVADA:** dados de execução pendentes ficam no IndexedDB e precisam de estados de gravação distintos.
- **DECISÃO APROVADA:** nenhuma marca, URL, telefone ou identidade de cliente é embutida como regra fixa.

## Controles a especificar antes de implementar

**PENDENTE:** entrega automática e reenvio de convite, recuperação de conta; MFA de acesso administrativo; tratamento de troca de email Auth/perfil; validação binária e processamento seguro de futuras mídias; URLs temporárias quando necessárias; políticas de acesso aos dados corporais; prevenção de XSS; proteção e limites das futuras operações administrativas; monitoramento e resposta a incidentes; backups de banco e objetos; exclusão/exportação de dados; comportamento de logout com pendências offline. A auditoria mínima da Fase 3 está implementada, mas política de retenção e exportação ainda não.

**HIPÓTESE:** evitar conteúdo médico/nutricional em logs operacionais. Registrar identificadores, ação, ator, tenant, horário e resultado sem copiar payload sensível. Fotos corporais estão adiadas e não justificam bucket público nesta fase.

## Privacidade e responsabilidade

**NECESSITA VALIDAÇÃO HUMANA:** finalidade, base legal, papéis de controlador/operador, aviso de privacidade, retenção e atendimento a direitos do titular. Peso, medidas e observações podem revelar informações de saúde e exigem tratamento proporcional. Definições legais e profissionais devem ser revistas antes do piloto.

## Critério de conclusão futura

Uma funcionalidade com dados privados só é concluída após testes negativos de autorização, revisão de logs, validação do armazenamento e revisão de diff para segredos acidentais.
**CONFIRMADO LOCALMENTE — DUPLA ATUAÇÃO:** a autoatribuição nutricional só é aceita pela RPC para personal ativo com e-mail confirmado e cadastro profissional ativo, em aluno ativo do próprio tenant sem atribuição nutricional vigente. O CRN é autodeclarado e precisa de conferência humana. Uma membership `PROFISSIONAL` isolada não permite ler nem publicar plano alimentar; a autorização exige registro e atribuição específicos e ativos. Outro personal do mesmo tenant continua negado.

**CONFIRMADO LOCALMENTE — DIETA IMPORTADA:** a planilha GH individual foi copiada somente para `nutrition_plans.draft` do aluno específico, com metadados de origem e contexto clínico para revisão do nutricionista atribuído. A migration `20261103050000` impede a publicação enquanto `sourceImport.reviewRequired` estiver ativo. Não há versão visível ao aluno. O conteúdo clínico não foi colocado em arquivos versionáveis nem no bundle.

**CONFIRMADO LOCALMENTE — FILTRO DE PUBLICAÇÃO:** a migration `20261103060000` valida as notas individuais no rascunho e aplica `nutrition_public_snapshot` ao publicar e ao entregar plano ao aluno. `sourceImport` e notas sem `showToStudent=true` não são incluídos. O texto original continua restrito ao rascunho do nutricionista atribuído. Conteúdo clínico importado não é colocado no bundle.

**CONFIRMADO LOCALMENTE — TROCA DE EXERCÍCIO:** o seletor do aluno não é a autorização. A RPC de sincronização confere identidade Auth, perfil e vínculo ativos, aluno específico, tenant, versão publicada, dia/semana e alternativa contida no snapshot. Troca após série registrada é recusada; aviso de aparelho indisponível não pode coexistir com troca no mesmo item. O E2E autenticado confirmou rejeição de ID de exercício não aprovado e ausência de mutação da sessão. Dados de sessão e operações pendentes permanecem no IndexedDB por usuário/tenant/aluno; não há chave privilegiada no cliente.

**CONFIRMADO LOCALMENTE — MÍDIA PRIVADA DA ALTERNATIVA:** a RPC de vídeo e a política de Storage incluem apenas alternativas presentes na versão atribuída ao aluno autenticado, sob as mesmas condições de tenant, vínculo e estado do aluno. A correção `20261103110000` restaura a validação completa do caminho de três UUIDs para upload. O E2E confirmou reprodução de MP4 privado depois da troca aprovada e negou ao mesmo aluno a leitura de outro exercício do mesmo tenant que não foi prescrito. Negação entre tenants continua recomendada na próxima rodada de segurança.
