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
| SUPER_ADMIN | Papel ativo visível apenas ao próprio titular; infraestrutura para futura operação administrativa, sem leitura de alunos/marcas por padrão | CONFIRMADO |
| PROFISSIONAL | Ler tenant e marca próprios; editar marca; listar, cadastrar, editar, inativar, reativar e convidar alunos do tenant; ler/escrever observações internas; ler auditoria do tenant | CONFIRMADO |
| ALUNO | Ler tenant/marca do vínculo ativo e somente seu cadastro ativo; não editar cadastro, marca ou observações internas | CONFIRMADO |

**DECISÃO APROVADA:** nesta fase o PROFISSIONAL administra todos os alunos do tenant vinculado; não há atribuição individual nem papéis customizáveis. **PENDENTE:** equipe granular, suporte excepcional e funções administrativas de SUPER_ADMIN.

## Verificações negativas mínimas

**DECISÃO APROVADA:** testes com Tenant A e Tenant B desde o primeiro incremento. Cobrir usuário sem vínculo, vínculo inativo, profissional de B consultando A, aluno A1 consultando A2, aluno de A consultando B, tentativa de trocar `tenant_id` no payload, IDs de recurso adivinhados e link de arquivo fora da permissão.

## RLS e Storage

**DECISÃO APROVADA:** usar RLS nas tabelas expostas e políticas equivalentes para objetos privados no Supabase Storage. RLS complementa validação de operações privilegiadas; chaves de serviço nunca são enviadas ao navegador. Políticas devem partir de negação e contemplar `SELECT`, `INSERT`, `UPDATE` e `DELETE` conforme o contrato.

**CONFIRMADO:** `students(tenant_id,user_id)` e `student_internal_notes(tenant_id,student_id)` usam referências compostas. Grants de coluna impedem o cliente de alterar `students.user_id` ou `tenant_id`; a RPC de ativação faz a associação transacional. Observações internas estão em tabela separada sem policy de aluno. Convites e auditoria não permitem escrita direta por `authenticated`. Inativar aluno/profissional ou perfil revoga vínculos ativos; reativar perfil não os restaura automaticamente.
Vínculos inativos também não são retornados pela policy de leitura de `tenant_memberships`.

## Casos especiais

**CONFIRMADO:** múltiplos vínculos permitem seleção explícita do tenant no frontend; um vínculo único é selecionado automaticamente; sem vínculo o acesso é restrito. Convite usa hash e email confirmado. **PENDENTE:** transferência de aluno, suporte excepcional, exportação e mudança de email após ativação.
