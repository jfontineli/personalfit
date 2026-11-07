import { useEffect, useState, type FormEvent } from 'react'
import { assignSelfNutrition, inviteNutritionist, nutritionDraft, nutritionMealDay, nutritionStatus, nutritionStudents, publishNutrition, saveNutritionDraft, studentNutrition, syncNutritionMeal, type Meal, type MealState, type NutritionDraft, type NutritionIndividualNote, type NutritionStatus, type NutritionStudent, type PublishedNutrition } from '../services/nutrition'
import { cacheNutritionPlan, cachedNutritionPlan, confirmNutritionMeal, failNutritionMeal, localNutritionMeals, pendingNutritionMeals, queueNutritionMeal } from '../offline/nutritionStore'

const emptyDraft = (): NutritionDraft => ({ title: '', guidance: '', meals: [] })
const failureText = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'

export function NutritionReferral({ studentId, studentName, tenantId, active }: { studentId: string; studentName: string; tenantId: string; active: boolean }) {
  const [status, setStatus] = useState<NutritionStatus>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [invite, setInvite] = useState<{ link: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selfMode, setSelfMode] = useState(false)
  const [crn, setCrn] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  useEffect(() => { let live = true; void nutritionStatus(studentId).then(value => { if (live) setStatus(value) }).catch(e => { if (live) setError(failureText(e)) }); return () => { live = false } }, [studentId])
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try { setInvite(await inviteNutritionist(studentId, email, name)); setCopied(false) }
    catch (e) { setError(failureText(e)) }
    finally { setBusy(false) }
  }
  async function assignSelf(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try { await assignSelfNutrition(studentId, crn); setStatus(await nutritionStatus(studentId)); setShowEditor(true) }
    catch (e) { setError(failureText(e)) }
    finally { setBusy(false) }
  }
  return <section className="nutrition-section" aria-labelledby="nutrition-referral-title">
    <div className="section-heading"><div><span className="eyebrow">Alimentação</span><h3 id="nutrition-referral-title">Acompanhamento nutricional</h3><p>Defina quem fará a prescrição alimentar para {studentName}.</p></div></div>
    {status.name ? <><div className="nutrition-status"><strong>{status.name}{status.is_self ? ' · você' : ''}</strong><span>CRN informado: {status.crn}</span><span>{status.version ? `Plano publicado · versão ${status.version}` : 'Plano ainda não publicado'}</span></div>{status.is_self && <><button type="button" onClick={() => setShowEditor(value => !value)}>{showEditor ? 'Fechar editor' : 'Editar plano alimentar'}</button>{showEditor && <NutritionistArea tenantId={tenantId} studentId={studentId} onPublished={() => void nutritionStatus(studentId).then(setStatus).catch(e => setError(failureText(e)))} />}</>}</> : <>
      <p>Este aluno ainda não tem nutricionista vinculado.</p>
      {active && <><div className="nutrition-choice" role="group" aria-label="Quem fará a prescrição"><button type="button" className={!selfMode ? 'secondary-button active' : 'secondary-button'} aria-pressed={!selfMode} onClick={() => setSelfMode(false)}>Nutricionista parceiro</button><button type="button" className={selfMode ? 'secondary-button active' : 'secondary-button'} aria-pressed={selfMode} onClick={() => setSelfMode(true)}>Sou nutricionista</button></div>
      {selfMode ? <form onSubmit={event => void assignSelf(event)}><p>Use sua conta atual para prescrever a alimentação deste aluno. O vínculo será individual.</p><label>Seu registro CRN<input value={crn} onChange={event => setCrn(event.target.value)} required minLength={3} maxLength={40} placeholder="Número e região do CRN" /></label><p className="field-hint">O registro informado precisa de conferência humana antes de atendimento real.</p><button disabled={busy}>{busy ? 'Vinculando…' : 'Assumir acompanhamento nutricional'}</button></form> : <form onSubmit={event => void submit(event)}><div className="form-grid"><label>Nome do nutricionista<input value={name} onChange={e => setName(e.target.value)} required maxLength={160} /></label><label>E-mail do nutricionista<input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={320} /></label></div><button disabled={busy}>{busy ? 'Gerando convite…' : 'Convidar nutricionista'}</button></form>}</>}
    </>}
    {invite && <div className="student-invite"><strong>Convite pronto</strong><p>Válido até {new Date(invite.expiresAt).toLocaleString('pt-BR')}. O link não será recuperado depois de sair desta página.</p><input aria-label="Link do convite do nutricionista" readOnly value={invite.link} onFocus={e => e.currentTarget.select()} /><button type="button" onClick={() => void navigator.clipboard.writeText(invite.link).then(() => setCopied(true)).catch(() => setError('Selecione e copie o link manualmente.'))}>{copied ? 'Link copiado' : 'Copiar convite'}</button></div>}
    {error && <p role="alert" className="feedback error">{error}</p>}
  </section>
}

