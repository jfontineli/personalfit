# ADR 0009 — Produto centrado no profissional e white-label

- Data: 2026-09-30
- Status: **DECISÃO APROVADA**

## Contexto

O PersonalFit é um SaaS multi-tenant para profissionais. A visão anterior já previa marca por tenant no [ADR 0007](0007-white-label.md), mas a referência a uma biblioteca global ou particular deixava ambígua a prioridade do produto. O valor principal é a experiência própria que cada personal oferece ao aluno, não um catálogo global de exercícios nem um gerador de treinos.

## Decisão

- O profissional é o centro da experiência: nome, foto, logo, cores, contatos, exercícios, vídeos de instrução, orientações, treinos, dietas, acompanhamento e forma de trabalhar devem poder compor sua oferta.
- A biblioteca própria de exercícios, instruções e vídeos do profissional tem prioridade. Conteúdo global da plataforma, se existir, será apenas auxiliar e não substituirá sua autonomia.
- O profissional cria e publica os treinos. O MVP não sugere nem monta treinos automaticamente.
- Identidade, biblioteca, mídia e dados privados respeitam o tenant e os vínculos autorizados; o cliente não determina a autorização por `tenant_id`.
- A publicação preserva o conteúdo efetivamente prescrito. Mudanças posteriores na biblioteca não alteram versões publicadas nem o histórico do aluno, conforme o [ADR 0005](0005-prescription-versioning.md).
- Dieta e acompanhamento integram a visão do produto, mas o editor estruturado de dieta permanece adiado para depois do MVP.

## Alternativas consideradas

- Catálogo global como núcleo: reduz a autonomia e a diferenciação de cada profissional.
- Geração ou sugestão automática de treinos no MVP: desloca a autoria da prescrição e amplia o escopo aprovado.
- Instâncias separadas por profissional: contraria o SaaS multi-tenant e a configuração white-label do ADR 0007.

## Consequências

- Módulos e contratos futuros devem priorizar conteúdo criado pelo profissional, permissões por tenant e mídia autorizada.
- O desenho de versões precisa preservar exercícios e orientações como foram prescritos, mesmo que a biblioteca mude.
- A exibição da mídia atual foi ajustada pelo [ADR 0013](0013-live-exercise-media.md); o snapshot histórico permanece imutável.
- A interface deve refletir a identidade do profissional sem embutir a marca do primeiro cliente no produto.
- **PENDENTE:** modelar e implementar biblioteca própria, vídeos/instruções, prescrição e ampliação da identidade; este ADR não confirma implementação dessas capacidades.
