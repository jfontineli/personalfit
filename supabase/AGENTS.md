# Banco, Auth e Storage

Complemente o [agente raiz](../AGENTS.md). Consulte [banco](../docs/projeto/DATABASE.md), [contratos](../docs/projeto/API.md) e [autorização](../docs/projeto/AUTHORIZATION.md).

- Evolua por migration nova e ordenada. Nunca edite migration histórica aplicada. Reset apenas em alvo descartável previamente identificado. Seed exclusivamente fictício e local.
- Toda nova tabela privada exposta deve nascer com RLS e testes negativos de isolamento. Revise grants por papel, operação e coluna, USING para linhas visíveis e WITH CHECK para a linha resultante. Negue por padrão.
- Vincule auth.uid() ao perfil ativo, membership ativa, tenant, papel e recurso. Confirme titularidade do aluno e atribuição específica do nutricionista. Examine separadamente desativação de perfil, membership e plano.
- Prefira privilégios do chamador quando suficientes. Para SECURITY DEFINER, fixe search_path, qualifique objetos, restrinja EXECUTE e confira autorização dentro da função. Um UUID recebido não autoriza a consulta.
- Preserve RPCs legadas usadas por clientes offline. Verifique idempotência, hash/conteúdo em reenvio, revisão, concorrência e atomicidade. Publicações preservam autoria, snapshot e atribuição; execução usa a versão de início. Audite metadados mínimos sem payload sensível.
- No Storage privado, valide bucket, paths, tenant, recurso, papel, MIME e tamanho. Revise upload, leitura e exclusão de mídia principal e alternativa, inclusive referências históricas.
- Em banco descartável, valide replay das migrations e pgTAP positivo e negativo para anônimo, outro tenant, outro aluno, conta/vínculo inativos, plano bloqueado e ausência de atribuição clínica. Nas negativas, use identificadores válidos conhecidos da fixture. Verifique versões antigas, operação duplicada e recusa sem mutação.