export function NutritionistArea({ tenantId, studentId, onPublished }: { tenantId: string; studentId?: string; onPublished?: () => void }) {
  const [students, setStudents] = useState<NutritionStudent[]>([])
  const [selected, setSelected] = useState('')
  const [draft, setDraft] = useState<NutritionDraft>(emptyDraft)
  const [loadingDraft, setLoadingDraft] = useState(true)
  const [saved, setSaved] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [section, setSection] = useState<'plan' | 'meals' | 'source'>('plan')
  const [mealCycle, setMealCycle] = useState<'ALTO' | 'BAIXO' | 'TODOS'>('ALTO')
  const [openMealId, setOpenMealId] = useState<string | null>(null)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  useEffect(() => { let live = true; void nutritionStudents(tenantId).then(rows => { if (live) { const visible = studentId ? rows.filter(row => row.student_id === studentId) : rows; setStudents(visible); setSelected(visible[0]?.student_id ?? '') } }).catch(e => { if (live) setError(failureText(e)) }); return () => { live = false } }, [tenantId, studentId])
  useEffect(() => { if (!selected) return; let live = true; void nutritionDraft(selected).then(value => { if (live) { setDraft(value ?? emptyDraft()); setSaved(true); setSection('plan'); setOpenMealId(null); setMealCycle('ALTO'); setReviewConfirmed(false) } }).catch(e => { if (live) setError(failureText(e)) }).finally(() => { if (live) setLoadingDraft(false) }); return () => { live = false } }, [selected])
  function change(value: NutritionDraft, confirmsReview = false) {
    const next = draft.sourceImport && !draft.sourceImport.reviewRequired && !confirmsReview
      ? { ...value, sourceImport: { ...draft.sourceImport, reviewRequired: true } }
      : value
    setDraft(next); setSaved(false); setMessage('')
  }
  function mealChange(index: number, value: Meal) { change({ ...draft, meals: draft.meals.map((meal, i) => i === index ? value : meal) }) }
  async function save() {
    if (!selected) return false
    setBusy(true); setError(''); setMessage('')
    try { await saveNutritionDraft(selected, draft); setSaved(true); setMessage('Rascunho salvo. O aluno ainda vê somente a última versão publicada.'); return true }
    catch (e) { setError(failureText(e)); return false }
    finally { setBusy(false) }
  }
  async function publish() {
    if (draft.sourceImport?.reviewRequired) { setError('Revise a transcrição da dieta original antes de publicar.'); return }
    if (!selected || !window.confirm('Publicar este plano alimentar para o aluno? A versão publicada ficará preservada no histórico.')) return
    if (!saved && !(await save())) return
    setBusy(true); setError('')
    try { const version = await publishNutrition(selected); setMessage(`Plano publicado · versão ${version}. O aluno poderá consultá-lo ao abrir o aplicativo.`); setStudents(rows => rows.map(row => row.student_id === selected ? { ...row, latest_version: version } : row)); onPublished?.() }
    catch (e) { setError(failureText(e)) }
    finally { setBusy(false) }
  }
  const hasCycles = draft.meals.some(meal => meal.cycle === 'ALTO' || meal.cycle === 'BAIXO')
  const visibleMeals = draft.meals.map((meal, index) => ({ meal, index })).filter(({ meal }) => !hasCycles || mealCycle === 'TODOS' || meal.cycle === mealCycle || !meal.cycle)
  const individualNotes: NutritionIndividualNote[] = draft.individualNotes ?? draft.sourceImport?.rows.map((row, sourceIndex) => ({ ...row, id: `source-${sourceIndex}`, sourceIndex, showToStudent: false })) ?? []
  const sourceGroups = [
    { key: 'info', label: 'Identificação e objetivo' },
    { key: 'meta', label: 'Metas e contexto' },
    { key: 'regra', label: 'Regras gerais' },
    { key: 'supl', label: 'Suplementos e medicamentos' },
    { key: 'dica', label: 'Dicas e receitas' },
    { key: 'cardio', label: 'Atividade física' },
    { key: 'observacoes', label: 'Observações individuais' },
    { key: 'outro', label: 'Outras informações' },
  ].map(group => ({ ...group, rows: individualNotes.filter(row => row.section === group.key) })).filter(group => group.rows.length > 0)
  function updateNote(id: string, patch: Partial<NutritionIndividualNote>) {
    change({ ...draft, individualNotes: individualNotes.map(note => note.id === id ? { ...note, ...patch } : note) })
  }
  function addNote() {
    const note: NutritionIndividualNote = { id: crypto.randomUUID(), section: 'outro', item: '', quantity: '', note: '', showToStudent: false }
    change({ ...draft, individualNotes: [...individualNotes, note] })
  }
  function addMeal() {
    const meal: Meal = { id: crypto.randomUUID(), name: '', time: '', cycle: hasCycles && mealCycle !== 'TODOS' ? mealCycle : undefined, options: [{ label: 'Opção principal', foods: '', notes: '' }] }
    change({ ...draft, meals: [...draft.meals, meal] })
    setOpenMealId(meal.id)
  }
  if (loadingDraft && selected) return <section className="panel professional-panel nutrition-editor"><h2>Planos alimentares</h2><p>Carregando rascunho do aluno…</p></section>
  return <section className="panel professional-panel nutrition-editor"><div className="section-heading"><div><span className="eyebrow">Nutrição</span><h2>Planos alimentares</h2><p>Crie e publique prescrições apenas para os alunos vinculados a você.</p></div></div>
    {error && <p role="alert" className="feedback error">{error}</p>}{message && <p role="status" className="feedback success">{message}</p>}
    {students.length === 0 ? <p>Você ainda não tem alunos vinculados neste espaço.</p> : <>
      {!studentId && <label>Aluno<select value={selected} onChange={e => { if (!saved && !window.confirm('Há alterações não salvas. Trocar de aluno?')) return; setLoadingDraft(true); setSelected(e.target.value); setMessage(''); setError('') }}>{students.map(row => <option key={row.student_id} value={row.student_id}>{row.full_name}{row.latest_version ? ` · versão ${row.latest_version} publicada` : ' · sem publicação'}</option>)}</select></label>}
      <div className="nutrition-editor-summary"><div><span className="eyebrow">Plano do aluno</span><strong>{draft.title || 'Plano sem nome'}</strong><span>{draft.meals.length} refeições · {students.find(row => row.student_id === selected)?.latest_version ? `versão ${students.find(row => row.student_id === selected)?.latest_version} publicada` : 'sem publicação'}</span></div><span className={draft.sourceImport?.reviewRequired ? 'nutrition-review-badge pending' : 'nutrition-review-badge'}>{draft.sourceImport?.reviewRequired ? 'Revisão pendente' : saved ? 'Rascunho salvo' : 'Alterações não salvas'}</span></div>
      <nav className="nutrition-editor-nav" aria-label="Etapas do plano alimentar"><button type="button" aria-current={section === 'plan' ? 'page' : undefined} onClick={() => setSection('plan')}>1. Dados do plano</button><button type="button" aria-current={section === 'meals' ? 'page' : undefined} onClick={() => setSection('meals')}>2. Refeições <span>{draft.meals.length}</span></button><button type="button" aria-current={section === 'source' ? 'page' : undefined} onClick={() => setSection('source')}>3. Informações individuais {draft.sourceImport?.reviewRequired && <span className="nutrition-nav-alert">!</span>}</button></nav>
      {section === 'plan' && <div className="nutrition-editor-pane"><div className="section-heading"><div><h3>Dados do plano</h3><p>Defina o nome e as orientações que o aluno verá após a publicação.</p></div></div><div className="nutrition-editor-intro"><label>Nome do plano<input value={draft.title} onChange={e => change({ ...draft, title: e.target.value })} placeholder="Ex.: Plano alimentar inicial" maxLength={160} /></label><label>Orientações gerais<textarea value={draft.guidance} onChange={e => change({ ...draft, guidance: e.target.value })} maxLength={4000} rows={5} placeholder="Escreva apenas o que é essencial para seguir o plano." /></label></div><div className="nutrition-step-next"><button type="button" className="secondary-button" onClick={() => setSection('meals')}>Continuar para refeições</button></div></div>}
      {section === 'meals' && <div className="nutrition-editor-pane"><div className="section-heading"><div><h3>Refeições</h3><p>Abra uma refeição para conferir ou editar seus alimentos.</p></div><button type="button" className="secondary-button" disabled={draft.meals.length >= 12} onClick={addMeal}>Adicionar refeição</button></div>
        {hasCycles && <div className="nutrition-cycle-tabs" role="group" aria-label="Filtrar refeições por dia"><button type="button" aria-pressed={mealCycle === 'ALTO'} onClick={() => { setMealCycle('ALTO'); setOpenMealId(null) }}>Dia alto <span>{draft.meals.filter(meal => meal.cycle === 'ALTO').length}</span></button><button type="button" aria-pressed={mealCycle === 'BAIXO'} onClick={() => { setMealCycle('BAIXO'); setOpenMealId(null) }}>Dia baixo <span>{draft.meals.filter(meal => meal.cycle === 'BAIXO').length}</span></button><button type="button" aria-pressed={mealCycle === 'TODOS'} onClick={() => { setMealCycle('TODOS'); setOpenMealId(null) }}>Todas</button></div>}
        {draft.meals.length === 0 && <p className="empty-state">Adicione as refeições na ordem em que o aluno deve consultá-las.</p>}
        {visibleMeals.map(({ meal, index }) => <article key={meal.id} className="nutrition-meal-editor"><button type="button" className="nutrition-meal-toggle" aria-expanded={openMealId === meal.id} onClick={() => setOpenMealId(openMealId === meal.id ? null : meal.id)}><span className="nutrition-meal-order">{index + 1}</span><span className="nutrition-meal-label"><strong>{meal.name || 'Nova refeição'}</strong><small>{meal.cycle ? `Dia ${meal.cycle.toLowerCase()} · ` : 'Todos os dias · '}{meal.options.length} {meal.options.length === 1 ? 'opção' : 'opções'}{meal.time ? ` · ${meal.time}` : ''}</small></span><span aria-hidden="true">{openMealId === meal.id ? '−' : '+'}</span></button>
          {openMealId === meal.id && <div className="nutrition-meal-body"><div className="form-grid"><label>Nome da refeição<input value={meal.name} onChange={e => mealChange(index, { ...meal, name: e.target.value })} maxLength={100} placeholder="Ex.: Café da manhã" /></label><label>Horário sugerido (opcional)<input value={meal.time} onChange={e => mealChange(index, { ...meal, time: e.target.value })} maxLength={20} placeholder="Ex.: 07:00" /></label><label>Dia do ciclo<select value={meal.cycle ?? ''} onChange={e => mealChange(index, { ...meal, cycle: e.target.value === 'ALTO' || e.target.value === 'BAIXO' ? e.target.value : undefined })}><option value="">Todos os dias</option><option value="ALTO">Dia alto</option><option value="BAIXO">Dia baixo</option></select></label></div>
          {meal.options.map((option, optionIndex) => <div key={optionIndex} className="nutrition-option"><div className="section-heading"><strong>Opção {optionIndex + 1}</strong>{meal.options.length > 1 && <button type="button" className="text-button" onClick={() => mealChange(index, { ...meal, options: meal.options.filter((_, i) => i !== optionIndex) })}>Remover opção</button>}</div><label>Nome da opção<input value={option.label} maxLength={100} onChange={e => mealChange(index, { ...meal, options: meal.options.map((item, i) => i === optionIndex ? { ...item, label: e.target.value } : item) })} /></label><label>Alimentos e quantidades<textarea value={option.foods} maxLength={2000} rows={3} placeholder="Informe alimentos, quantidades e unidades com clareza." onChange={e => mealChange(index, { ...meal, options: meal.options.map((item, i) => i === optionIndex ? { ...item, foods: e.target.value } : item) })} /></label><label>Observação específica (opcional)<textarea value={option.notes} maxLength={1000} rows={2} onChange={e => mealChange(index, { ...meal, options: meal.options.map((item, i) => i === optionIndex ? { ...item, notes: e.target.value } : item) })} /></label></div>)}
          <div className="nutrition-meal-footer"><button type="button" className="secondary-button" disabled={meal.options.length >= 8} onClick={() => mealChange(index, { ...meal, options: [...meal.options, { label: `Opção ${meal.options.length + 1}`, foods: '', notes: '' }] })}>Adicionar opção</button><button type="button" className="text-button danger-button" onClick={() => { if (!window.confirm(`Remover a refeição "${meal.name || 'Nova refeição'}" do rascunho?`)) return; change({ ...draft, meals: draft.meals.filter(item => item.id !== meal.id) }); setOpenMealId(null) }}>Remover refeição</button></div></div>}
        </article>)}
        <div className="nutrition-step-next"><button type="button" className="secondary-button" onClick={() => setSection('source')}>Continuar para informações individuais</button></div>
      </div>}
      {section === 'source' && <div className="nutrition-editor-pane"><div className="section-heading"><div><h3>Informações individuais</h3><p>Adapte cada informação para este aluno. Escolha quais orientações ele verá no plano publicado.</p></div><button type="button" className="secondary-button" disabled={individualNotes.length >= 80} onClick={addNote}>Adicionar informação</button></div>
        {draft.sourceImport && <div className="nutrition-import-warning"><strong>{draft.sourceImport.reviewRequired ? 'Revisão clínica pendente' : 'Informações revisadas'}</strong><p>Revise quantidades, medicamentos, suplementos, exames e datas antes de escolher o que será mostrado ao aluno. A publicação apresenta o conteúdo como prescrição do profissional responsável.</p></div>}
        {individualNotes.length === 0 && <p className="empty-state">Nenhuma informação individual cadastrada. Adicione apenas o que fizer parte da prescrição deste aluno.</p>}
        <div className="nutrition-source-groups">{sourceGroups.map(group => <details key={group.key}><summary><span>{group.label}</span><small>{group.rows.length} {group.rows.length === 1 ? 'item' : 'itens'}</small></summary><div>{group.rows.map(row => <details key={row.id} className="nutrition-source-item"><summary><span>{row.item || 'Nova informação'}</span><small>{row.showToStudent ? 'Visível ao aluno' : 'Só no rascunho'}</small></summary><div className="nutrition-source-fields"><label>Assunto<input value={row.item} maxLength={160} onChange={e => updateNote(row.id, { item: e.target.value })} /></label><label>Quantidade ou meta<input value={row.quantity} maxLength={200} onChange={e => updateNote(row.id, { quantity: e.target.value })} /></label><label>Orientação<textarea value={row.note} maxLength={2000} rows={3} onChange={e => updateNote(row.id, { note: e.target.value })} /></label><label>Categoria<select value={row.section} onChange={e => updateNote(row.id, { section: e.target.value })}><option value="info">Identificação e objetivo</option><option value="meta">Metas e contexto</option><option value="regra">Regras gerais</option><option value="supl">Suplementos e medicamentos</option><option value="dica">Dicas e receitas</option><option value="cardio">Atividade física</option><option value="observacoes">Observações individuais</option><option value="outro">Outras informações</option></select></label><label className="check-row"><input type="checkbox" checked={row.showToStudent} onChange={e => updateNote(row.id, { showToStudent: e.target.checked })} />Mostrar esta informação ao aluno após publicar</label><button type="button" className="text-button danger-button" onClick={() => { if (!window.confirm(`Remover "${row.item || 'esta informação'}" do rascunho individual?`)) return; change({ ...draft, individualNotes: individualNotes.filter(item => item.id !== row.id) }) }}>Remover informação</button></div></details>)}</div></details>)}</div>
        {draft.sourceImport?.reviewRequired && <div className="nutrition-review-action"><label className="check-row"><input type="checkbox" checked={reviewConfirmed} onChange={e => setReviewConfirmed(e.target.checked)} />Conferi as informações individuais, as quantidades e o conteúdo clínico desta dieta.</label><button type="button" disabled={!reviewConfirmed} onClick={() => { change({ ...draft, individualNotes, sourceImport: { ...draft.sourceImport!, reviewRequired: false } }, true); setMessage('Revisão marcada no rascunho. Salve o plano antes de publicar.'); setReviewConfirmed(false) }}>Confirmar revisão clínica</button></div>}
      </div>}
      <div className="form-actions"><button type="button" disabled={busy || saved} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar rascunho'}</button><button type="button" className="secondary-button" disabled={busy || !!draft.sourceImport?.reviewRequired || !draft.title.trim() || draft.meals.length === 0} onClick={() => void publish()}>Publicar para o aluno</button></div>
      <p className="field-hint">Revise quantidades e alternativas antes de publicar. Seu registro profissional deve ser validado antes de usar esta área em atendimento real.</p>
    </>}
  </section>
}

