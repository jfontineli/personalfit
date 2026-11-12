# Segurança e privacidade

**CONFIRMADO** — O frontend configura somente URL e chave publicável. Service role, secrets e credenciais administrativas pertencem a processos autorizados de servidor/teste. Nunca incluí-los em VITE_, bundle, logs ou exemplos. Os convites persistem hash de token aleatório, expiram em 48 horas e são de uso único. O fragmento da URL transporta o token. Copiar ou compartilhar o convite pelo WhatsApp entrega o link ao destino escolhido. Evite registrar links de ativação.

## Riscos observados

- O treino pode reutilizar cache após leitura online vazia ou negada. A alimentação pode manter o plano local após falha online. Durante desconexão, a aplicação só conhece o último contexto carregado. A permissão atual não pode ser deduzida do cache.
- O logout principal remove sessão/contexto, mas preserva cópias de domínio e pendências. Em dispositivo compartilhado, segregação lógica não equivale a apagar dados. A política de retenção deve proteger privacidade e permitir recuperar registros ainda sem confirmação.
- Algumas policies usam membership ativa sem repetir o teste de perfil. A ativação por convite de aluno e a propagação de status podem produzir estados incoerentes. O helper tenant_access_allowed revela um booleano comercial a authenticated por UUID. Ver [matriz](AUTHORIZATION.md) e [critérios de correção](TECH_DEBT.md).
- IndexedDB guarda sessão Auth e conteúdo privado. Cache Storage destina-se ao shell da PWA. localStorage registra som, vibração e escolha do ciclo alimentar associada a usuário/aluno/dia.
- O conteúdo compartilhado local do ADR 0021 restringe a consulta a itens e alternativas da versão atual atribuída. Sessões terminais ou de versão anterior usam o snapshot completo; essa seleção foi validada localmente em instalação limpa.

## Storage e mídia

| Bucket privado | Limites e autorização |
|---|---|
| brand-logos | PNG/JPEG/WebP até 2 MiB, tenantUUID/arquivoUUID.ext. Membros autorizados leem; profissional autorizado envia/remove no espaço. |
| exercise-videos | MP4 até 25 MiB, tenantUUID/exercicioUUID/arquivoUUID.mp4. Profissional autorizado gerencia; aluno lê mídia principal ou alternativa prescrita. |

A aplicação baixa os objetos com autenticação e usa URL de objeto temporária. YouTube e miniaturas usam serviço externo. A migration local protege contra exclusão tanto a mídia principal quanto a mídia presente somente em alternativa publicada. MIME e tamanho são controlados; inspeção binária no servidor permanece **PENDENTE**.

## Memória, logs e cópias

Use exemplos fictícios e metadados técnicos mínimos. A documentação corrente foi desidentificada. A pasta local de anexos do Codex é ignorada para impedir inclusão automática de capturas e gravações. Não abrir nem distribuir anexos, referências, dumps, volumes ou arquivos de ambiente como parte do bootstrap. Audit events registram ações selecionadas; cobertura de logs e política de retenção dos provedores são **DESCONHECIDAS**.

**NECESSITA VALIDAÇÃO HUMANA** — Avaliar acesso às revisões Git anteriores e às cópias que contêm informação identificável, inclusive necessidade de remoção histórica sob autorização específica. Definir custódia, finalidade, retenção/exportação, credenciais profissionais e destino das pendências após revogação. Esta fase trata a documentação corrente.
