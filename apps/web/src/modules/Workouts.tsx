import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createExercise, downloadExerciseVideo, getCurrentWorkout, getStudentServicePlan, getWorkoutPlan, listExercises, listWorkoutSessions, normalizeYoutubeUrl, publishWorkoutPlan, saveStudentServicePlan, saveWorkoutPlan, updateExercise, uploadExerciseVideo,
  type DraftDay, type Exercise, type MuscleGroup, type StudentServicePlan, type WorkoutDraft, type WorkoutSession, type WorkoutVersion } from '../services/workouts'
import { workoutGuideSections } from './workoutGuides'

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
const emptyDraft = (): WorkoutDraft => ({ days: [{ id: crypto.randomUUID(), name: 'Treino A', items: [] }] })
const exerciseGroups: { id: MuscleGroup; label: string }[] = [
  { id: 'MOBILIDADE', label: 'Mobilidade e preparo' }, { id: 'PEITO', label: 'Peito' },
  { id: 'COSTAS', label: 'Costas' }, { id: 'OMBROS', label: 'Ombros' },
  { id: 'BRACOS', label: 'Braços' }, { id: 'PERNAS', label: 'Pernas' },
  { id: 'POSTERIOR_GLUTEOS', label: 'Posterior e glúteos' }, { id: 'PANTURRILHAS', label: 'Panturrilhas' },
  { id: 'CORE', label: 'Abdômen e core' }, { id: 'CARDIO', label: 'Cardio' }, { id: 'OUTROS', label: 'Outros' },
]
const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
type VideoMode = 'NONE' | 'KEEP' | 'YOUTUBE' | 'UPLOAD'

function VideoFields({ id, mode, setMode, youtubeUrl, setYoutubeUrl, file, setFile, currentUrl }: {
  id: string; mode: VideoMode; setMode: (value: VideoMode) => void; youtubeUrl: string; setYoutubeUrl: (value: string) => void;
  file: File | null; setFile: (value: File | null) => void; currentUrl?: string | null
}) {
  const choices: { value: VideoMode; label: string }[] = [
    ...(currentUrl ? [{ value: 'KEEP' as const, label: 'Manter vídeo atual' }] : []),
    { value: 'NONE', label: 'Sem vídeo' }, { value: 'YOUTUBE', label: 'Link do YouTube' }, { value: 'UPLOAD', label: 'Enviar MP4' },
  ]
  return <fieldset className="exercise-video-choice"><legend>Vídeo de instrução <span className="field-hint">Opcional</span></legend>
    <p>Escolha uma fonte. O YouTube não ocupa o armazenamento do PersonalFit e abre online para o aluno.</p>
    <div className="exercise-video-options">{choices.map(choice => <label key={choice.value}><input type="radio" name={id} value={choice.value} checked={mode === choice.value} onChange={() => { setMode(choice.value); setYoutubeUrl(''); setFile(null) }} />{choice.label}</label>)}</div>
    {mode === 'YOUTUBE' && <label>Link do YouTube<input type="url" value={youtubeUrl} onChange={event => setYoutubeUrl(event.target.value)} required placeholder="https://www.youtube.com/watch?v=..." /></label>}
    {mode === 'UPLOAD' && <label>Arquivo MP4 <span className="field-hint">Até 25 MB; reprodução online</span><input type="file" accept="video/mp4" required={!file} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>}
    {mode === 'KEEP' && currentUrl && <InstructionVideo videoUrl={currentUrl} />}
  </fieldset>
}

