# ADR 0004 — IndexedDB e execução offline

- Data: 2026-09-29
- Status: **DECISÃO APROVADA**

## Contexto

Alunos treinam em locais com internet instável. Registrar uma série deve responder imediatamente e sobreviver ao fechamento da PWA enquanto a confirmação remota não chegou.

## Decisão

Usar IndexedDB para prescrições disponíveis offline, sessões em andamento e operações pendentes. `localStorage` guarda somente preferências simples. Cache Storage guarda recursos da PWA. Cada operação crítica tem ID único, retry, idempotência, controle de erro, estado local/remoto e proteção contra duplicidade.

## Alternativas consideradas

- Somente `localStorage`: inadequado para transações e dados estruturados crescentes.
- Online obrigatório: não atende a jornada principal em academia.

## Consequências

- O cliente precisa persistir registro e operação pendente juntos.
- O servidor precisa reconhecer reenvios do mesmo ID e retornar confirmação por operação.
- O fluxo precisa mostrar claramente quando há apenas gravação local.
- **PENDENTE:** conflitos entre dispositivos, limites, compactação e limpeza segura da fila.