export function StudentNutrition({ studentId, tenantId, userId }: { studentId: string; tenantId: string; userId: string }) {
  const [plan, setPlan] = useState<PublishedNutrition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [records, setRecords] = useState<Record<string, { state: MealState; pending: boolean }>>({})
  const [syncError, setSyncError] = useState('')
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const cycleKey = `personalfit:nutrition-cycle:${userId}:${studentId}:${day}`
  const [cycle, setCycle] = useState<'ALTO' | 'BAIXO' | ''>(() => {
    const saved = localStorage.getItem(`personalfit:nutrition-cycle:${userId}:${studentId}:${day}`)
    return saved === 'ALTO' || saved === 'BAIXO' ? saved : ''
  })
  useEffect(() => {
    let live = true
    void cachedNutritionPlan(userId, tenantId, studentId).then(value => { if (live && value) setPlan(value) }).catch(() => {})
    void studentNutrition(studentId).then(async value => { if (live) setPlan(value); if (value) await cacheNutritionPlan(userId, tenantId, studentId, value) })
      .catch(async e => { if (live && !await cachedNutritionPlan(userId, tenantId, studentId)) setError(navigator.onLine ? failureText(e) : 'Abra o plano uma vez com internet para consultá-lo offline.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [studentId, tenantId, userId])
  useEffect(() => {
    if (!plan) return
    let live = true
    void localNutritionMeals(userId, tenantId, studentId, plan.id, day).then(rows => { if (live) setRecords(Object.fromEntries(rows.map(row => [row.mealId, { state: row.state, pending: row.pending }]))) }).catch(e => { if (live) setSyncError(failureText(e)) })
    if (navigator.onLine) void nutritionMealDay(studentId, plan.id, day).then(rows => { if (live) setRecords(previous => ({ ...Object.fromEntries(rows.map(row => [row.meal_id, { state: row.state, pending: false }])), ...Object.fromEntries(Object.entries(previous).filter(([,value]) => value.pending)) })) }).catch(() => {})
    return () => { live = false }
  }, [plan, studentId, tenantId, userId, day])
  useEffect(() => {
    async function flush() {
      if (!navigator.onLine) return
      const pending = await pendingNutritionMeals(userId, tenantId)
      for (const operation of pending) {
        try { await syncNutritionMeal(operation.operationId, operation.studentId, operation.versionId, operation.mealId, operation.day, operation.state); await confirmNutritionMeal(operation); setRecords(previous => previous[operation.mealId]?.state === operation.state ? { ...previous, [operation.mealId]: { state: operation.state, pending: false } } : previous); setSyncError('') }
        catch (e) { await failNutritionMeal(operation, failureText(e)); setSyncError('Há um lançamento que precisa de atenção. Tente novamente quando estiver conectado.'); break }
      }
    }
    void flush().catch(e => setSyncError(failureText(e)))
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [studentId, tenantId, userId])
  async function mark(mealId: string, state: MealState) {
    if (!plan) return
    setError(''); setSyncError('')
    try {
      await queueNutritionMeal(userId, tenantId, studentId, plan.id, day, mealId, state)
      setRecords(previous => ({ ...previous, [mealId]: { state, pending: true } }))
      if (navigator.onLine) {
        const pending = await pendingNutritionMeals(userId, tenantId)
        for (const operation of pending) {
          try { await syncNutritionMeal(operation.operationId, operation.studentId, operation.versionId, operation.mealId, operation.day, operation.state); await confirmNutritionMeal(operation); setRecords(previous => previous[operation.mealId]?.state === operation.state ? { ...previous, [operation.mealId]: { state: operation.state, pending: false } } : previous) }
          catch (e) { await failNutritionMeal(operation, failureText(e)); setSyncError('Lançamento salvo neste aparelho. A confirmação no servidor está pendente.'); break }
        }
      }
    } catch (e) { setError(failureText(e)) }
  }
  const hasCycles = !!plan?.snapshot.meals.some(meal => meal.cycle === 'ALTO' || meal.cycle === 'BAIXO')
  const visibleMeals = plan?.snapshot.meals.filter(meal => !hasCycles || (!!cycle && (!meal.cycle || meal.cycle === cycle))) ?? []
  function chooseCycle(value: 'ALTO' | 'BAIXO') { localStorage.setItem(cycleKey, value); setCycle(value) }
  return <section className="student-nutrition" aria-labelledby="student-nutrition-title"><div className="section-heading"><div><span className="eyebrow">Alimentação</span><h2 id="student-nutrition-title">Meu plano alimentar</h2></div></div>
    {loading && !plan ? <p>Carregando plano…</p> : error ? <p role="alert">{error}</p> : !plan ? <p>Seu nutricionista ainda não publicou um plano alimentar.</p> : <>
      <div className="nutrition-student-intro"><strong>{plan.snapshot.title}</strong><span>Por {plan.nutritionist_name} · versão {plan.version}</span></div>
      {plan.snapshot.guidance && <details className="nutrition-guidance"><summary>Orientações do nutricionista</summary><p>{plan.snapshot.guidance}</p></details>}
      {!!plan.snapshot.individualNotes?.length && <details className="nutrition-student-notes"><summary>Orientações para você <span>{plan.snapshot.individualNotes.length} itens</span></summary><div className="nutrition-student-note-list">{plan.snapshot.individualNotes.map(note => <details key={note.id}><summary><strong>{note.item}</strong>{note.quantity && <span>{note.quantity}</span>}</summary>{note.note && <p>{note.note}</p>}</details>)}</div></details>}
      {hasCycles && <div className="nutrition-cycle"><h3>Qual é o dia do seu ciclo hoje?</h3><p>O plano alterna dia alto e dia baixo. Confira a sequência indicada pelo nutricionista antes de escolher.</p><div className="form-actions"><button type="button" className={cycle === 'ALTO' ? '' : 'secondary-button'} aria-pressed={cycle === 'ALTO'} onClick={() => chooseCycle('ALTO')}>Dia alto</button><button type="button" className={cycle === 'BAIXO' ? '' : 'secondary-button'} aria-pressed={cycle === 'BAIXO'} onClick={() => chooseCycle('BAIXO')}>Dia baixo</button></div>{!cycle && <p>Escolha o dia para ver as refeições correspondentes.</p>}</div>}
      {syncError && <p role="status" className="feedback">{syncError}</p>}
      {!!visibleMeals.length && <div className="nutrition-meals-heading"><h3>Refeições de hoje</h3><span>{visibleMeals.filter(meal => !!records[meal.id]).length} de {visibleMeals.length} registradas</span></div>}
      <div className="nutrition-meals">{visibleMeals.map(meal => <details key={meal.id} className="nutrition-meal"><summary><span className="nutrition-meal-label"><strong>{meal.name}</strong><small>{meal.time || `${meal.options.length} ${meal.options.length === 1 ? 'opção' : 'opções'}`}</small></span><span className={records[meal.id] ? 'nutrition-meal-state done' : 'nutrition-meal-state'}>{records[meal.id] ? `${{ FEITA: 'Feita', ADAPTADA: 'Adaptada', NAO_FEITA: 'Não feita' }[records[meal.id].state]}${records[meal.id].pending ? ' · pendente' : ''}` : 'Ver refeição'}</span></summary><div className="nutrition-meal-content">{meal.options.map((option, index) => <div key={index} className="nutrition-option"><strong>{option.label}</strong><p>{option.foods}</p>{option.notes && <small>{option.notes}</small>}</div>)}<div className="nutrition-meal-action"><p role="status">{records[meal.id] ? `${{ FEITA: 'Conforme o plano', ADAPTADA: 'Fiz diferente', NAO_FEITA: 'Não fiz' }[records[meal.id].state]} · ${records[meal.id].pending ? 'salvo neste aparelho' : 'confirmado no servidor'}` : 'Como foi esta refeição hoje?'}</p><div className="form-actions"><button type="button" className="secondary-button" onClick={() => void mark(meal.id, 'FEITA')}>Fiz conforme o plano</button><button type="button" className="secondary-button" onClick={() => void mark(meal.id, 'ADAPTADA')}>Fiz diferente</button><button type="button" className="secondary-button" onClick={() => void mark(meal.id, 'NAO_FEITA')}>Não fiz</button></div></div></div></details>)}</div>
    </>}
  </section>
}
