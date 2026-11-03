export const routes = {
  login: '/login',
  professionalHome: '/app',
  students: '/app/alunos',
  exercises: '/app/exercicios',
  studentDetail: '/app/alunos/:id',
  brand: '/app/configuracoes',
  studentHome: '/aluno/inicio',
  activation: '/ativar',
  professionalActivation: '/ativar-profissional',
  platformAdmin: '/admin',
  diagnostics: '/diagnostico',
} as const

export function safeActivationReturn(value: string | null): string {
  return value && /^\/ativar(?:-profissional)?#token=[0-9a-f]{64}$/.test(value) ? value : routes.professionalHome
}
