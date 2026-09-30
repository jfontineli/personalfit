# Segurança e privacidade

## Estado

**CONFIRMADO:** o frontend aceita somente URL e chave publicável do Supabase. O E2E confirmou restauração/renovação da sessão Auth em IndexedDB e `localStorage` vazio. A chave de serviço local foi usada somente no processo de testes e sua ausência no bundle JS foi verificada por comparação exata. `apps/web/.env.local` contém apenas valores públicos locais e é ignorado pelo Git. A migration foi aplicada com RLS ativa e `anon` negado pelos testes. Nenhum bucket privado ou política de Storage de produto foi criado; Storage local respondeu HTTP 200 em seu status. A pasta `referencia/` segue ignorada.

**CONFIRMADO NA FASE 3:** RLS habilitada nas sete novas tabelas; grants e policies separam profissional, aluno e administrador da plataforma. Um profissional não lê/altera aluno de outro tenant; um aluno só lê seu próprio cadastro ativo e não acessa observações internas. `tenant_id` enviado pelo navegador é validado pelo vínculo e recurso. Convite guarda apenas SHA-256 de token aleatório de 256 bits, expira em 48 horas e é consumido uma vez; reivindicação exige email confirmado igual ao cadastro. A URL do convite é exibida uma vez e não entra em logs da aplicação. Triggers de auditoria gravam somente ação, ator, tenant, recurso e horário. `SUPER_ADMIN` não recebe acesso de leitura aos dados privados do tenant.

## Requisitos aprovados

- **DECISÃO APROVADA:** Supabase Auth para autenticação e autorização efetiva no servidor/banco.
- **DECISÃO APROVADA:** nenhum acesso depende apenas da interface; isolamento entre tenant e alunos é obrigatório.
- **DECISÃO APROVADA:** RLS se aplica onde pertinente, inclusive acesso a arquivos privados.
- **DECISÃO APROVADA:** dados de execução pendentes ficam no IndexedDB e precisam de estados de gravação distintos.
- **DECISÃO APROVADA:** nenhuma marca, URL, telefone ou identidade de cliente é embutida como regra fixa.

## Controles a especificar antes de implementar

**PENDENTE:** entrega automática e reenvio de convite, recuperação de conta; MFA de acesso administrativo; tratamento de troca de email Auth/perfil; validação de upload; URLs temporárias; políticas de acesso aos dados corporais; prevenção de XSS; proteção e limites das futuras operações administrativas; monitoramento e resposta a incidentes; backups de banco e objetos; exclusão/exportação de dados; comportamento de logout com pendências offline. A auditoria mínima da Fase 3 está implementada, mas política de retenção e exportação ainda não.

**HIPÓTESE:** evitar conteúdo médico/nutricional em logs operacionais. Registrar identificadores, ação, ator, tenant, horário e resultado sem copiar payload sensível. Fotos corporais estão adiadas e não justificam bucket público nesta fase.

## Privacidade e responsabilidade

**NECESSITA VALIDAÇÃO HUMANA:** finalidade, base legal, papéis de controlador/operador, aviso de privacidade, retenção e atendimento a direitos do titular. Peso, medidas e observações podem revelar informações de saúde e exigem tratamento proporcional. Definições legais e profissionais devem ser revistas antes do piloto.

## Critério de conclusão futura

Uma funcionalidade com dados privados só é concluída após testes negativos de autorização, revisão de logs, validação do armazenamento e revisão de diff para segredos acidentais.
