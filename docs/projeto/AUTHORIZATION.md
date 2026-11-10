# Autorização por papel, recurso e ação

**DECISÃO APROVADA** — tenant_id vindo do navegador nunca concede autorização. Para dados privados, o servidor verifica identidade → perfil e vínculo ativos → tenant habilitado → papel/capacidade → recurso específico. A interface seleciona contexto, mostra rotas e habilita ações. A autorização efetiva está nos grants, RLS, policies de Storage e RPCs. A matriz resume o acesso previsto e os mecanismos do código. As exceções conhecidas estão em [segurança](SECURITY.md).

| Papel | Recurso | Ação e limite efetivo |
|---|---|---|
| SUPER_ADMIN | Espaços, convites de personal e plano SaaS | Criar/listar espaços e ajustar prazo/acesso por RPC administrativa. Requer platform_admins e perfil ativos. O papel de plataforma não concede acesso aos dados privados do tenant. |
| PROFISSIONAL | Marca, alunos, notas internas e atendimento | Ler/editar no espaço autorizado, cadastrar/inativar aluno, gerar convite. Grants por coluna e policies aplicam escopo do tenant. |
| PROFISSIONAL | Biblioteca, vídeo, rascunho, versões e indicadores | Gerir exercícios e mídia do espaço, publicar treino individual e consultar execução. A biblioteca é compartilhada entre profissionais autorizados do tenant. |
| PROFISSIONAL | Alimentação | Convidar nutricionista e consultar situação/autoria. Para ler rascunho ou publicar, a mesma conta precisa de registro nutricional e atribuição ativa específica. |
| NUTRICIONISTA | Atribuições, rascunho e plano alimentar | Consultar alunos atribuídos, editar e publicar por RPC. Não há grant geral de leitura clínica para o cliente. |
| ALUNO | Cadastro, marca, prescrição, mídia e sessão | Ler próprio cadastro e versões atribuídas, baixar mídia autorizada e registrar a própria execução. Notas internas e SELECT geral na biblioteca ficam privados. |
| ALUNO | Alimentação | Consultar última versão própria com notas liberadas e registrar refeição prescrita por versão/data. |
| Autenticado com convite | Ativação individual | Validar token, expiração, uso único e email confirmado da conta. O convite não transfere poderes de superadmin. |
| Anônimo, outro tenant ou outro aluno | Recursos privados | Negar escrita e negar leitura ou retornar conjunto vazio conforme o contrato. |

## Revisão

Conferir USING e WITH CHECK, grants por coluna, execução de SECURITY DEFINER e perfil/membership/aluno/plano inativos. Exercitar Tenant A contra Tenant B, Aluno A contra Aluno B no mesmo espaço e profissional sem atribuição clínica. Revalidar essas barreiras ao reativar cadastros e ao usar dados locais após perda de acesso.
