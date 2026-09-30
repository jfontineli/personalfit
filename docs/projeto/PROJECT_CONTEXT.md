# Contexto do produto

## Problema e proposta

**DECISÃO APROVADA:** criar do zero uma plataforma SaaS de acompanhamento fitness para profissionais. O primeiro personal será o primeiro tenant, sem regras específicas embutidas no produto.

O profissional precisa cadastrar alunos, prescrever e publicar treinos, acompanhar execução, frequência e medidas. O aluno precisa consultar e executar o treino pelo celular, inclusive com conexão instável, sem perder seu histórico quando a prescrição mudar.

## Público e papéis

**DECISÃO APROVADA:** a modelagem diferencia plataforma, tenant, profissional e aluno. A plataforma opera múltiplos tenants isolados desde o primeiro incremento.

**HIPÓTESE:** os papéis iniciais serão `SUPER_ADMIN`, `PROFISSIONAL` e `ALUNO`, com papéis de equipe mais granulares posteriormente. A autorização deve se basear em vínculos e permissões, não apenas em um campo global de papel.

## Escopo obrigatório do MVP

**DECISÃO APROVADA:** tenant, identidade visual básica, Auth, profissional, aluno, cadastro/inativação, biblioteca de exercícios, plano de treino por dias/exercícios/séries, rascunho, publicação versionada e atribuição. A PWA do aluno inclui séries, carga, placa, repetições, tempo, RIR opcional, conclusão de série, conclusão/pulo de exercício, treino parcial, descanso, execução offline, sincronização, histórico e frequência. Avaliação básica inclui peso, medidas, data, responsável e observações. Contato por WhatsApp é configurável por tenant.

## Fora do MVP

**DECISÃO APROVADA:** adiar editor completo de dieta, fotos corporais, ranking, gamificação, indicação, afiliados, IA, checkout, cobrança automatizada, chat interno, áudio, wearables, progressão automática, técnicas avançadas estruturadas e domínio personalizado. A dieta não aumenta o escopo técnico inicial.

## Referência

**CONFIRMADO:** `referencia/metodo-gh-referencia.html` foi fornecido como referência funcional e de experiência. A pasta contém material de terceiros e está ignorada pelo Git. Nenhum código, identidade, texto, imagem, nome ou asset da referência compõe o novo produto.

## Objetivo comercial

**DECISÃO APROVADA:** entregar um produto utilizável para o primeiro cliente preservando bases comerciais para vários profissionais. Cobrança poderá evoluir por tenant, alunos, planos e white-label, sem implementar financeiro no MVP.