export function ExerciseLibrary({ tenantId }: { tenantId: string }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('OUTROS')
  const [videoMode, setVideoMode] = useState<VideoMode>('NONE')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<MuscleGroup | 'TODOS'>('TODOS')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    void listExercises(tenantId).then(rows => { if (active) setExercises(rows) }).catch(failure => { if (active) setError(messageOf(failure)) })
    return () => { active = false }
  }, [tenantId])
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    let created: Exercise | null = null
    try {
      if (videoMode === 'UPLOAD' && !videoFile) throw new Error('Selecione um arquivo MP4 ou escolha outra opção de vídeo.')
      const link = videoMode === 'YOUTUBE' ? normalizeYoutubeUrl(youtubeUrl) : null
      const newExercise = await createExercise(tenantId, name, instructions, link, muscleGroup)
      created = newExercise
      setExercises(previous => [...previous, newExercise].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')))
      if (videoMode === 'UPLOAD' && videoFile) {
        const updated = await uploadExerciseVideo(newExercise, videoFile)
        setExercises(previous => previous.map(item => item.id === newExercise.id ? updated : item))
      }
      setName(''); setInstructions(''); setYoutubeUrl(''); setVideoMode('NONE'); setMuscleGroup('OUTROS'); setShowCreate(false); setVideoFile(null)
      setNotice('Exercício salvo na biblioteca. Para aparecer no treino do aluno, inclua-o no rascunho e publique uma versão.')
    } catch (failure) {
      setError(created ? `Exercício cadastrado, mas o vídeo não foi salvo: ${messageOf(failure)} Abra “Editar exercício” para tentar novamente.` : messageOf(failure))
      if (created) { setName(''); setInstructions(''); setYoutubeUrl(''); setVideoMode('NONE'); setMuscleGroup('OUTROS'); setShowCreate(false); setVideoFile(null) }
    }
    finally { setSaving(false) }
  }
  const visible = exercises.filter(exercise => (filterGroup === 'TODOS' || exercise.muscle_group === filterGroup)
    && searchText(`${exercise.name} ${exercise.instructions}`).includes(searchText(search.trim())))
  return <section className="panel professional-panel"><div className="section-heading"><div><span className="eyebrow">Sua biblioteca</span><h2>Exercícios</h2><p>Encontre e organize os exercícios que você prescreve. O vídeo é opcional.</p></div><button type="button" onClick={() => setShowCreate(value => !value)} aria-expanded={showCreate}>{showCreate ? 'Fechar cadastro' : 'Novo exercício'}</button></div>
    {error && <p role="alert" className="feedback error">{error}</p>}
    {notice && <p role="status" className="feedback success">{notice}</p>}
    {showCreate && <form onSubmit={event => void submit(event)} className="workout-form exercise-create-form">
      <label>Nome do exercício<input value={name} onChange={event => setName(event.target.value)} required maxLength={160} placeholder="Ex.: Agachamento livre" /></label>
      <label>Grupo principal<select value={muscleGroup} onChange={event => setMuscleGroup(event.target.value as MuscleGroup)}>{exerciseGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
      <label>Suas instruções<textarea value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={4000} placeholder="Como você orienta a execução" /></label>
      <VideoFields id="new-exercise-video" mode={videoMode} setMode={setVideoMode} youtubeUrl={youtubeUrl} setYoutubeUrl={setYoutubeUrl} file={videoFile} setFile={setVideoFile} />
      <button disabled={saving}>{saving ? 'Salvando…' : 'Adicionar exercício'}</button>
    </form>}
    <div className="exercise-filters"><label>Buscar exercício<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou instrução" /></label><label>Grupo<select value={filterGroup} onChange={event => setFilterGroup(event.target.value as MuscleGroup | 'TODOS')}><option value="TODOS">Todos os grupos</option>{exerciseGroups.map(group => <option key={group.id} value={group.id}>{group.label} ({exercises.filter(item => item.muscle_group === group.id).length})</option>)}</select></label></div>
    <p className="exercise-result-count" role="status">{visible.length} {visible.length === 1 ? 'exercício encontrado' : 'exercícios encontrados'}</p>
    <div className="workout-list">{exercises.length === 0 ? <p className="empty-state">Sua biblioteca ainda está vazia. Cadastre o primeiro exercício.</p> : visible.length === 0 ? <p className="empty-state">Nenhum exercício corresponde à busca. Tente outro nome ou grupo.</p> : exerciseGroups.map(group => { const rows = visible.filter(exercise => exercise.muscle_group === group.id); return rows.length ? <section className="exercise-group" key={group.id} aria-label={group.label}><h3>{group.label} <span>{rows.length}</span></h3>{rows.map(exercise =>
      <ExerciseCard key={exercise.id} exercise={exercise} onSaved={updated => setExercises(previous => previous.map(item => item.id === updated.id ? updated : item))} />)}</section> : null })}</div>
  </section>
}

function ExerciseCard({ exercise, onSaved }: { exercise: Exercise; onSaved: (updated: Exercise) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(exercise.name)
  const [instructions, setInstructions] = useState(exercise.instructions)
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(exercise.muscle_group)
  const [videoMode, setVideoMode] = useState<VideoMode>(exercise.video_url ? 'KEEP' : 'NONE')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      if (videoMode === 'UPLOAD' && !videoFile) throw new Error('Selecione um arquivo MP4 ou escolha outra opção de vídeo.')
      const updated = videoMode === 'UPLOAD' && videoFile
        ? await uploadExerciseVideo(exercise, videoFile, { name, instructions, muscleGroup })
        : await updateExercise(exercise, name, instructions, muscleGroup,
          videoMode === 'YOUTUBE' ? normalizeYoutubeUrl(youtubeUrl) : videoMode === 'KEEP' ? exercise.video_url : null)
      onSaved(updated); setEditing(false)
      setNotice(updated.video_url !== exercise.video_url
        ? 'Vídeo salvo. Alunos com este exercício verão a mídia atual ao abrir o treino com internet, sem nova publicação.'
        : 'Exercício atualizado.')
    }
    catch (failure) { setError(messageOf(failure)) }
    finally { setSaving(false) }
  }
  return <article className="workout-item exercise-library-card"><div className="section-heading"><div><h4>{exercise.name}</h4><p>{exercise.video_url ? 'Com vídeo' : 'Sem vídeo · pode adicionar depois'}{exercise.instructions ? ' · Com instruções' : ''}</p></div>
    <button type="button" className="secondary-button" onClick={() => { if (!editing) { setName(exercise.name); setInstructions(exercise.instructions); setMuscleGroup(exercise.muscle_group); setVideoMode(exercise.video_url ? 'KEEP' : 'NONE'); setYoutubeUrl(''); setVideoFile(null); setError('') } setEditing(value => !value) }} aria-expanded={editing}>{editing ? 'Fechar' : 'Editar exercício'}</button></div>
    {editing && <form onSubmit={event => void save(event)}><label>Nome<input value={name} onChange={event => setName(event.target.value)} required maxLength={160} /></label>
      <label>Grupo principal<select value={muscleGroup} onChange={event => setMuscleGroup(event.target.value as MuscleGroup)}>{exerciseGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
      <label>Instruções<textarea value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={4000} /></label>
      <VideoFields id={`exercise-video-${exercise.id}`} mode={videoMode} setMode={setVideoMode} youtubeUrl={youtubeUrl} setYoutubeUrl={setYoutubeUrl} file={videoFile} setFile={setVideoFile} currentUrl={exercise.video_url} />
      <button disabled={saving}>{saving ? 'Salvando…' : 'Salvar exercício'}</button></form>}
    {error && <p role="alert" className="feedback error">{error}</p>}
    {notice && <p role="status" className="feedback success">{notice}</p>}
  </article>
}

