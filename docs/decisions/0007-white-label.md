# ADR 0007 — White-label configurado por tenant

- Data: 2026-09-29
- Status: **DECISÃO APROVADA**

## Contexto

O SaaS atenderá diferentes profissionais, cada um com nome, marca e canais próprios. O primeiro cliente não define a identidade permanente da plataforma.

## Decisão

Nome, cores, logotipo/foto, textos institucionais e WhatsApp serão dados/configurações do tenant. A identidade básica entra no MVP. Domínio personalizado fica para fase futura.

## Alternativas consideradas

- Build separado por cliente: multiplica implantação e manutenção.
- Marca fixa com troca futura: contamina fluxos e assets desde o início.

## Consequências

- A interface precisa carregar contexto visual autorizado por tenant e prever valores padrão neutros da plataforma.
- Mídia de marca precisa ter propriedade, acesso e tipos validados.
- Mudança de domínio/origem PWA exigirá plano para login, cache e dados locais.
- **PENDENTE:** limites da paleta, comportamento de favicon/ícone PWA e endereço inicial.
