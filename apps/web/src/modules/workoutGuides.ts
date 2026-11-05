import type { WorkoutGuideKey } from '../services/workouts'

export const workoutGuideSections: { key: WorkoutGuideKey; title: string; hint: string }[] = [
  { key: 'COMO_USAR', title: 'Como usar o treino', hint: 'Explique a rotina do aplicativo e a ordem do treino.' },
  { key: 'EXECUCAO', title: 'Execução e técnicas', hint: 'Oriente séries, descanso e técnicas que você prescreveu.' },
  { key: 'HIPOPRESSIVO', title: 'Hipopressivo', hint: 'Inclua apenas se fizer parte do atendimento deste aluno.' },
  { key: 'ACOMPANHAMENTO', title: 'Acompanhamento', hint: 'Informe como o aluno deve relatar progresso e pedir ajustes.' },
  { key: 'GLOSSARIO', title: 'Glossário', hint: 'Explique termos que você usa nesta prescrição.' },
  { key: 'ACESSORIOS', title: 'Acessórios', hint: 'Liste somente o que é necessário para este aluno.' },
  { key: 'INDICACOES', title: 'Links e indicações', hint: 'Inclua referências ou lojas, se desejar.' },
  { key: 'CONTATO', title: 'Contato e dúvidas', hint: 'Explique como o aluno pode falar com você.' },
]
