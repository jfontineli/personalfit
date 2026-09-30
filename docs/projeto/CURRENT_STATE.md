# Estado atual

Atualizado em: 2026-09-29.

## CONFIRMADO

- A Fase 0 foi aprovada pelo usuário.
- A Fase 1 estabeleceu a estrutura do repositório, esta memória, `AGENTS.md`, exemplos de configuração e ADRs iniciais.
- `referencia/` já existia antes desta fase e está ignorada pelo Git.
- A Fase 2 adicionou frontend técnico executável em `apps/web/`, PWA gerada em build, IndexedDB versionado, Supabase Auth e testes de frontend.
- A Fase 2 foi aprovada e a Fase 2.1 validou `npm run db:start`, `npm run db:reset` e `npm run db:test` no Supabase local. A migration, o seed de Tenant A/B e 19 testes pgTAP de RLS/idempotência passaram.
- O E2E local validou Auth para usuário A, B e sem vínculo, login/logout, sessão após reload/nova aba, renovação, isolamento por tenant e fila técnica enviada após retorno online; 2 E2E passaram. As contas temporárias foram removidas.
- `npm ci`, lint, 5 testes Vitest, build PWA e os 2 E2E passaram com Node 24. A PWA abriu offline após uma carga inicial.
- O Docker Desktop estava parado e C: tinha 2,40 GB livres. O serviço foi iniciado e o cache de build Docker foi limpo sem tocar imagens, contêineres ou volumes. C: ainda tem pouco espaço livre; o Vector local reinicia por falha ao ler logs do Docker, sem bloquear os serviços necessários.
- A propriedade de `.git` foi corrigida na tarefa anterior; Git na conta local funciona sem `safe.directory`. O sandbox ainda pode executar com outra identidade.
- A Fase 3 adicionou uma migration nova para perfis, papéis controlados, profissionais, alunos, observações internas separadas, convites de 48 horas com hash e uso único, administração mínima da plataforma e auditoria por metadados. A migration histórica da Fase 2 permaneceu intacta.
- Uma aplicação web React atende aluno e profissional em áreas separadas nesta fase.
- As áreas mínimas `/login`, `/app`, `/app/alunos`, `/app/alunos/:id`, `/app/configuracoes`, `/aluno/inicio` e `/ativar` usam vínculos ativos e contexto de tenant. O diagnóstico técnico permanece em `/diagnostico`.
- Os testes pgTAP de identidade e fundação técnica cobrem isolamento A/B, dois alunos do mesmo tenant, inativação, convite, associação ao Auth e negações por papel. O E2E de identidade passou com cadastro, edição, marca, seleção de tenant, URL de outro tenant e ativação.

## DECISÃO APROVADA

- Stack: React + TypeScript, PWA mobile first, Supabase Auth/Storage, PostgreSQL, IndexedDB, fila de sincronização e Cache Storage.
- Monorepo modular, multi-tenancy e white-label desde o início; sem Spring Boot inicialmente.
- Prescrição publicada é versionada e execução mantém sua versão; histórico permanece após edição.
- Escopo e adiamentos estão em `PROJECT_CONTEXT.md`.

## HIPÓTESE

- O primeiro endereço usa domínio da plataforma e rota ou subdomínio por tenant.
- A API de sincronização usa operações com ID imutável e confirmação por item.

## PENDENTE

- Aprovação humana para iniciar a fase posterior de produto.
- Definição do primeiro tenant real, nome comercial e identidade de marca.
- Escolha da hospedagem web e região dos serviços.
- Treino, prescrição, avaliação, contratos de sincronização de negócio, políticas RLS para entidades futuras e implantação.
- Entrega automática de convites, recuperação de convite, política de troca de e-mail e operações administrativas de SUPER_ADMIN com servidor e auditoria dedicada.

## NECESSITA VALIDAÇÃO HUMANA

- Responsável pelo tratamento dos dados e políticas de retenção.
- Campos exatos das medidas básicas e quem poderá registrá-las.
- Política de acesso excepcional do suporte da plataforma.
- Orçamento operacional e data do piloto.

## Próximo marco autorizado

A Fase 3 de identidade, tenant, papéis e autorização de negócio foi implementada e validada localmente. Funcionalidades de treino e fases posteriores aguardam aprovação.
