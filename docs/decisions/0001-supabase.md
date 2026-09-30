# ADR 0001 — Supabase na arquitetura inicial

- Data: 2026-09-29
- Status: **DECISÃO APROVADA**

## Contexto

O produto precisa de autenticação individual, armazenamento de arquivos, autorização multi-tenant e persistência desde o primeiro cliente. O objetivo comercial é reduzir tempo até o piloto sem tornar planilhas o núcleo transacional.

## Decisão

Usar Supabase Auth e Supabase Storage, com PostgreSQL. React + TypeScript consome contratos autorizados. Operações que exigem autoridade ou transação poderão usar funções/RPCs, definidas na implementação. Spring Boot fica fora da arquitetura inicial.

## Alternativas consideradas

- Google Apps Script, Sheets e Drive: rápido para piloto manual, mas exige mais trabalho para isolamento, histórico e sincronização uniforme.
- Backend Spring Boot próprio: compatível com a experiência do desenvolvedor, com maior responsabilidade operacional inicial.

## Consequências

- O MVP dependerá do provedor para Auth, Storage e operação do banco.
- Chaves de serviço não entrarão no navegador. RLS e autorização serão verificadas com dois tenants fictícios.
- Devem ser definidos orçamento, região, backups e processo de recuperação antes do piloto.
- **PENDENTE:** formato exato de funções, ambientes e custos contratados.
