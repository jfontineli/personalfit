import { useEffect, useState } from 'react'
import type { Student } from '../services/business'
import { supabase } from '../services/supabase'

type Activity = { student_id: string; has_workout: boolean; last_session_status: string | null; last_session_at: string | null; completed_7d: number; partial_7d: number }
type Filter = 'ATTENTION' | 'ACTIVE' | 'ALL'

function activityLabel(row: Activity | undefined) {
  if (!row?.has_workout) return 'Sem treino publicado'
  if (row.last_session_status === 'PARTIAL') return 'Último treino incompleto'
  if (row.last_session_status === 'PAUSED') return 'Treino pausado'
  if (row.last_session_status === 'IN_PROGRESS') return 'Treino em andamento'
  if (row.partial_7d > 0) return `${row.partial_7d} ${row.partial_7d === 1 ? 'treino incompleto' : 'treinos incompletos'} nos últimos 7 dias`
  if (!row.last_session_at) return 'Sem treino registrado'
  if (Date.now() - new Date(row.last_session_at).getTime() > 7 * 86400000) return 'Sem registro há mais de 7 dias'
  return `${row.completed_7d} ${row.completed_7d === 1 ? 'treino concluído' : 'treinos concluídos'} nos últimos 7 dias`
}

function needsAttention(student: Student, row: Activity | undefined) {
  return student.status === 'ACTIVE' && !!student.user_id && (!row?.has_workout || !row.last_session_at ||
    row.last_session_status === 'PARTIAL' || row.partial_7d > 0 || Date.now() - new Date(row.last_session_at).getTime() > 7 * 86400000)
}

export function ProfessionalOverview({ tenantId, students }: { tenantId: string; students: Student[] }) {
  const [activity, setActivity] = useState<Activity[]>([])
  const [filter, setFilter] = useState<Filter>('ATTENTION')
  const [error, setError] = useState('')
  const [loadedTenantId, setLoadedTenantId] = useState('')

  useEffect(() => {
    let mounted = true
    if (!supabase) return
    void supabase.rpc('professional_workout_overview', { p_tenant: tenantId }).then(({ data, error: failure }) => {
      if (!mounted) return
      if (failure) setError('Não foi possível carregar a atividade dos alunos. Tente atualizar a página.')
      else { setActivity((data ?? []) as Activity[]); setError('') }
      setLoadedTenantId(tenantId)
    })
    return () => { mounted = false }
  }, [tenantId])

  const byStudent = new Map(activity.map(row => [row.student_id, row]))
  const attention = students.filter(student => needsAttention(student, byStudent.get(student.id)))
  const visible = students.filter(student => filter === 'ALL' || filter === 'ACTIVE' && student.status === 'ACTIVE' || filter === 'ATTENTION' && needsAttention(student, byStudent.get(student.id)))

  return <section className="professional-activity" aria-labelledby="activity-title">
    <div className="section-heading"><div><span className="eyebrow">Acompanhamento</span><h3 id="activity-title">Como estão seus alunos</h3><p>Veja quem treinou e quem pode precisar de contato. A avaliação continua sendo sua.</p></div></div>
    {!supabase ? <p role="alert" className="feedback error">Conexão indisponível.</p> : loadedTenantId !== tenantId ? <p>Carregando atividade…</p> : error ? <p role="alert" className="feedback error">{error}</p> : <>
      <div className="activity-filters" aria-label="Filtrar alunos">
        <button type="button" aria-pressed={filter === 'ATTENTION'} onClick={() => setFilter('ATTENTION')}>Para acompanhar · {attention.length}</button>
        <button type="button" aria-pressed={filter === 'ACTIVE'} onClick={() => setFilter('ACTIVE')}>Ativos</button>
        <button type="button" aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')}>Todos</button>
      </div>
      {visible.length ? <div className="activity-list">{visible.map(student => {
        const row = byStudent.get(student.id)
        return <article className="activity-row" key={student.id}><div><strong>{student.full_name}</strong><span>{student.status !== 'ACTIVE' ? 'Cadastro inativo' : !student.user_id ? 'Conta ainda não ativada' : activityLabel(row)}</span>{row?.last_session_at && <small>Último registro: {new Date(row.last_session_at).toLocaleDateString('pt-BR')}</small>}</div><a href={`/app/alunos/${student.id}?aba=treino`}>Ver treino →</a></article>
      })}</div> : <p className="empty-state">{filter === 'ATTENTION' ? 'Nenhum aluno precisa de atenção por estes indicadores agora.' : 'Nenhum aluno neste filtro.'}</p>}
    </>}
  </section>
}
