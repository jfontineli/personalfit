# Memória persistente do PersonalFit

Esta pasta registra contexto, decisões aprovadas, estado verificável e pendências. Ela ajuda uma nova sessão de trabalho a retomar o projeto sem transformar intenções em funcionalidades supostamente prontas.

## Ordem de leitura

1. `CURRENT_STATE.md`: o que existe agora e o que falta.
2. `PROJECT_CONTEXT.md`: problema, público e escopo aprovado.
3. `ARCHITECTURE.md` e `DOMAIN_MODEL.md`: limites técnicos e conceitos.
4. `BUSINESS_RULES.md`, `AUTHORIZATION.md` e `SECURITY.md`: invariantes.
5. `DATABASE.md`, `API.md` e `INFRASTRUCTURE.md`: contratos e implantação.
6. `DEVELOPMENT.md`, `TESTING.md` e `TECH_DEBT.md`: modo de trabalho e riscos.
7. `../decisions/`: justificativas das decisões arquiteturais.

## Etiquetas obrigatórias

| Etiqueta | Significado |
|---|---|
| **CONFIRMADO** | Encontrado no estado atual e verificável. |
| **DECISÃO APROVADA** | Definido pelo proprietário do produto para o MVP. |
| **HIPÓTESE** | Proposta de implementação ainda sem aprovação ou prova. |
| **PENDENTE** | Trabalho ou definição que ainda não ocorreu. |
| **NECESSITA VALIDAÇÃO HUMANA** | Requer decisão de negócio, profissional responsável ou assessoria apropriada. |

## Regra de atualização

Ao mudar código ou contrato, revise o documento correspondente e `CURRENT_STATE.md` no mesmo trabalho. Datas e versões não substituem inspeção do código. Uma decisão substituída deve receber novo ADR com referência à anterior. A hierarquia para descobrir o estado real está em `../../AGENTS.md`.