export function InstructionVideo({ videoUrl }: { videoUrl: string }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const requestRef = useRef(0)
  const isStored = videoUrl.startsWith('storage:')
  let youtubeId: string | null = null
  if (!isStored) {
    try { youtubeId = new URL(normalizeYoutubeUrl(videoUrl)).searchParams.get('v') } catch { /* Legacy external links keep their original behavior. */ }
  }
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [open])
  useEffect(() => () => { if (source) URL.revokeObjectURL(source) }, [source])
  if (!isStored && !youtubeId) return <a href={videoUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Ver vídeo online ↗</a>
  function close() {
    requestRef.current += 1
    setOpen(false); setLoading(false); setSource(''); setError('')
    triggerRef.current?.focus()
  }
  async function openVideo() {
    if (!navigator.onLine) { setError('O vídeo precisa de internet. Seus lançamentos continuam disponíveis offline.'); return }
    setError(''); setOpen(true)
    if (!isStored) return
    const request = ++requestRef.current
    setLoading(true)
    try {
      const blob = await downloadExerciseVideo(videoUrl.slice('storage:'.length))
      if (request === requestRef.current) setSource(URL.createObjectURL(blob))
    } catch (failure) { if (request === requestRef.current) setError(messageOf(failure)) }
    finally { if (request === requestRef.current) setLoading(false) }
  }
  return <div className="instruction-video"><button ref={triggerRef} type="button" className="secondary-button" onClick={() => void openVideo()}>Ver vídeo online</button>
    {!open && error && <p role="alert" className="feedback error">{error}</p>}
    {open && <dialog ref={dialogRef} className="instruction-video-dialog" aria-label="Vídeo de instrução" onClose={close} onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close() }}>
      <div className="instruction-video-modal"><div className="instruction-video-modal-heading"><strong>Vídeo de instrução</strong><button type="button" className="secondary-button" onClick={() => dialogRef.current?.close()}>Fechar vídeo</button></div>
        {youtubeId ? <iframe title="Vídeo de instrução do YouTube" className="instruction-video-frame" src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          : loading ? <p role="status">Carregando vídeo…</p> : source ? <video controls autoPlay src={source} aria-label="Vídeo de instrução" /> : null}
        {error && <p role="alert" className="feedback error">{error}</p>}
        {youtubeId && <p className="instruction-video-fallback">Se o autor não permitir reprodução aqui, <a href={videoUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">abra no YouTube</a>.</p>}
      </div>
    </dialog>}</div>
}

export function StudentServicePlanEditor({ tenantId, studentId }: { tenantId: string; studentId: string }) {
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0,10))
  const [endsOn, setEndsOn] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let mounted = true
    void getStudentServicePlan(tenantId,studentId).then(plan => {
      if (plan && mounted) { setName(plan.name); setStartsOn(plan.starts_on); setEndsOn(plan.ends_on ?? ''); setActive(plan.active) }
    }).catch(failure => { if (mounted) setError(messageOf(failure)) })
    return () => { mounted = false }
  }, [tenantId,studentId])
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try { await saveStudentServicePlan(tenantId,studentId,{ name, starts_on: startsOn, ends_on: endsOn || null, active }); setMessage('Atendimento atualizado.') }
    catch (failure) { setError(messageOf(failure)) }
    finally { setSaving(false) }
  }
  return <section className="service-plan" aria-labelledby="student-service-title"><span className="eyebrow">Combinado com o aluno</span><h3 id="student-service-title">Plano de atendimento</h3>
    <p>Registre como você chama este atendimento e seu período. Este cadastro não faz cobrança nem bloqueia o aplicativo automaticamente.</p>
    <form onSubmit={event => void submit(event)}><label>Nome do atendimento<input value={name} onChange={event => setName(event.target.value)} maxLength={160} placeholder="Ex.: Treino e acompanhamento" required /></label>
      <div className="form-grid"><label>Início<input type="date" value={startsOn} onChange={event => setStartsOn(event.target.value)} required /></label>
        <label>Fim previsto <span className="field-hint">Opcional</span><input type="date" value={endsOn} min={startsOn} onChange={event => setEndsOn(event.target.value)} /></label></div>
      <label className="check-row"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} /> Atendimento ativo</label>
      <button disabled={saving}>{saving ? 'Salvando…' : 'Salvar atendimento'}</button></form>
    {error && <p role="alert" className="feedback error">{error}</p>}{message && <p role="status" className="feedback success">{message}</p>}
  </section>
}

