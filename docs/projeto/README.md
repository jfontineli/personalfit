# Memória persistente

Comece pelo [estado atual](CURRENT_STATE.md). Escolha o documento responsável conforme a pergunta.

| Pergunta | Fonte |
|---|---|
| Para quem e com qual escopo? | [Contexto](PROJECT_CONTEXT.md), [domínio](DOMAIN_MODEL.md), [regras](BUSINESS_RULES.md) |
| Onde roda e como persiste? | [Arquitetura](ARCHITECTURE.md), [banco](DATABASE.md), [contratos e sincronização](API.md) |
| Quem pode fazer o quê? | [Matriz de autorização](AUTHORIZATION.md), [segurança e privacidade](SECURITY.md) |
| Como desenvolver, validar e publicar? | [Desenvolvimento](DEVELOPMENT.md), [testes](TESTING.md), [infraestrutura](INFRASTRUCTURE.md) |
| Quais decisões e limitações continuam relevantes? | [ADRs](../decisions/README.md), [dívida aberta](TECH_DEBT.md) |

## Evidência

| Etiqueta | Uso |
|---|---|
| CONFIRMADO | Fato verificável em código, migration, configuração, teste ou observação. Identifique o escopo. |
| DECISÃO APROVADA | Escopo ou arquitetura autorizados; implementação e publicação exigem evidências próprias. |
| INFERIDO | Conclusão técnica indireta, sem validação direta. |
| HISTÓRICO | Evidência datada de ocasião anterior, sem nova verificação. |
| DESCONHECIDO | Evidência insuficiente para afirmar o estado. |
| PENDENTE | Trabalho ou validação ainda por realizar. |
| NECESSITA VALIDAÇÃO HUMANA | Decisão do responsável pelo produto, operação, privacidade ou exercício profissional. |

Ao mudar um fato, atualize seu documento responsável seguindo o [agente raiz](../../AGENTS.md). Use identificadores fictícios como Tenant A e Aluno B. Mantenha casos individuais, anexos, credenciais e payloads fora da memória.
