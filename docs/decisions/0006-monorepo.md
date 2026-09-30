# ADR 0006 — Monorepo modular

- Data: 2026-09-29
- Status: **DECISÃO APROVADA**

## Contexto

O primeiro incremento precisa manter aplicação, banco, contratos, testes e documentação coordenados sem custo de vários repositórios.

## Decisão

Usar um repositório com `apps/web/`, `supabase/`, `tests/`, `docs/`, `infra/` e módulos internos claros. A pasta de referência fica excluída do Git e do build.

## Alternativas consideradas

- Repositórios separados para web/backend: aumentam coordenação e versionamento conjunto agora.
- Uma aplicação sem limites internos: começa rápido, mas dificulta autorização e histórico.

## Consequências

- Mudanças de contratos poderão ser revisadas no mesmo diff de app, migrations e testes.
- A estrutura não determina um framework de rotas, biblioteca de estado ou gerenciador de pacotes.
- **PENDENTE:** scripts, ferramentas de qualidade e CI quando houver código.