export function StudentServicePlanSummary({ tenantId, studentId }: { tenantId: string; studentId: string }) {
  const [plan, setPlan] = useState<StudentServicePlan | null>(null)
  useEffect(() => {
    if (!navigator.onLine) return
    let mounted = true
    void getStudentServicePlan(tenantId,studentId).then(value => { if (mounted) setPlan(value) }).catch(() => {})
    return () => { mounted = false }
  }, [tenantId,studentId])
  if (!plan) return null
  return <div className="service-plan-summary"><strong>Seu atendimento: {plan.name}</strong><p>{plan.active ? 'Ativo' : 'Marcado como inativo'} · Início: {plan.starts_on.split('-').reverse().join('/')}{plan.ends_on ? ` · Fim previsto: ${plan.ends_on.split('-').reverse().join('/')}` : ''}</p></div>
}

export function WorkoutEditor({ tenantId, studentId, studentName, active }: { tenantId: string; studentId: string; studentName: string; active: boolean }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [title, setTitle] = useState('Treino de ' + studentName)
  const [draft, setDraft] = useState<WorkoutDraft>(emptyDraft)
  const [current, setCurrent] = useState<WorkoutVersion | null>(null)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    void Promise.all([listExercises(tenantId), getWorkoutPlan(tenantId, studentId), getCurrentWorkout(tenantId, studentId), listWorkoutSessions(tenantId, studentId)])
      .then(([items, existing, assigned, history]) => { if (mounted) {
        setExercises(items); setSessions(history); setCurrent(assigned?.version ?? null)
        if (existing) { setTitle(existing.title); setDraft(existing.draft) }
      } }).catch(failure => { if (mounted) setError(messageOf(failure)) })
    return () => { mounted = false }
  }, [tenantId, studentId])
  function updateDay(dayId: string, update: (day: DraftDay) => DraftDay) {
    setDraft(previous => ({ ...previous, days: previous.days.map(day => day.id === dayId ? update(day) : day) }))
    setConfirmPublish(false)
  }
  async function save(publish: boolean) {
    setSaving(true); setError(''); setMessage('')
    try {
      const saved = await saveWorkoutPlan(tenantId, studentId, title, draft)
      if (publish) {
        await publishWorkoutPlan(saved.id)
        const assigned = await getCurrentWorkout(tenantId, studentId)
        setCurrent(assigned?.version ?? null)
        setMessage('Treino publicado e entregue ao aluno. O histórico anterior foi preservado.')
      } else setMessage('Rascunho salvo. O aluno só recebe o treino após a publicação.')
      setConfirmPublish(false)
    } catch (failure) { setError(messageOf(failure)) }
    finally { setSaving(false) }
  }
  const activeDay = draft.days[activeDayIndex] ?? draft.days[0]
  function selectDay(index: number) {
    setActiveDayIndex(index)
    setExpandedItemId(null)
    setConfirmPublish(false)
  }
  function moveDay(direction: -1 | 1) {
    const target = activeDayIndex + direction
    if (target < 0 || target >= draft.days.length) return
    setDraft(previous => {
      const days = [...previous.days]
      ;[days[activeDayIndex], days[target]] = [days[target], days[activeDayIndex]]
      return { ...previous, days }
    })
    setActiveDayIndex(target)
    setConfirmPublish(false)
  }
  function moveExercise(dayId: string, itemIndex: number, direction: -1 | 1) {
    updateDay(dayId, day => {
      const target = itemIndex + direction
      if (target < 0 || target >= day.items.length) return day
      const items = [...day.items]
      ;[items[itemIndex], items[target]] = [items[target], items[itemIndex]]
      return { ...day, items }
    })
  }
  return <section className="workout-editor" aria-labelledby="workout-editor-title"><div className="section-heading"><div><span className="eyebrow">Prescrição do personal</span><h3 id="workout-editor-title">Treino prescrito</h3><p>{current ? `Versão ${current.version_number} publicada em ${new Date(current.published_at).toLocaleDateString('pt-BR')}.` : 'Nenhum treino publicado para este aluno.'}</p></div></div>
    {error && <p role="alert" className="feedback error">{error}</p>}{message && <p role="status" className="feedback success">{message}</p>}
    <p className="field-hint">Vídeos da biblioteca aparecem para o aluno quando ele abre o treino com internet. Mudanças nesta prescrição exigem publicação para este aluno.</p>
    {!active && <p className="feedback error">Reative o aluno antes de publicar um treino.</p>}
    {draft.reviewRequired && <div className="confirm-box"><p role="alert">Este treino aguarda revisão profissional. Confira os dias, as séries, os descansos e as orientações antes de publicar para o aluno.</p><button type="button" className="secondary-button" onClick={() => setDraft(previous => ({ ...previous, reviewRequired: false }))}>Revisei o treino e quero liberar a publicação</button></div>}
    <label>Nome do treino<input value={title} onChange={event => { setTitle(event.target.value); setConfirmPublish(false) }} maxLength={160} required /></label>
    <details className="workout-guidance-editor"><summary>Orientações gerais <span>{draft.guidance ? 'Preenchidas · toque para revisar' : 'Toque para adicionar'}</span></summary>
      <label>Orientações para este aluno <span className="field-hint">Aparecem na aba Orientações do aluno após publicar</span><textarea value={draft.guidance ?? ''} onChange={event => { setDraft(previous => ({ ...previous, guidance: event.target.value })); setConfirmPublish(false) }} maxLength={4000} rows={7} /></label>
    </details>
    <details className="workout-guidance-editor"><summary>Conteúdos de apoio <span>{Object.values(draft.guides ?? {}).filter(Boolean).length ? `${Object.values(draft.guides ?? {}).filter(Boolean).length} preenchidos` : 'Opcionais · separados do treino'}</span></summary>
      <p className="field-hint">Preencha apenas os assuntos que fazem parte do atendimento deste aluno. Eles aparecerão na aba Orientações após a publicação; campos vazios ficam ocultos.</p>
      {workoutGuideSections.map(section => <label key={section.key}>{section.title}<span className="field-hint">{section.hint}</span><textarea rows={3} maxLength={3000} value={draft.guides?.[section.key] ?? ''} onChange={event => { const value = event.target.value; setDraft(previous => ({ ...previous, guides: { ...previous.guides, [section.key]: value } })); setConfirmPublish(false) }} /></label>)}
    </details>
    <div className="workout-cycle-editor"><h4>Período deste treino</h4><p>Defina quando começa e por quantas semanas a sequência de dias se repete. Os dois campos são necessários para publicar.</p><div className="form-grid"><label>Início do ciclo<input type="date" value={draft.startsOn ?? ''} onChange={event => { setDraft(previous => ({ ...previous, startsOn: event.target.value })); setConfirmPublish(false) }} /></label><label>Duração (semanas)<input type="number" min="1" max="52" value={draft.durationWeeks ?? ''} onChange={event => { setDraft(previous => ({ ...previous, durationWeeks: event.target.value ? Number(event.target.value) : undefined })); setConfirmPublish(false) }} /></label></div><label>Orientação essencial antes de começar <span className="field-hint">Aparece em destaque para o aluno; opcional</span><textarea rows={3} maxLength={500} value={draft.importantNote ?? ''} onChange={event => { setDraft(previous => ({ ...previous, importantNote: event.target.value })); setConfirmPublish(false) }} placeholder="Ex.: atenção à orientação combinada antes de iniciar" /></label></div>
    <div className="workout-day-overview"><div><span className="eyebrow">Divisão do treino</span><h4>{draft.days.length} {draft.days.length === 1 ? 'dia' : 'dias'} · {draft.days.reduce((total, day) => total + day.items.length, 0)} exercícios</h4><p>Escolha um dia para conferir ou editar seus exercícios. A publicação inclui todos os dias.</p></div>
      <button type="button" className="secondary-button" disabled={draft.days.length >= 7} onClick={() => { setActiveDayIndex(draft.days.length); setExpandedItemId(null); setDraft(value => ({ ...value, days: [...value.days, { id: crypto.randomUUID(), name: `Treino ${String.fromCharCode(65 + value.days.length)}`, items: [] }] })); setConfirmPublish(false) }}>Adicionar dia</button></div>
    <div className="workout-day-tabs" aria-label="Dias do treino">{draft.days.map((day, index) => <button type="button" key={day.id} aria-pressed={activeDayIndex === index} className={activeDayIndex === index ? 'is-active' : ''} onClick={() => selectDay(index)}><span>Dia {index + 1}</span><strong>{day.name}</strong><small>{day.items.length} {day.items.length === 1 ? 'exercício' : 'exercícios'}</small></button>)}</div>
    {activeDay && <div className="workout-day workout-day-editor" aria-label={`Exercícios do dia ${activeDayIndex + 1}`}><div className="workout-order-controls"><span>Ordem de apresentação ao aluno: dia {activeDayIndex + 1} de {draft.days.length}</span><button type="button" className="secondary-button" disabled={activeDayIndex === 0} onClick={() => moveDay(-1)}>Mover antes</button><button type="button" className="secondary-button" disabled={activeDayIndex === draft.days.length - 1} onClick={() => moveDay(1)}>Mover depois</button></div><div className="section-heading"><label>Nome do dia {activeDayIndex + 1}<input value={activeDay.name} onChange={event => updateDay(activeDay.id, value => ({ ...value, name: event.target.value }))} maxLength={80} /></label>
      {draft.days.length > 1 && <button type="button" className="text-button danger-button" onClick={() => { if (activeDay.items.length && !window.confirm(`Remover ${activeDay.name} e seus ${activeDay.items.length} exercícios do rascunho?`)) return; setDraft(value => ({ ...value, days: value.days.filter(item => item.id !== activeDay.id) })); setActiveDayIndex(index => Math.max(0, Math.min(index, draft.days.length - 2))); setExpandedItemId(null); setConfirmPublish(false) }}>Remover dia</button>}</div>
      <p className="workout-day-intro">{activeDay.items.length ? `${activeDay.items.length} exercícios neste dia. Abra um exercício para ver e alterar os detalhes.` : 'Este dia ainda não tem exercícios.'}</p>
      <div className="workout-exercise-list">{activeDay.items.map((item, index) => { const expanded = expandedItemId === item.id; const exerciseName = exercises.find(exercise => exercise.id === item.exerciseId)?.name ?? 'Exercício indisponível'; const cardio = item.recordingStyle === 'CARDIO'; const preparation = item.recordingStyle === 'PREPARATION' || (!item.recordingStyle && /^alongamento\b/i.test(exerciseName))
        return <div className={`workout-exercise-card${expanded ? ' is-open' : ''}`} key={item.id}><div className="workout-exercise-summary"><span className="workout-exercise-position">{index + 1}</span><div><strong>{exerciseName}</strong><p>{cardio ? `Cardio · ${item.cardioMinutes ?? 20} min` : preparation ? `Marcar como feito · ${item.sets} ${item.sets === 1 ? 'etapa' : 'etapas'} · ${item.reps}` : `${item.sets} ${item.sets === 1 ? 'série' : 'séries'} · ${item.reps}`}{!cardio && item.restSeconds != null ? ` · ${item.restSeconds} s de descanso` : ''}</p></div><button type="button" className="secondary-button" aria-expanded={expanded} aria-controls={`workout-item-${item.id}`} onClick={() => setExpandedItemId(expanded ? null : item.id)}>{expanded ? 'Fechar' : 'Editar'}</button></div>
          {expanded && <div className="workout-item-row" id={`workout-item-${item.id}`}>
            <label>Exercício principal<select value={item.exerciseId} onChange={event => { const selected = exercises.find(exercise => exercise.id === event.target.value); updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, exerciseId: event.target.value, alternativeExerciseIds: current.alternativeExerciseIds?.filter(id => id !== event.target.value), ...(selected?.muscle_group === 'CARDIO' ? { recordingStyle: 'CARDIO' as const, targetKind: 'TIME' as const, sets: 1, reps: '20 min', cardioMinutes: 20, restSeconds: 0, setLabels: undefined, loadHintKg: undefined, rirHint: undefined } : current.recordingStyle === 'CARDIO' ? { recordingStyle: 'SERIES' as const, targetKind: 'REPS' as const, sets: 3, reps: '8–12', cardioMinutes: undefined } : {}) } : current) })) }}>{exerciseGroups.map(group => { const rows = exercises.filter(exercise => exercise.muscle_group === group.id); return rows.length ? <optgroup key={group.id} label={group.label}>{rows.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</optgroup> : null })}</select></label>
            <div className="workout-alternatives"><strong>Alternativas para este aluno</strong><p>O aluno poderá escolher uma destas opções apenas na execução do dia. O exercício principal continuará na prescrição.</p>{(item.alternativeExerciseIds ?? []).map(id => <div key={id} className="workout-alternative-chip"><span>{exercises.find(exercise => exercise.id === id)?.name ?? 'Exercício indisponível'}</span><button type="button" className="text-button" onClick={() => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, alternativeExerciseIds: (current.alternativeExerciseIds ?? []).filter(other => other !== id) } : current) }))}>Remover</button></div>)}{(item.alternativeExerciseIds?.length ?? 0) < 5 && <label>Adicionar alternativa<select value="" onChange={event => { const id = event.target.value; if (!id) return; updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, alternativeExerciseIds: [...(current.alternativeExerciseIds ?? []), id] } : current) })) }}><option value="">Escolha um exercício</option>{exerciseGroups.map(group => { const rows = exercises.filter(exercise => exercise.muscle_group === group.id && exercise.id !== item.exerciseId && !(item.alternativeExerciseIds ?? []).includes(exercise.id)); return rows.length ? <optgroup key={group.id} label={group.label}>{rows.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</optgroup> : null })}</select></label>}</div>
            {!cardio && <label>Como registrar<select value={preparation ? 'PREPARATION' : 'SERIES'} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, recordingStyle: event.target.value as 'SERIES' | 'PREPARATION', loadHintKg: event.target.value === 'PREPARATION' ? undefined : current.loadHintKg, rirHint: event.target.value === 'PREPARATION' ? undefined : current.rirHint } : current) }))}><option value="SERIES">Séries com dados de execução</option><option value="PREPARATION">Só marcar como feito, sem carga</option></select></label>}
            {cardio ? <><label>Duração prevista (minutos)<input type="number" min="1" max="240" value={item.cardioMinutes ?? 20} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, cardioMinutes: Number(event.target.value), reps: `${event.target.value} min` } : current) }))} /></label>
              <div className="cardio-steps-editor"><strong>Etapas do cardio</strong><p className="field-hint">Opcional. Se preencher, cubra toda a duração em intervalos contínuos. O aluno verá a programação ao abrir o cardio.</p>
                {(item.cardioSteps ?? []).map((step, stepIndex) => <div key={stepIndex} className="cardio-step-row"><span>{stepIndex + 1}ª etapa</span>
                  <label>De (min)<input type="number" min="0" max="239" value={step.startMinute} onChange={event => updateDay(activeDay.id, day => ({ ...day, items: day.items.map(current => current.id === item.id ? { ...current, cardioSteps: current.cardioSteps?.map((row, index) => index === stepIndex ? { ...row, startMinute: Number(event.target.value) } : row) } : current) }))} /></label>
                  <label>Até (min)<input type="number" min="1" max="240" value={step.endMinute} onChange={event => updateDay(activeDay.id, day => ({ ...day, items: day.items.map(current => current.id === item.id ? { ...current, cardioSteps: current.cardioSteps?.map((row, index) => index === stepIndex ? { ...row, endMinute: Number(event.target.value) } : row) } : current) }))} /></label>
                  <label>Inclinação (%)<input type="number" min="0" max="30" step="0.1" value={step.inclinePercent} onChange={event => updateDay(activeDay.id, day => ({ ...day, items: day.items.map(current => current.id === item.id ? { ...current, cardioSteps: current.cardioSteps?.map((row, index) => index === stepIndex ? { ...row, inclinePercent: Number(event.target.value) } : row) } : current) }))} /></label>
                  <label>Velocidade (km/h)<input type="number" min="0.1" max="30" step="0.1" value={step.speedKmh} onChange={event => updateDay(activeDay.id, day => ({ ...day, items: day.items.map(current => current.id === item.id ? { ...current, cardioSteps: current.cardioSteps?.map((row, index) => index === stepIndex ? { ...row, speedKmh: Number(event.target.value) } : row) } : current) }))} /></label>
                  <button type="button" className="text-button" onClick={() => updateDay(activeDay.id, day => ({ ...day, items: day.items.map(current => current.id === item.id ? { ...current, cardioSteps: current.cardioSteps?.filter((_, index) => index !== stepIndex) } : current) }))}>Remover etapa</button></div>)}
                <button type="button" className="secondary-button" disabled={(item.cardioSteps?.length ?? 0) >= 24} onClick={() => updateDay(activeDay.id, day => ({ ...day, items: day.items.map(current => current.id === item.id ? { ...current, cardioSteps: [...(current.cardioSteps ?? []), { startMinute: current.cardioSteps?.at(-1)?.endMinute ?? 0, endMinute: Math.min((current.cardioSteps?.at(-1)?.endMinute ?? 0) + 5, current.cardioMinutes ?? 20), inclinePercent: current.cardioSteps?.at(-1)?.inclinePercent ?? 0, speedKmh: current.cardioSteps?.at(-1)?.speedKmh ?? 4 }] } : current) }))}>Adicionar etapa</button>
              </div></> : <>
              <label>{preparation ? 'Etapas previstas' : 'Séries'}<input type="number" min="1" max="12" value={item.sets} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, sets: Number(event.target.value), setLabels: undefined } : current) }))} /></label>
              <label>{preparation ? 'Meta ou duração' : 'Repetições alvo'}<input value={item.reps} maxLength={40} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, reps: event.target.value } : current) }))} /></label>
              {!preparation && <label>Como o aluno registra<select value={item.targetKind ?? (/\b(seg|segundos?|s)\b/i.test(item.reps) ? 'TIME' : 'REPS')} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, targetKind: event.target.value as 'REPS' | 'TIME' } : current) }))}><option value="REPS">Repetições</option><option value="TIME">Tempo em segundos</option></select></label>}
              <label>Descanso (segundos)<input type="number" min="0" max="600" value={item.restSeconds ?? ''} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, restSeconds: event.target.value === '' ? undefined : Number(event.target.value) } : current) }))} /></label>
            </>}
            {!preparation && !cardio && <><label>Carga de referência (kg) <span className="field-hint">Opcional; não preenche o registro do aluno</span><input type="number" min="0" max="9999" step="0.01" value={item.loadHintKg ?? ''} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, loadHintKg: event.target.value === '' ? undefined : Number(event.target.value) } : current) }))} /></label><label>Repetições que sobrariam (alvo) <span className="field-hint">Opcional; ex.: 2 a 3</span><input maxLength={30} value={item.rirHint ?? ''} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, rirHint: event.target.value } : current) }))} /></label></>}
            {!cardio && !preparation && <label>Tipo e alvo de cada série <span className="field-hint">Uma linha por série</span><textarea value={(item.setLabels ?? []).join('\n')} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, setLabels: event.target.value ? event.target.value.split('\n') : undefined } : current) }))} rows={Math.min(item.sets, 5)} placeholder={'Aquecimento · 10 repetições\nVálida 1 · 8 a 12 repetições'} /></label>}
            <label>Orientação específica para este aluno<textarea value={item.notes ?? ''} onChange={event => updateDay(activeDay.id, value => ({ ...value, items: value.items.map(current => current.id === item.id ? { ...current, notes: event.target.value } : current) }))} maxLength={1000} rows={2} /></label>
            <div className="workout-order-controls"><span>Ordem do exercício: {index + 1} de {activeDay.items.length}</span><button type="button" className="secondary-button" disabled={index === 0} onClick={() => moveExercise(activeDay.id, index, -1)}>Subir exercício</button><button type="button" className="secondary-button" disabled={index === activeDay.items.length - 1} onClick={() => moveExercise(activeDay.id, index, 1)}>Descer exercício</button></div>
            <button type="button" className="text-button danger-button" onClick={() => { updateDay(activeDay.id, value => ({ ...value, items: value.items.filter(current => current.id !== item.id) })); setExpandedItemId(null) }}>Remover exercício</button>
          </div>}</div> })}</div>
      <button type="button" className="secondary-button" disabled={!exercises.some(exercise => exercise.muscle_group !== 'CARDIO') || activeDay.items.length >= 30} onClick={() => { const exercise = exercises.find(row => row.muscle_group !== 'CARDIO'); if (!exercise) return; const id = crypto.randomUUID(); updateDay(activeDay.id, value => ({ ...value, items: [...value.items, { id, exerciseId: exercise.id, sets: 3, reps: '8–12' }] })); setExpandedItemId(id) }}>Adicionar exercício</button>
      {exercises.some(exercise => exercise.muscle_group === 'CARDIO') ? <button type="button" className="secondary-button" disabled={activeDay.items.length >= 30} onClick={() => { const cardioExercise = exercises.find(exercise => exercise.muscle_group === 'CARDIO'); if (!cardioExercise) return; const id = crypto.randomUUID(); updateDay(activeDay.id, value => ({ ...value, items: [...value.items, { id, exerciseId: cardioExercise.id, sets: 1, reps: '20 min', cardioMinutes: 20, targetKind: 'TIME', recordingStyle: 'CARDIO', restSeconds: 0 }] })); setExpandedItemId(id) }}>Adicionar cardio</button> : <p className="field-hint">Para prescrever cardio, cadastre primeiro uma atividade no grupo <a href="/app/exercicios">Cardio da sua biblioteca</a>.</p>}
      {draft.days.length > 1 && <div className="workout-day-pager"><button type="button" className="secondary-button" disabled={activeDayIndex === 0} onClick={() => selectDay(activeDayIndex - 1)}>← Dia anterior</button><span>Dia {activeDayIndex + 1} de {draft.days.length}</span><button type="button" className="secondary-button" disabled={activeDayIndex === draft.days.length - 1} onClick={() => selectDay(activeDayIndex + 1)}>Próximo dia →</button></div>}
    </div>}
    {!exercises.length && <p>Cadastre primeiro um exercício na <a href="/app/exercicios">sua biblioteca</a>.</p>}
    <div className="form-actions"><button type="button" disabled={saving || !title.trim()} onClick={() => void save(false)}>{saving ? 'Salvando…' : 'Salvar rascunho'}</button>
      <button type="button" disabled={saving || !active || draft.reviewRequired || !draft.startsOn || !Number.isInteger(draft.durationWeeks) || (draft.durationWeeks ?? 0) < 1 || (draft.durationWeeks ?? 0) > 52 || !draft.days.every(day => day.items.length > 0)} onClick={() => setConfirmPublish(true)}>Publicar para aluno</button></div>
    {confirmPublish && <div className="confirm-box"><p><strong>Publicar os {draft.days.length} {draft.days.length === 1 ? 'dia' : 'dias'} deste treino?</strong> O ciclo começa em {draft.startsOn?.split('-').reverse().join('/')} e dura {draft.durationWeeks} semanas. Sessões já iniciadas permanecerão vinculadas à versão anterior.</p><p>Confira as orientações, séries e descansos. Vídeos são opcionais; exercícios sem vídeo continuam disponíveis ao aluno.</p><div className="form-actions"><button type="button" disabled={saving} onClick={() => void save(true)}>Confirmar publicação</button><button type="button" className="secondary-button" onClick={() => setConfirmPublish(false)}>Cancelar</button></div></div>}
    <div className="workout-history"><h4>Acompanhamento</h4>{sessions.length ? <><p>{sessions.filter(session => session.status === 'COMPLETED').length} treino(s) concluído(s) entre os {sessions.length} últimos registros.</p>{sessions.some(session => Object.keys(session.exercise_issues ?? {}).length) && <div className="feedback"><strong>Aparelhos indisponíveis informados pelo aluno</strong><ul>{sessions.filter(session => Object.keys(session.exercise_issues ?? {}).length).slice(0, 10).flatMap(session => Object.keys(session.exercise_issues ?? {}).map(itemId => <li key={`${session.id}:${itemId}`}>{new Date(session.client_started_at ?? session.started_at).toLocaleDateString('pt-BR')} · {current?.snapshot.days.flatMap(day => day.items).find(item => item.id === itemId)?.name ?? 'Exercício da versão anterior'}{session.status === 'IN_PROGRESS' || session.status === 'PAUSED' ? ' · treino em andamento' : ''}</li>))}</ul></div>}</> : <p>O aluno ainda não sincronizou nenhuma execução.</p>}</div>
  </section>
}


export { WorkoutPlayer } from './WorkoutPlayer'
