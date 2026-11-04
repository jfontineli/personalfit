# Contexto do produto

## Problema e proposta

**DECISÃO APROVADA:** criar do zero uma plataforma SaaS de acompanhamento fitness para profissionais. O primeiro personal será o primeiro tenant, sem regras específicas embutidas no produto.

O profissional precisa cadastrar alunos, prescrever e publicar treinos, acompanhar execução, frequência e medidas. O aluno precisa consultar e executar o treino pelo celular, inclusive com conexão instável, sem perder seu histórico quando a prescrição mudar.

**DECISÃO APROVADA:** o personal é o centro da experiência. Cada profissional deve poder oferecer aos alunos sua própria marca, nome, foto, logo, cores, contatos, exercícios, vídeos de instrução, treinos, orientações, dietas, acompanhamento e forma de trabalhar. O SaaS compartilha a plataforma entre profissionais com isolamento de dados e identidade por tenant; não padroniza a atuação do personal. A biblioteca própria do profissional e a personalização têm prioridade alta. Uma biblioteca global pode ajudar, mas não é o núcleo do produto nem substitui a autonomia profissional.

## Público e papéis

**DECISÃO APROVADA:** a modelagem diferencia plataforma, tenant, profissional e aluno. A plataforma opera múltiplos tenants isolados desde o primeiro incremento.

**DECISÃO APROVADA:** o fluxo de entrada é superadmin da plataforma → criação do tenant e convite ao personal → ativação da conta pelo personal → cadastro e convite do aluno pelo personal → ativação da conta pelo aluno. O superadmin não define senhas de terceiros nem ganha acesso aos dados privados do tenant.

**CONFIRMADO:** os papéis iniciais são `SUPER_ADMIN`, `PROFISSIONAL` e `ALUNO`. O primeiro é papel da plataforma; os demais dependem de vínculos ativos com o tenant. Papéis de equipe mais granulares permanecem pendentes.

## Escopo obrigatório do MVP

**DECISÃO APROVADA:** tenant, identidade visual básica, Auth, profissional, aluno, cadastro/inativação, biblioteca própria de exercícios criados pelo profissional, plano de treino por dias/exercícios/séries, rascunho, publicação versionada e atribuição. A PWA do aluno inclui séries, carga, placa, repetições, tempo, RIR opcional, conclusão de série, conclusão/pulo de exercício, treino parcial, descanso, execução offline, sincronização, histórico e frequência. Avaliação básica inclui peso, medidas, data, responsável e observações. Contato por WhatsApp é configurável por tenant. Os treinos são criados pelo profissional; o MVP não sugere nem monta treinos automaticamente. O primeiro ciclo entrega instruções e vídeo MP4 próprio sob demanda online; os demais campos de execução previstos ainda serão implementados.

**DECISÃO APROVADA:** o aluno não terá uma opção de download offline. Após abrir o aplicativo e receber a prescrição enquanto conectado, poderá consultar o treino disponível no aparelho e registrar a execução sem rede. Os lançamentos ficam pendentes até confirmação do servidor quando a conexão voltar. Vídeos de instrução exigem conexão; não há promessa de reprodução offline nem download manual de mídia no MVP.

## Fora do MVP

**DECISÃO APROVADA:** adiar fotos corporais do aluno, ranking, gamificação, indicação, afiliados, IA, checkout, cobrança automatizada, chat interno, áudio, wearables, progressão automática, técnicas avançadas estruturadas e domínio personalizado. Dieta e acompanhamento fazem parte da visão do produto. Em 2026-11-03, o usuário definiu o nutricionista parceiro como autor e publicador da prescrição individual (ADR 0015). O primeiro fluxo foi implementado localmente; escopo clínico e implantação remota permanecem pendentes. Foto de perfil e logo do profissional são elementos de identidade, distintos das fotos corporais adiadas.

**CONFIRMADO LOCALMENTE EM 2026-11-03:** o primeiro fluxo de dieta foi implementado com convite do nutricionista pelo personal, área própria de prescrição, publicação versionada e consulta/registro simples pelo aluno. Não contempla cálculo automático, protocolos de medicamentos, validação de CRN ou compartilhamento clínico com o personal. A implantação remota permanece pendente.

## Referência

**CONFIRMADO:** `referencia/metodo-gh-referencia.html` foi fornecido como base funcional e de experiência: apresenta a jornada do treinador que monta treino e dieta, orienta por exercício e acompanha o aluno. O PersonalFit adapta essas necessidades para vários personals com identidade e isolamento próprios. A pasta contém material de terceiros e está ignorada pelo Git. Nenhum código, identidade, texto, imagem, nome ou asset da referência compõe o novo produto; planilhas, templates e ofertas específicas da referência não definem a arquitetura nem o escopo inicial.

## Objetivo comercial

**DECISÃO APROVADA:** entregar um produto utilizável para o primeiro cliente preservando bases comerciais para vários profissionais. Cobrança poderá evoluir por tenant, alunos, planos e white-label, sem implementar financeiro no MVP.
**DECISÃO APROVADA EM 2026-11-03:** um personal que também é nutricionista pode prescrever a alimentação dos alunos a ele atribuídos com a mesma conta. A capacidade clínica é individual por aluno e não decorre automaticamente do papel de personal. Ver ADR 0016; verificação humana do CRN permanece pendente.
