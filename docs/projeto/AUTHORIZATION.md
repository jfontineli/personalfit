# Autorização e isolamento

## Cadeia obrigatória

**CONFIRMADO:** RLS está ativa nas tabelas técnicas e nas sete tabelas privadas da Fase 3. A migration converte os vínculos técnicos `PROFESSIONAL`/`STUDENT` para `PROFISSIONAL`/`ALUNO`. `SUPER_ADMIN` é papel de plataforma separado, sem bypass de RLS dos tenants. Os testes de banco cobrem anon, A/B, dois alunos de A, sem vínculo, vínculo inativo, papel de aluno, adulteração de `tenant_id`, ID conhecido, convite e inativação. O E2E confirmou rota/ID de outro tenant negados com Auth real.

**DECISÃO APROVADA:** toda operação em recurso privado valida, nesta ordem lógica:

```text
usuário autenticado → vínculo ativo → tenant → papel/permissão → recurso solicitado
```

`tenant_id` vindo do frontend não concede permissão. O cliente pode indicar qual tenant deseja usar; o servidor confirma o vínculo e a titularidade do recurso. URLs e IDs não são credenciais.

## Papéis implementados

| Papel | Capacidade inicial proposta | Estado |
|---|---|---|
| SUPER_ADMIN | Criar e listar espaços/primeiros profissionais, gerir plano e acesso por RPCs auditadas; sem leitura de alunos/marcas | CONFIRMADO localmente |
| PROFISSIONAL | Ler tenant e marca próprios; editar marca; listar, cadastrar, editar, inativar, reativar e convidar alunos do tenant; ler/escrever observações internas; ler auditoria do tenant | CONFIRMADO |
| ALUNO | Ler tenant/marca do vínculo ativo e somente seu cadastro ativo; não editar cadastro, marca ou observações internas | CONFIRMADO |
| NUTRICIONISTA | Consultar alunos atribuídos, editar rascunho e publicar prescrição alimentar apenas desses alunos | CONFIRMADO localmente no primeiro fluxo de nutrição |

**DECISÃO APROVADA:** nesta fase o PROFISSIONAL administra todos os alunos do tenant vinculado; não há atribuição individual nem papéis customizáveis. **PENDENTE:** equipe granular, suporte excepcional e funções administrativas de SUPER_ADMIN.

**CONFIRMADO NO ONBOARDING LOCAL:** o SUPER_ADMIN ativo pode chamar a RPC auditada de criação de tenant e convite profissional. A conta convidada reivindica acesso somente com email Auth confirmado igual ao convite válido. Nenhuma dessas operações concede ao administrador um vínculo com o tenant; leitura de alunos, marca e conteúdo privado continua negada. Gestão detalhada de usuários e administração operacional ampla seguem **PENDENTES**.

**CONFIRMADO NA GESTÃO DA PLATAFORMA:** o SUPER_ADMIN ativo também lista nomes dos espaços e primeiros profissionais, altera tipo/prazo de plano e suspende ou reativa o acesso por RPCs auditadas. Não lista alunos nem lê seus dados. Quando plano está suspenso ou vencido, policies restritivas negam leitura e escrita dos dados do espaço a profissionais e alunos, e as RPCs de convite negam emissão/ativação. Reativar restabelece o acesso dos vínculos que continuavam ativos, sem recriá-los.

**CONFIRMADO PARA LOGOTIPOS:** as policies de `storage.objects` limitam o bucket `brand-logos` a caminhos do tenant. Membros com vínculo e perfil ativos podem baixar o logotipo quando o plano permite acesso; só o profissional ativo pode enviar ou remover. Superadmin sem vínculo, outro tenant, vínculo inativo e plano suspenso não recebem acesso. O caminho indicado pelo cliente é validado pelo banco.

**CONFIRMADO NO PRIMEIRO CICLO DE TREINO:** biblioteca e rascunho são editáveis apenas pelo profissional ativo do tenant. Aluno não lê rascunho nem biblioteca inteira; lê somente versões atribuídas a seu cadastro ativo, suas sessões e seu plano de atendimento. Profissional vê sessões dos alunos do próprio espaço. Apenas RPCs privilegiadas publicam versões/atribuições e escrevem sessões/recibos; elas verificam papel, vínculo, perfil, plano SaaS vigente, aluno e recurso. Vídeo privado só é lido pelo profissional do espaço ou por aluno cuja versão atribuída o referencia; upload é exclusivo do profissional, e vídeo publicado não pode ser apagado. Testes pgTAP cobrem A/B, dois alunos de A, anon e inativação.

**CONFIRMADO LOCALMENTE NA NUTRIÇÃO:** o personal pode emitir convite para aluno ativo e consultar apenas o status do vínculo/publicação. O nutricionista usa conta Auth, registro `nutritionists` e atribuição ativa ao aluno; sua membership pode ser `NUTRICIONISTA` ou `PROFISSIONAL` quando exerce as duas funções. Somente o nutricionista atribuído recebe rascunho e publica. O aluno ativo lê apenas sua versão publicada e envia seus próprios registros. O superadmin não recebe leitura clínica. As tabelas não concedem leitura/escrita direta a clientes. O pgTAP negou anon, outro tenant, outro aluno do mesmo tenant, personal sem atribuição lendo rascunho e aluno inativo.

**CONFIRMADO LOCALMENTE NA DUPLA ATUAÇÃO:** uma conta `PROFISSIONAL` pode adquirir capacidade de nutricionista sem mudar de papel, por autoatribuição explícita a aluno sem nutricionista ativo ou por convite. Apenas o papel de personal não concede leitura clínica: as RPCs exigem também registro `nutritionists` ativo e atribuição ativa ao aluno específico. Outro personal do mesmo tenant continua sem acesso ao rascunho. Ver ADR 0016.

## Verificações negativas mínimas

**DECISÃO APROVADA:** testes com Tenant A e Tenant B desde o primeiro incremento. Cobrir usuário sem vínculo, vínculo inativo, profissional de B consultando A, aluno A1 consultando A2, aluno de A consultando B, tentativa de trocar `tenant_id` no payload, IDs de recurso adivinhados e link de arquivo fora da permissão.

## RLS e Storage

**DECISÃO APROVADA:** usar RLS nas tabelas expostas e políticas equivalentes para objetos privados no Supabase Storage. RLS complementa validação de operações privilegiadas; chaves de serviço nunca são enviadas ao navegador. Políticas devem partir de negação e contemplar `SELECT`, `INSERT`, `UPDATE` e `DELETE` conforme o contrato.

**CONFIRMADO:** `students(tenant_id,user_id)` e `student_internal_notes(tenant_id,student_id)` usam referências compostas. Grants de coluna impedem o cliente de alterar `students.user_id` ou `tenant_id`; a RPC de ativação faz a associação transacional. Observações internas estão em tabela separada sem policy de aluno. Convites e auditoria não permitem escrita direta por `authenticated`. Inativar aluno/profissional ou perfil revoga vínculos ativos; reativar perfil não os restaura automaticamente.
Vínculos inativos também não são retornados pela policy de leitura de `tenant_memberships`.

## Casos especiais

**CONFIRMADO:** múltiplos vínculos permitem seleção explícita do tenant no frontend; um vínculo único é selecionado automaticamente; sem vínculo o acesso é restrito. Convite usa hash e email confirmado. **PENDENTE:** transferência de aluno, suporte excepcional, exportação e mudança de email após ativação.
