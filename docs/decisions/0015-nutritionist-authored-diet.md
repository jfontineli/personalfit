# ADR 0015 — Autoria da prescrição alimentar pelo nutricionista parceiro

- Data: 2026-11-03
- Status: **DECISÃO APROVADA**

## Contexto

A dieta integra a visão do PersonalFit e a referência apresenta refeições, alternativas e registros do aluno. Antes desta decisão, o modelo tinha apenas superadmin, personal e aluno, sem editor, papel de nutricionista ou schema de dieta. A documentação anterior adiava o editor estruturado para depois do MVP. O usuário decidiu iniciar essa área e definiu que a prescrição alimentar individual será criada e publicada por nutricionista parceiro dentro do sistema.

A prescrição dietética é atribuição do nutricionista, conforme a Lei 8.234/1991, art. 3º, VIII, e orientação do CFN. Dados de saúde exigem tratamento específico como dados pessoais sensíveis.

## Decisão

O personal organiza o atendimento e pode conectar o aluno a um nutricionista parceiro. O nutricionista entra com conta própria, acessa sua área profissional restrita aos alunos a ele vinculados e nela cria, revisa e publica o plano alimentar individual. O aluno consulta o plano que lhe foi publicado e registra sua própria execução. O personal não recebe permissão de editar ou publicar prescrições dietéticas em nome do nutricionista. O superadmin não recebe acesso automático ao conteúdo clínico do tenant.

Este ADR substitui a premissa genérica de “autoria profissional” dos documentos anteriores por autoria **do nutricionista** para a prescrição alimentar individual. A validação clínica exige revisão humana.

## Consequências e pontos de desenho

- **CONFIRMADO localmente:** convite e vínculo do nutricionista com um aluno, login com conta própria, área de edição, autorização por RPC/RLS, rascunho e publicação versionada. A comprovação do CRN permanece pendente.
- **CONFIRMADO localmente:** o aluno consulta a versão publicada e registra refeições; operações offline têm ID estável, fila local e reenvio idempotente. A versão publicada permanece imutável.
- **PENDENTE:** definir consentimento/base legal, acesso do personal a dados alimentares, retenção e auditoria com revisão humana apropriada.
- **PENDENTE:** gerenciar a troca ou revogação do nutricionista, vigência do plano, conflitos entre dispositivos, visibilidade consensual de registros ao personal e revisão clínica antes de uso real.
- **NECESSITA VALIDAÇÃO HUMANA:** verificar credenciais e responsabilidade do nutricionista; aprovar o conteúdo clínico, equivalência de substituições, suplementos e qualquer informação relacionada a medicamentos. Conteúdo importado permanece em rascunho privado até revisão explícita do nutricionista vinculado.

## Referências normativas

- [CFN — Prescrição dietética](https://www.cfn.org.br/wp-content/uploads/2023/11/RESUMIDA_PRESCRI%C3%87%C3%83O-DIET%C3%89TICA.pdf)
- [ANPD — Perguntas frequentes sobre dados pessoais sensíveis](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes)
