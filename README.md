# PersonalFit

**DECISÃO APROVADA:** PersonalFit é o nome temporário de um produto SaaS para profissionais de treinamento físico. Cada operação é um tenant com marca, equipe, alunos e dados isolados. O primeiro profissional será o primeiro cliente da plataforma.

**ESTADO ATUAL:** a base de identidade inclui onboarding superadmin → personal → aluno, contexto de tenant, marca, convites e RLS. O primeiro ciclo de treino permite biblioteca própria, vídeo privado online, rascunho/publicação por aluno, registro de séries offline e sincronização idempotente. Dieta, avaliação, hospedagem e ampliação do acompanhamento continuam pendentes.

## Comece por aqui

1. Leia [docs/projeto/README.md](docs/projeto/README.md) e [docs/projeto/CURRENT_STATE.md](docs/projeto/CURRENT_STATE.md).
2. Consulte [AGENTS.md](AGENTS.md) antes de alterar o projeto com um agente.
3. Consulte as [decisões de arquitetura](docs/decisions/README.md) e a documentação do módulo afetado.

## Estrutura

- `apps/web/`: aplicação React + TypeScript, mobile first e PWA, com áreas mínimas profissional/aluno.
- `supabase/`: configuração local, migration, seed e testes pgTAP.
- `tests/`: futuras verificações de ponta a ponta, autorização e sincronização.
- `docs/projeto/`: memória persistente do produto e do estado de implementação.
- `docs/decisions/`: decisões de arquitetura registradas como ADRs.
- `infra/`: futura configuração operacional.
- `referencia/`: material fornecido para estudo funcional. Não é código, conteúdo ou identidade visual do produto e está excluído do Git.

**Hospedagem:** o mesmo repositório contém o frontend (`apps/web/`) e a estrutura do backend (`supabase/`). O Supabase Cloud de teste já recebeu schema, contas e dados locais. Cloudflare Pages servirá a aplicação após conectar este repositório GitHub e configurar as duas variáveis públicas de build; produção terá banco separado. Consulte [ADR 0014](docs/decisions/0014-cloudflare-pages-supabase-hosting.md) e [INFRASTRUCTURE.md](docs/projeto/INFRASTRUCTURE.md).

## Execução local

Use Node 24 e Docker Desktop. Execute `npm install` e `npm run db:start`. Use `npm run db:reset` apenas quando quiser recriar o banco local, pois ele apaga contas e dados locais; `npm run db:test` verifica as migrations aplicadas. Copie `.env.example` para `apps/web/.env.local` e substitua a chave pública pelo valor de `npx supabase status -o env` (chave publicável/anon local). Depois execute `npm run dev`. `npm run lint`, `npm run test` e `npm run build` validam o frontend. `npm run test:e2e` exige build e Chromium do Playwright. Veja [DEVELOPMENT.md](docs/projeto/DEVELOPMENT.md) para detalhes.

Use `/login` para entrar, `/admin` para o superadmin criar/listar espaços, gerar convites e gerir plano, prazo e acesso, `/ativar-profissional` para ativar o personal, `/app` para a área do personal, `/ativar` para o convite do aluno, `/aluno/inicio` para a área do aluno e `/diagnostico` para testes técnicos. “Espaço” é o nome mostrado na interface para o tenant técnico. Tipos de plano ainda não incluem preço ou cobrança. Não há deploy nem credenciais reais versionadas.

No painel, use **Cadastrar personal**, copie o convite gerado e entregue ao profissional. A lista permite buscar espaços, filtrar o estado do plano e editar prazo ou suspensão; dados de alunos não aparecem para o superadmin. Se o convidado já possui conta, o link **Entre e volte ao convite automaticamente** o devolve à ativação após o login.

Na área do personal, **Alunos** reúne busca, filtros e cadastro; **Marca** permite escolher as cores e enviar um logotipo PNG, JPG ou WebP de até 2 MB, com prévia antes de salvar. O arquivo fica em Storage privado do espaço. No cadastro de um aluno sem conta, gere o convite e use **Copiar convite** ou **Compartilhar pelo WhatsApp**; nesse caso, escolha o contato e confirme o envio no WhatsApp.

**Exercícios** permite cadastrar instruções e vídeo próprio MP4 de até 25 MB, consultado online. No detalhe do aluno, o personal registra o plano de atendimento, monta o rascunho por dias e publica uma versão. O aluno abre `/aluno/inicio`, registra séries mesmo sem conexão após carregar o treino uma vez, e vê quando o servidor confirma os lançamentos. Não há botão de download offline.

O vídeo de um exercício pode ser MP4 privado ou link do YouTube. Ao atualizá-lo na biblioteca, os alunos que têm esse exercício prescrito veem a mídia atual quando abrem o treino online, sem nova publicação individual. Mudanças na prescrição de um aluno continuam exigindo publicação para ele.

No treino, toque em **Ver vídeo online** para abrir o vídeo sobre o exercício; feche para voltar ao mesmo ponto. Se o autor do vídeo no YouTube não permitir incorporação, o modal oferece um link externo como alternativa.

A biblioteca do personal mostra exercícios por grupo principal, com busca e filtro. O grupo pode ser editado e o vídeo é opcional. No detalhe de cada aluno, as abas **Cadastro**, **Atendimento** e **Treino** separam as tarefas sem descartar alterações ainda não salvas ao alternar entre elas.

No editor de treino, escolha um dia na barra de navegação para ver seus exercícios e use **Mover antes/depois** para definir a sequência dos dias. Dentro do exercício aberto, use **Subir/Descer exercício** para definir a sequência de execução. Salvar mantém o rascunho privado; publicar entrega todos os dias da versão ao aluno. Na área do aluno, escolha a semana e o dia; apenas os exercícios daquele dia aparecem, em cartões que abrem sob demanda.
