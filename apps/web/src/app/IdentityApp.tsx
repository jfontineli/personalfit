import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { supabase } from '../services/supabase'
import { safeActivationReturn } from '../routes/routes'
import { claimInvite, claimProfessionalInvite, createInvite, createProfessionalTenantInvite, createStudent, downloadBrandLogo, getBrand, getStudent, getStudentNotes, isManagedLogoPath, isPlatformAdmin, listMemberships, listPlatformSpaces, listStudents, listTenants, removeBrandLogo, saveStudentNotes, setPlatformSpacePlan, updateBrand, updateStudent, uploadBrandLogo, type Brand, type Membership, type PlatformSpace, type Student, type StudentInput, type Tenant } from '../services/business'
import { cacheIdentityContext, cacheStudentView, clearCachedContext, getCachedContext, getCachedStudentView } from '../offline/workoutStore'
const ExerciseLibrary = lazy(() => import('../modules/Workouts').then(module => ({ default: module.ExerciseLibrary })))
const WorkoutEditor = lazy(() => import('../modules/Workouts').then(module => ({ default: module.WorkoutEditor })))
const WorkoutPlayer = lazy(() => import('../modules/Workouts').then(module => ({ default: module.WorkoutPlayer })))
const StudentServicePlanEditor = lazy(() => import('../modules/Workouts').then(module => ({ default: module.StudentServicePlanEditor })))
const StudentServicePlanSummary = lazy(() => import('../modules/Workouts').then(module => ({ default: module.StudentServicePlanSummary })))

const path = window.location.pathname
const textError = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação'
const authErrorText = (message: string) => {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (message.includes('User already registered')) return 'Já existe uma conta com este e-mail. Use a opção de entrar.'
  if (message.includes('Password should be at least')) return 'Crie uma senha com pelo menos 8 caracteres.'
  return 'Não foi possível autenticar. Verifique os dados e tente novamente.'
}
const activationErrorText = (error: unknown) => {
  const message = textError(error)
  return message.includes('invitation unavailable') ? 'Este convite não está disponível. Verifique se o link expirou, já foi usado ou se o e-mail da conta é diferente do convite.' : message
}
const contrastText = (hex: string) => {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
  const luminance = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2] > 0.38 ? '#15332e' : '#ffffff'
}

export function IdentityApp() {
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [platformAdmin, setPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    async function load() {
      try {
        const { data: { user: verifiedUser }, error: authError } = await client.auth.getUser()
        const user = !navigator.onLine && (authError || !verifiedUser)
          ? (await client.auth.getSession()).data.session?.user ?? null : verifiedUser
        if (!user) { setUserId(null); setLoading(false); return }
        setUserId(user.id)
        setEmail(user.email ?? '')
        let links: Membership[]; let tenantRows: Tenant[]; let admin: boolean
        try {
          [links, tenantRows, admin] = await Promise.all([listMemberships(), listTenants(), isPlatformAdmin()])
          await cacheIdentityContext({ userId: user.id, email: user.email ?? '', memberships: links, tenants: tenantRows })
        } catch (failure) {
          if (navigator.onLine) throw failure
          const cached = await getCachedContext(user.id)
          if (!cached) throw new Error('Abra o aplicativo conectado antes de usar o treino sem internet.', { cause: failure })
          links = cached.memberships; tenantRows = cached.tenants; admin = false
        }
        setMemberships(links)
        setTenants(tenantRows)
        setPlatformAdmin(admin)
        setTenantId(previous => links.some(link => link.tenant_id === previous) ? previous : links.length === 1 ? links[0].tenant_id : '')
      } catch (failure) { setError(textError(failure)) }
      finally { setLoading(false) }
    }
    void load()
    const { data: { subscription } } = client.auth.onAuthStateChange(() => { setTimeout(() => void load(), 0) })
    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    const { error: authError } = await supabase!.auth.signOut({ scope: 'local' })
    if (authError) setError(authError.message)
    else { if (userId) await clearCachedContext(userId); setUserId(null); setMemberships([]); window.location.replace('/login') }
  }

  if (loading) return <main className="shell"><p>Carregando sessão…</p></main>
  if (!supabase) return <main className="shell"><p>Supabase local não configurado.</p></main>
  if (path === '/ativar') return <Activation userId={userId} email={email} />
  if (path === '/ativar-profissional') return <ProfessionalActivation userId={userId} email={email} />
  if (!userId) return <Login />

  const membership = memberships.find(link => link.tenant_id === tenantId)
  const tenant = tenants.find(item => item.id === tenantId)
  const adminArea = path === '/admin' || (platformAdmin && memberships.length === 0)
  return <main className={adminArea || membership?.role === 'PROFISSIONAL' ? 'shell admin-shell' : membership?.role === 'ALUNO' ? 'shell student-shell' : 'shell'}>
    {membership?.role !== 'ALUNO' && <header><span className="eyebrow">PersonalFit</span><h1>{adminArea ? 'Administração da plataforma' : 'Área do personal'}</h1>
      <div className="header-actions"><span>Conectado como {email}</span>{platformAdmin && !adminArea && <a href="/admin">Administração da plataforma</a>}<button onClick={() => void logout()}>Sair</button></div></header>
    }
    {error && <p role="alert">{error}</p>}
    {path === '/admin' ? platformAdmin ? <PlatformAdminArea /> : <section className="panel"><h2>Acesso restrito</h2></section> : memberships.length === 0 ? platformAdmin ? <PlatformAdminArea /> : <section className="panel"><h2>Acesso restrito</h2><p>Não há acesso ativo a um espaço para esta conta. Confira a ativação do convite ou consulte o administrador.</p></section> : <>
      {memberships.length > 1 && <label>Espaço<select aria-label="Selecionar espaço" value={tenantId} onChange={event => setTenantId(event.target.value)}><option value="">Escolha um espaço</option>{memberships.map(link => <option key={link.tenant_id} value={link.tenant_id}>{tenants.find(item => item.id === link.tenant_id)?.name ?? link.tenant_id}</option>)}</select></label>}
      {!membership ? <p>Selecione um espaço para continuar.</p> : <>
        {membership.role === 'PROFISSIONAL' && <p>Espaço: <strong>{tenant?.name}</strong> · Perfil: Personal</p>}
        {membership.role === 'PROFISSIONAL' ? <ProfessionalArea tenantId={tenantId} /> : <StudentArea key={tenantId} tenantId={tenantId} userId={userId} onLogout={logout} />}
      </>}
    </>}
  </main>
}

function PlatformAdminArea() {
  const [tenantName, setTenantName] = useState('')
  const [professionalName, setProfessionalName] = useState('')
  const [professionalEmail, setProfessionalEmail] = useState('')
  const [invite, setInvite] = useState<{ link: string; expiresAt: string; professionalEmail: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'TODOS' | 'ATIVOS' | 'VENCIDOS' | 'SUSPENSOS' | 'PENDENTES'>('TODOS')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [spaces, setSpaces] = useState<PlatformSpace[]>([])
  const [listError, setListError] = useState('')
  const [listLoading, setListLoading] = useState(true)
  const listVersion = useRef(0)
  async function reload() {
    const version = ++listVersion.current
    try { const rows = await listPlatformSpaces(); if (version === listVersion.current) { setSpaces(rows); setListError('') } }
    catch (failure) { if (version === listVersion.current) setListError(textError(failure)) }
  }
  useEffect(() => {
    const version = ++listVersion.current
    let cancelled = false
    void listPlatformSpaces().then(rows => { if (!cancelled && version === listVersion.current) setSpaces(rows) })
      .catch(failure => { if (!cancelled && version === listVersion.current) setListError(textError(failure)) })
      .finally(() => { if (!cancelled) setListLoading(false) })
    return () => { cancelled = true }
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      const result = await createProfessionalTenantInvite({ tenantName, professionalName, professionalEmail })
      setInvite({ ...result, professionalEmail })
      setCopied(false)
      setTenantName(''); setProfessionalName(''); setProfessionalEmail('')
      setShowCreate(false)
      await reload()
    } catch (failure) { setError(textError(failure)) }
    finally { setSaving(false) }
  }
  async function savePlan(space: PlatformSpace) {
    await setPlatformSpacePlan(space)
    await reload()
  }
  async function copyInvite() {
    if (!invite) return
    try { await navigator.clipboard.writeText(invite.link); setCopied(true) }
    catch { setCopied(false); setError('Não foi possível copiar automaticamente. Selecione e copie o link abaixo.') }
  }
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const accessStatus = (space: PlatformSpace) => !space.plan_active ? 'SUSPENSOS' : space.expires_on && space.expires_on < today ? 'VENCIDOS' : 'ATIVOS'
  const counts = {
    TODOS: spaces.length,
    ATIVOS: spaces.filter(space => accessStatus(space) === 'ATIVOS').length,
    VENCIDOS: spaces.filter(space => accessStatus(space) === 'VENCIDOS').length,
    SUSPENSOS: spaces.filter(space => accessStatus(space) === 'SUSPENSOS').length,
    PENDENTES: spaces.filter(space => space.onboarding_status === 'CONVITE_PENDENTE').length,
  }
  const visibleSpaces = spaces.filter(space => {
    const matchesSearch = `${space.tenant_name} ${space.professional_name} ${space.professional_email}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
    return matchesSearch && (filter === 'TODOS' || filter === 'PENDENTES' && space.onboarding_status === 'CONVITE_PENDENTE' || accessStatus(space) === filter)
  })
  return <>
    <section className="panel admin-overview" aria-labelledby="admin-spaces-title">
      <div className="section-heading"><div><span className="eyebrow">Visão geral</span><h2 id="admin-spaces-title">Profissionais e espaços</h2><p>Consulte quem já ativou a conta e acompanhe o acesso de cada espaço.</p></div>
        <button type="button" onClick={() => { setShowCreate(previous => !previous); setError('') }} aria-expanded={showCreate} aria-controls="new-space-form">{showCreate ? 'Fechar cadastro' : 'Cadastrar personal'}</button></div>
      <div className="admin-metrics" aria-label="Resumo dos espaços">
        {([['TODOS','Espaços'],['ATIVOS','Planos ativos'],['VENCIDOS','Vencidos'],['SUSPENSOS','Suspensos'],['PENDENTES','Sem ativação']] as const).map(([key, label]) =>
          <button key={key} type="button" className={filter === key ? 'metric active' : 'metric'} onClick={() => setFilter(key)} aria-pressed={filter === key}>
            <strong>{counts[key]}</strong><span>{label}</span>
          </button>)}
      </div>
    </section>
    {showCreate && <section className="panel create-panel" id="new-space-form" aria-labelledby="new-space-title">
      <span className="eyebrow">Novo cadastro</span><h2 id="new-space-title">Novo espaço para personal</h2>
      <p>Informe a marca ou o estúdio do personal e seus dados de contato. Depois de criar, copie o convite e envie a ele.</p>
      <form onSubmit={event => void submit(event)}>
        <label>Nome do espaço do personal<input value={tenantName} onChange={event => setTenantName(event.target.value)} placeholder="Ex.: Estúdio Ana Lima" required maxLength={160} autoFocus /></label>
        <div className="form-grid"><label>Nome do personal<input value={professionalName} onChange={event => setProfessionalName(event.target.value)} placeholder="Ex.: Ana Lima" required maxLength={160} /></label>
        <label>E-mail do personal<input type="email" value={professionalEmail} onChange={event => setProfessionalEmail(event.target.value)} placeholder="Ex.: ana@exemplo.com" required maxLength={320} /></label></div>
        <div className="form-actions"><button disabled={saving}>{saving ? 'Criando espaço…' : 'Criar espaço e gerar convite'}</button><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancelar</button></div>
      </form>
      {error && <p role="alert" className="feedback error">{error}</p>}
    </section>}
    {invite && <section className="panel invite-panel">
      <span className="eyebrow">Próximo passo</span><h2 aria-live="polite">Espaço criado. Envie o convite ao personal.</h2>
      <p>Envie o link para <strong>{invite.professionalEmail}</strong>. Ele poderá criar a conta e ativar o acesso. O convite expira em {new Date(invite.expiresAt).toLocaleString('pt-BR')}.</p>
      <p><strong>Guarde o link agora:</strong> ele não será mostrado novamente depois que você sair desta página.</p>
      <code>{invite.link}</code><div className="form-actions"><button type="button" onClick={() => void copyInvite()}>{copied ? 'Link copiado' : 'Copiar convite'}</button></div>
      {error && <p role="alert" className="feedback error">{error}</p>}
    </section>}
    <section className="panel admin-list" aria-labelledby="space-list-title">
      <div className="section-heading"><div><h2 id="space-list-title">Espaços cadastrados</h2><p>O plano e a validade controlam o acesso, sem apagar dados ao suspender.</p></div></div>
      <label className="search-field">Buscar por espaço, nome ou e-mail<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite para encontrar um profissional" /></label>
      {listLoading ? <p role="status">Carregando espaços…</p> : listError ? <p role="alert" className="feedback error">{listError}</p> : visibleSpaces.length === 0 ?
        <p className="empty-state">{spaces.length === 0 ? 'Nenhum espaço cadastrado. Comece cadastrando um personal.' : 'Nenhum espaço corresponde à busca ou ao filtro selecionado.'}</p> :
        <div className="space-list">{visibleSpaces.map(space => <PlatformSpaceCard key={space.tenant_id} space={space} onSave={savePlan} />)}</div>}
    </section>
  </>
}

function PlatformSpaceCard({ space, onSave }: { space: PlatformSpace; onSave: (space: PlatformSpace) => Promise<void> }) {
  const [planType, setPlanType] = useState<PlatformSpace['plan_type']>(space.plan_type)
  const [expiresOn, setExpiresOn] = useState(space.expires_on ?? '')
  const [editing, setEditing] = useState(false)
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const status = !space.plan_active ? 'Suspenso' : space.expires_on && space.expires_on < today ? 'Vencido' : 'Ativo'
  const planLabel = { AVALIACAO: 'Avaliação', MENSAL: 'Mensal', ANUAL: 'Anual' }[space.plan_type]
  const dateLabel = space.expires_on ? space.expires_on.split('-').reverse().join('/') : 'Sem prazo definido'
  const changed = planType !== space.plan_type || (expiresOn || null) !== space.expires_on
  function closeEditor() { setPlanType(space.plan_type); setExpiresOn(space.expires_on ?? ''); setEditing(false) }
  async function save(active = space.plan_active, includeDraft = true) {
    setSaving(true); setError(''); setMessage('')
    try {
      await onSave({ ...space, plan_type: includeDraft ? planType : space.plan_type, expires_on: includeDraft ? expiresOn || null : space.expires_on, plan_active: active })
      setMessage(active === space.plan_active ? 'Plano e prazo atualizados.' : active ? 'Acesso reativado.' : 'Acesso suspenso.')
      setConfirmSuspend(false)
      if (includeDraft) setEditing(false)
    }
    catch (failure) { setError(textError(failure)) }
    finally { setSaving(false) }
  }
  return <article className="space-card">
    <div className="space-card-top"><div><h3>{space.tenant_name}</h3><p>{space.professional_name} · {space.professional_email || 'E-mail não informado'}</p></div>
      <span className={`status-badge ${status === 'Ativo' ? 'status-active' : status === 'Vencido' ? 'status-expired' : 'status-suspended'}`}>{status === 'Ativo' ? 'Plano ativo' : status}</span></div>
    <div className="space-card-meta"><span>{space.onboarding_status === 'ATIVADO' ? 'Conta ativada' : space.onboarding_status === 'CONVITE_PENDENTE' ? 'Aguardando ativação' : 'Sem convite'}</span><span>Plano {planLabel}</span><span>{space.expires_on ? `Válido até ${dateLabel}` : dateLabel}</span></div>
    <div className="card-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => { if (editing) closeEditor(); else setEditing(true); setConfirmSuspend(false); setError('') }} aria-expanded={editing}>{editing ? 'Fechar edição' : 'Editar plano e prazo'}</button>
      <button type="button" className={space.plan_active ? 'text-button danger-button' : 'text-button'} disabled={saving}
        onClick={() => { closeEditor(); if (space.plan_active) setConfirmSuspend(true); else void save(true, false) }}>
        {space.plan_active ? 'Suspender acesso' : 'Reativar acesso'}</button></div>
    {confirmSuspend && <div className="confirm-box"><p><strong>Suspender este espaço?</strong> O personal e seus alunos perderão acesso imediatamente. Os dados serão preservados.</p>
      <div className="form-actions"><button type="button" disabled={saving} onClick={() => void save(false, false)}>Confirmar suspensão</button><button type="button" className="secondary-button" onClick={() => setConfirmSuspend(false)}>Cancelar</button></div></div>}
    {editing && <form className="plan-form" onSubmit={event => { event.preventDefault(); void save() }}>
      <div className="form-grid"><label>Tipo de plano<select value={planType} onChange={event => setPlanType(event.target.value as PlatformSpace['plan_type'])}>
        <option value="AVALIACAO">Avaliação</option><option value="MENSAL">Mensal</option><option value="ANUAL">Anual</option>
      </select></label>
      <label>Válido até<input type="date" value={expiresOn} onChange={event => setExpiresOn(event.target.value)} /></label></div>
      <small>Deixe a data vazia para acesso sem prazo. O tipo de plano não altera a data automaticamente.</small>
      <div className="form-actions"><button disabled={saving || !changed}>{saving ? 'Salvando…' : 'Salvar plano'}</button><button type="button" className="secondary-button" disabled={saving} onClick={closeEditor}>Cancelar</button></div>
    </form>}
    {error && <p role="alert" className="feedback error">{error}</p>}{message && <p role="status" className="feedback success">{message}</p>}
  </article>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const returnTo = safeActivationReturn(new URLSearchParams(location.hash.slice(1)).get('returnTo'))
  async function submit(event: FormEvent) {
    event.preventDefault()
    const { error: authError } = await supabase!.auth.signInWithPassword({ email, password })
    if (authError) setError(authErrorText(authError.message))
    else if (returnTo !== '/app') window.location.assign(returnTo)
    else {
      try {
        const [links, admin] = await Promise.all([listMemberships(), isPlatformAdmin()])
        window.location.assign(links.some(link => link.role === 'PROFISSIONAL') ? '/app' : links.some(link => link.role === 'ALUNO') ? '/aluno/inicio' : admin ? '/admin' : '/app')
      } catch { window.location.assign('/app') }
    }
  }
  return <main className="shell"><header><span className="eyebrow">PersonalFit</span><h1>Entrar</h1><p>Acesse sua área com o e-mail e a senha da sua conta.</p></header><section className="panel"><form onSubmit={event => void submit(event)}>
    <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
    <label>Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
    <button type="submit">Entrar</button></form>{error && <p role="alert">{error}</p>}</section></main>
}

function ProfessionalArea({ tenantId }: { tenantId: string }) {
  const [brand, setBrand] = useState<Brand | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [detail, setDetail] = useState<Student | null>(null)
  const [notes, setNotes] = useState('')
  const [invite, setInvite] = useState<{ link: string; expiresAt: string } | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [issuingInvite, setIssuingInvite] = useState(false)
  const [confirmNewInvite, setConfirmNewInvite] = useState(false)
  const inviteLinkRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<StudentInput>({ full_name: '', email: '', phone: null, goal: null })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'TODOS' | 'ATIVOS' | 'INATIVOS' | 'PENDENTES'>('TODOS')
  const [showCreate, setShowCreate] = useState(false)
  const [studentTab, setStudentTab] = useState<'CADASTRO' | 'ATENDIMENTO' | 'TREINO'>(() => {
    const requested = new URLSearchParams(window.location.search).get('aba')?.toUpperCase()
    return requested === 'ATENDIMENTO' || requested === 'TREINO' ? requested : 'CADASTRO'
  })
  const [savingBrand, setSavingBrand] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [selectedPreview, setSelectedPreview] = useState('')
  const selectedPreviewRef = useRef('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [savedLogoPath, setSavedLogoPath] = useState<string | null>(null)
  const studentId = path.startsWith('/app/alunos/') ? path.split('/')[3] : null
  const onBrandPage = path === '/app/configuracoes'
  const onExercisePage = path === '/app/exercicios'
  const onListPage = path === '/app/alunos'
  function selectStudentTab(tab: 'CADASTRO' | 'ATENDIMENTO' | 'TREINO') {
    setStudentTab(tab)
    const url = new URL(window.location.href)
    if (tab === 'CADASTRO') url.searchParams.delete('aba')
    else url.searchParams.set('aba', tab.toLowerCase())
    window.history.replaceState(window.history.state, '', url)
  }

  useEffect(() => {
    let active = true
    void Promise.all([getBrand(tenantId), listStudents(tenantId)]).then(([brandRow, studentRows]) => {
      if (active) { setBrand(brandRow); setSavedLogoPath(brandRow?.logo_url ?? null); setLogoPreview(''); setStudents(studentRows) }
    }).catch(failure => { if (active) setError(textError(failure)) })
    return () => { active = false }
  }, [tenantId])
  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (brand?.logo_url && isManagedLogoPath(brand.logo_url)) {
      void downloadBrandLogo(brand.logo_url).then(blob => {
        objectUrl = URL.createObjectURL(blob)
        if (active) setLogoPreview(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      }).catch(() => { if (active) setLogoPreview('') })
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [brand?.logo_url])
  useEffect(() => () => { if (selectedPreviewRef.current) URL.revokeObjectURL(selectedPreviewRef.current) }, [])
  function rejectLogo(message: string) {
    if (selectedPreviewRef.current) URL.revokeObjectURL(selectedPreviewRef.current)
    selectedPreviewRef.current = ''
    if (logoInputRef.current) logoInputRef.current.value = ''
    setLogoFile(null); setSelectedPreview(''); setError(message)
  }
  function chooseLogo(file: File | null) {
    if (file && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { rejectLogo('Escolha uma imagem PNG, JPG ou WebP.'); return }
    if (file && file.size > 2 * 1024 * 1024) { rejectLogo('O logotipo deve ter até 2 MB.'); return }
    if (file && file.size === 0) { rejectLogo('O arquivo selecionado está vazio.'); return }
    if (selectedPreviewRef.current) URL.revokeObjectURL(selectedPreviewRef.current)
    selectedPreviewRef.current = file ? URL.createObjectURL(file) : ''
    if (!file && logoInputRef.current) logoInputRef.current.value = ''
    setLogoFile(file)
    setSelectedPreview(selectedPreviewRef.current)
    setError('')
  }
  useEffect(() => {
    if (!studentId) return
    let active = true
    void Promise.all([getStudent(tenantId, studentId), getStudentNotes(tenantId, studentId)]).then(([student, body]) => {
      if (active) { setDetail(student); setNotes(body); if (student) setForm({ full_name: student.full_name, email: student.email, phone: student.phone, goal: student.goal }) }
    }).catch(failure => { if (active) setError(textError(failure)) })
    return () => { active = false }
  }, [tenantId, studentId])

  async function saveStudent(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      if (studentId) {
        const updated = await updateStudent(tenantId, studentId, form)
        await saveStudentNotes(tenantId, studentId, notes)
        setDetail(updated); setMessage('Aluno atualizado')
      } else {
        const created = await createStudent(tenantId, form)
        window.location.assign(`/app/alunos/${created.id}`)
      }
    } catch (failure) { setError(textError(failure)) }
  }
  async function toggleStatus() {
    if (!detail) return
    try { setDetail(await updateStudent(tenantId, detail.id, { status: detail.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })); if (detail.status === 'ACTIVE') setInvite(null); setMessage('Status atualizado') }
    catch (failure) { setError(textError(failure)) }
  }
  async function issueInvite() {
    if (!detail || issuingInvite) return
    setIssuingInvite(true); setError(''); setConfirmNewInvite(false)
    try { const result = await createInvite(detail.id); setInvite(result); setInviteCopied(false) }
    catch (failure) { setError(textError(failure)) }
    finally { setIssuingInvite(false) }
  }
  async function copyStudentInvite() {
    if (!invite) return
    try { await navigator.clipboard.writeText(invite.link); setInviteCopied(true); setError('') }
    catch { inviteLinkRef.current?.select(); setError('Não foi possível copiar automaticamente. O link foi selecionado para você copiar manualmente.') }
  }
  async function saveBrand(event: FormEvent) {
    event.preventDefault()
    if (!brand) return
    setSavingBrand(true); setError(''); setMessage('')
    let uploadedPath = ''
    try {
      if (logoFile) uploadedPath = await uploadBrandLogo(tenantId, logoFile)
      const logoPath = uploadedPath || brand.logo_url
      await updateBrand(tenantId, { brand_name: brand.brand_name, display_name: brand.display_name, accent_color: brand.accent_color, secondary_color: brand.secondary_color, logo_url: logoPath, whatsapp: brand.whatsapp, instagram: brand.instagram })
      setBrand({ ...brand, logo_url: logoPath }); setSavedLogoPath(logoPath); chooseLogo(null); setLogoPreview('')
      setMessage('Marca atualizada. A prévia mostra como seus alunos verão as cores e o logotipo.')
      if (savedLogoPath && savedLogoPath !== logoPath) void removeBrandLogo(savedLogoPath).catch(() => {})
    } catch (failure) {
      if (uploadedPath) void removeBrandLogo(uploadedPath).catch(() => {})
      setError(textError(failure))
    } finally { setSavingBrand(false) }
  }
  const counts = { TODOS: students.length, ATIVOS: students.filter(student => student.status === 'ACTIVE').length, INATIVOS: students.filter(student => student.status === 'INACTIVE').length, PENDENTES: students.filter(student => !student.user_id).length }
  const visibleStudents = students.filter(student => `${student.full_name} ${student.email}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')) && (filter === 'TODOS' || filter === 'PENDENTES' && !student.user_id || filter === 'ATIVOS' && student.status === 'ACTIVE' || filter === 'INATIVOS' && student.status === 'INACTIVE'))

  return <><nav className="panel professional-nav" aria-label="Área do personal"><a href="/app" aria-current={!onBrandPage && !onExercisePage && !onListPage && !studentId ? 'page' : undefined}>Início</a><a href="/app/alunos" aria-current={onListPage || studentId ? 'page' : undefined}>Alunos</a><a href="/app/exercicios" aria-current={onExercisePage ? 'page' : undefined}>Exercícios</a><a href="/app/configuracoes" aria-current={onBrandPage ? 'page' : undefined}>Marca</a></nav>
    {error && <p role="alert" className="feedback error">{error}</p>}{message && <p role="status" className="feedback success">{message}</p>}
    {onExercisePage ? <Suspense fallback={<p>Carregando exercícios…</p>}><ExerciseLibrary tenantId={tenantId} /></Suspense> : onBrandPage ? <section className="panel professional-panel" aria-labelledby="brand-title">
      <div className="section-heading"><div><span className="eyebrow">Identidade do espaço</span><h2 id="brand-title">Sua marca</h2><p>Personalize a apresentação que seus alunos encontrarão no aplicativo.</p></div></div>
      {brand && <div className="brand-layout"><form onSubmit={event => void saveBrand(event)}>
        <div className="form-grid"><label>Nome da marca<input value={brand.brand_name} maxLength={160} onChange={event => setBrand({ ...brand, brand_name: event.target.value })} required /></label>
          <label>Nome exibido aos alunos<input value={brand.display_name} maxLength={160} onChange={event => setBrand({ ...brand, display_name: event.target.value })} required /></label></div>
        <div className="form-grid"><label>Cor principal<input type="color" value={brand.accent_color} onChange={event => setBrand({ ...brand, accent_color: event.target.value })} /></label>
          <label>Cor secundária<input type="color" value={brand.secondary_color} onChange={event => setBrand({ ...brand, secondary_color: event.target.value })} /></label></div>
        <label>Logotipo <span className="field-hint">PNG, JPG ou WebP, até 2 MB</span><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => chooseLogo(event.target.files?.[0] ?? null)} /></label>
        {(brand.logo_url || logoFile) && <div className="form-actions"><button type="button" className="secondary-button" onClick={() => { chooseLogo(null); setBrand({ ...brand, logo_url: null }); setLogoPreview('') }}>Remover logotipo</button></div>}
        <div className="form-grid"><label>WhatsApp<input type="tel" value={brand.whatsapp ?? ''} maxLength={40} placeholder="DDD e número" onChange={event => setBrand({ ...brand, whatsapp: event.target.value || null })} /></label>
          <label>Instagram<input value={brand.instagram ?? ''} maxLength={100} placeholder="@seuperfil" onChange={event => setBrand({ ...brand, instagram: event.target.value || null })} /></label></div>
        <div className="form-actions"><button disabled={savingBrand}>{savingBrand ? 'Salvando marca…' : 'Salvar marca'}</button></div>
      </form>
      <aside className="brand-preview" style={{ backgroundColor: brand.secondary_color, color: contrastText(brand.secondary_color) }} aria-label="Prévia da marca"><span className="eyebrow">Prévia para o aluno</span>
        <div className="brand-preview-logo">{selectedPreview || brand.logo_url && logoPreview ? <img src={selectedPreview || logoPreview} alt="Prévia do logotipo" /> : <span>{brand.logo_url ? 'Prévia indisponível' : 'Seu logotipo'}</span>}</div>
        <h3>{brand.brand_name || 'Nome da marca'}</h3><p>Com {brand.display_name || 'seu personal'}</p>
        <span className="brand-preview-button" style={{ backgroundColor: brand.accent_color, color: contrastText(brand.accent_color) }}>Meu espaço</span>
      </aside></div>}
    </section> : studentId ? <section className="panel professional-panel" aria-labelledby="student-title">
      {detail ? <><a href="/app/alunos" className="back-link">← Voltar aos alunos</a><div className="section-heading student-heading"><div><span className="eyebrow">Aluno</span><h2 id="student-title">{detail.full_name}</h2><p>Conta {detail.user_id ? 'ativada' : 'pendente'}</p></div><span className={`status-badge ${detail.status === 'ACTIVE' ? 'status-active' : 'status-suspended'}`}>{detail.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</span></div>
        <nav className="student-management-tabs" role="tablist" aria-label="Seções do aluno">{([['CADASTRO','Cadastro'],['ATENDIMENTO','Atendimento'],['TREINO','Treino']] as const).map(([key,label]) => <button type="button" role="tab" key={key} id={`student-tab-${key}`} aria-controls={`student-panel-${key}`} aria-selected={studentTab === key} onClick={() => selectStudentTab(key)}>{label}</button>)}</nav>
        <div className="student-management-panel" id="student-panel-CADASTRO" role="tabpanel" aria-labelledby="student-tab-CADASTRO" hidden={studentTab !== 'CADASTRO'}><div className="student-detail-layout"><div><h3>Dados do aluno</h3><StudentForm form={form} setForm={setForm} notes={notes} setNotes={setNotes} onSubmit={saveStudent} /></div>
        <aside className="student-side"><h3>Acesso ao aplicativo</h3><p>{detail.user_id ? 'A conta deste aluno já está ativada.' : 'Envie um convite para o aluno criar a conta e acessar seu espaço.'}</p>
          {!detail.user_id && detail.status === 'ACTIVE' && <button type="button" disabled={issuingInvite} onClick={() => setConfirmNewInvite(true)}>{issuingInvite ? 'Gerando convite…' : invite ? 'Gerar novo convite' : 'Criar convite'}</button>}
          {confirmNewInvite && <div className="confirm-box"><p><strong>{invite ? 'Substituir convite?' : 'Gerar convite?'}</strong> Se existir um link anterior, ele deixará de funcionar.</p><div className="form-actions"><button type="button" disabled={issuingInvite} onClick={() => void issueInvite()}>Confirmar convite</button><button type="button" className="secondary-button" onClick={() => setConfirmNewInvite(false)}>Cancelar</button></div></div>}
          <div className="card-actions"><button type="button" className={detail.status === 'ACTIVE' ? 'secondary-button danger-button' : 'secondary-button'} onClick={() => void toggleStatus()}>{detail.status === 'ACTIVE' ? 'Inativar aluno' : 'Reativar aluno'}</button></div>
          {invite && <div className="student-invite"><strong role="status">Convite pronto para enviar</strong><p>Válido até {new Date(invite.expiresAt).toLocaleString('pt-BR')}. Copie ou compartilhe agora: o link não será recuperado após sair desta página.</p>
            <input ref={inviteLinkRef} aria-label="Link do convite" readOnly value={invite.link} onFocus={event => event.currentTarget.select()} />
            <div className="form-actions"><button type="button" onClick={() => void copyStudentInvite()}>{inviteCopied ? 'Link copiado' : 'Copiar convite'}</button>
              <a className="action-link" href={`https://wa.me/?text=${encodeURIComponent(`Olá! ${brand?.display_name ?? 'Seu personal'} convidou você para acessar seu espaço no PersonalFit.\nAtive sua conta por este link: ${invite.link}`)}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Compartilhar pelo WhatsApp</a></div>
            <small>O WhatsApp abrirá com a mensagem pronta. Escolha o contato e confirme o envio lá.</small>
          </div>}</aside></div></div><div className="student-management-panel" id="student-panel-ATENDIMENTO" role="tabpanel" aria-labelledby="student-tab-ATENDIMENTO" hidden={studentTab !== 'ATENDIMENTO'}><Suspense fallback={<p>Carregando atendimento…</p>}><StudentServicePlanEditor tenantId={tenantId} studentId={detail.id} /></Suspense></div><div className="student-management-panel" id="student-panel-TREINO" role="tabpanel" aria-labelledby="student-tab-TREINO" hidden={studentTab !== 'TREINO'}><Suspense fallback={<p>Carregando treino…</p>}><WorkoutEditor tenantId={tenantId} studentId={detail.id} studentName={detail.full_name} active={detail.status === 'ACTIVE'} /></Suspense></div></> : <><h2 id="student-title">Aluno indisponível</h2><p>Aluno não encontrado ou acesso negado.</p><a href="/app/alunos">Voltar aos alunos</a></>}
    </section> : onListPage ? <><section className="panel professional-panel"><div className="section-heading"><div><span className="eyebrow">Gestão de alunos</span><h2>Alunos</h2><p>Encontre cadastros, acompanhe a ativação e organize os acessos.</p></div><button type="button" onClick={() => setShowCreate(previous => !previous)} aria-expanded={showCreate}>{showCreate ? 'Fechar cadastro' : 'Cadastrar aluno'}</button></div>
      <div className="admin-metrics" aria-label="Resumo dos alunos">{([['TODOS','Todos'],['ATIVOS','Ativos'],['INATIVOS','Inativos'],['PENDENTES','Sem conta']] as const).map(([key,label]) => <button type="button" key={key} className={filter === key ? 'metric active' : 'metric'} onClick={() => setFilter(key)} aria-pressed={filter === key}><strong>{counts[key]}</strong><span>{label}</span></button>)}</div>
      <label className="search-field">Buscar por nome ou e-mail<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite para encontrar um aluno" /></label>
      {visibleStudents.length ? <div className="space-list">{visibleStudents.map(student => <article className="space-card" key={student.id}><div className="space-card-top"><div><h3>{student.full_name}</h3><p>{student.email}</p></div><span className={`status-badge ${student.status === 'ACTIVE' ? 'status-active' : 'status-suspended'}`}>{student.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</span></div><div className="space-card-meta"><span>{student.user_id ? 'Conta ativada' : 'Aguardando ativação'}</span>{student.goal && <span>{student.goal}</span>}</div><a href={`/app/alunos/${student.id}`}>Ver cadastro →</a></article>)}</div> : <p className="empty-state">{students.length ? 'Nenhum aluno corresponde à busca ou ao filtro.' : 'Nenhum aluno cadastrado. Comece pelo botão Cadastrar aluno.'}</p>}
    </section>{showCreate && <section className="panel create-panel"><span className="eyebrow">Novo cadastro</span><h2>Criar aluno</h2><p>Cadastre os dados básicos. Depois você poderá enviar o convite de acesso.</p><StudentForm form={form} setForm={setForm} onSubmit={saveStudent} /></section>}</> : <section className="panel professional-panel"><div className="section-heading"><div><span className="eyebrow">Visão geral</span><h2>Seu espaço</h2><p>Acompanhe seus alunos e ajuste a experiência que eles recebem.</p></div><a className="action-link" href="/app/alunos">Ver alunos</a></div><div className="admin-metrics"><a className="metric" href="/app/alunos"><strong>{counts.TODOS}</strong><span>Alunos cadastrados</span></a><a className="metric" href="/app/alunos"><strong>{counts.ATIVOS}</strong><span>Alunos ativos</span></a><a className="metric" href="/app/alunos"><strong>{counts.PENDENTES}</strong><span>Sem conta ativada</span></a></div><div className="professional-next"><h3>Sua identidade</h3><p>Seus alunos veem <strong>{brand?.display_name ?? 'o nome do seu espaço'}</strong>. Ajuste cores, logotipo e contatos na aba Marca.</p><a href="/app/configuracoes">Configurar marca →</a></div></section>}
  </>
}

function StudentForm({ form, setForm, notes, setNotes, onSubmit }: { form: StudentInput; setForm: (value: StudentInput) => void; notes?: string; setNotes?: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return <form onSubmit={event => void onSubmit(event)}>
    <label>Nome<input value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} required /></label>
    <label>E-mail<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></label>
    <label>Telefone<input value={form.phone ?? ''} onChange={event => setForm({ ...form, phone: event.target.value || null })} /></label>
    <label>Objetivo<input value={form.goal ?? ''} onChange={event => setForm({ ...form, goal: event.target.value || null })} /></label>
    {setNotes && <label>Observações internas<textarea value={notes ?? ''} onChange={event => setNotes(event.target.value)} /></label>}
    <button type="submit">Salvar aluno</button>
  </form>
}

function StudentArea({ tenantId, userId, onLogout }: { tenantId: string; userId: string; onLogout: () => Promise<void> }) {
  const [student, setStudent] = useState<Student | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void getCachedStudentView(userId, tenantId).then(cached => {
      if (cached && active) { setStudent(cached.student); setBrand(cached.brand) }
    }).catch(() => {})
    void Promise.all([listStudents(tenantId), getBrand(tenantId)]).then(async ([rows, value]) => {
      const own = rows.find(row => row.user_id === userId) ?? null
      if (own) await cacheStudentView(userId, tenantId, own, value)
      if (active) { setStudent(own); setBrand(value) }
    }).catch(async failure => {
      if (!navigator.onLine && await getCachedStudentView(userId, tenantId)) return
      if (active) setError(textError(failure))
    })
    return () => { active = false }
  }, [tenantId, userId])
  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (brand?.logo_url && isManagedLogoPath(brand.logo_url)) {
      void downloadBrandLogo(brand.logo_url).then(blob => {
        objectUrl = URL.createObjectURL(blob)
        if (active) setLogoPreview(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      }).catch(() => { if (active) setLogoPreview('') })
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [brand?.logo_url])
  const firstName = student?.full_name.trim().split(/\s+/)[0].toLocaleLowerCase('pt-BR')
  const brandName = brand?.brand_name || brand?.display_name || 'Seu espaço'
  const whatsappDigits = brand?.whatsapp?.replace(/\D/g, '') ?? ''
  const whatsappNumber = whatsappDigits.length === 11 ? `55${whatsappDigits}` : /^55\d{10,11}$/.test(whatsappDigits) ? whatsappDigits : ''
  const instagramHandle = brand?.instagram?.replace(/^@/, '') ?? ''
  const instagramValid = /^[a-zA-Z0-9._]{1,30}$/.test(instagramHandle)
  const theme = { '--student-accent': brand?.accent_color ?? '#123b36', '--student-on-accent': contrastText(brand?.accent_color ?? '#123b36'), '--student-secondary': brand?.secondary_color ?? '#ffffff' } as CSSProperties
  return <div className="student-experience" style={theme}>
    <header className="student-app-header"><div className="student-app-brand">{logoPreview ? <img src={logoPreview} alt={`Logotipo de ${brandName}`} /> : <span className="student-brand-placeholder" aria-hidden="true">{brandName.charAt(0).toLocaleUpperCase('pt-BR')}</span>}<div><strong>{brandName}</strong>{brand?.display_name && <small>com {brand.display_name}</small>}</div></div><button type="button" className="student-logout" onClick={() => void onLogout()}>Sair</button></header>
    <section className="student-home"><div className="student-welcome"><h1>{firstName ? `Olá, ${firstName.charAt(0).toLocaleUpperCase('pt-BR') + firstName.slice(1)}` : 'Seu treino'}</h1>{(whatsappNumber || instagramValid) && <nav aria-label="Contato do personal" className="student-contact">{whatsappNumber && <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">WhatsApp</a>}{instagramValid && <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Instagram</a>}</nav>}</div>{error && <p role="alert">{error}</p>}
      {student && <Suspense fallback={<p>Carregando treino…</p>}><StudentServicePlanSummary tenantId={tenantId} studentId={student.id} /><WorkoutPlayer tenantId={tenantId} studentId={student.id} userId={userId} /></Suspense>}</section>
  </div>
}

function Activation({ userId, email }: { userId: string | null; email: string }) {
  const [signupEmail, setSignupEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupMessage, setSignupMessage] = useState('')
  const [activationError, setActivationError] = useState('')
  const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
  async function signup(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase!.auth.signUp({ email: signupEmail, password })
    setSignupMessage(error ? authErrorText(error.message) : 'Conta criada. Se a confirmação por e-mail for solicitada, confirme antes de continuar.')
    setPassword('')
  }
  async function activate() {
    try { await claimInvite(token); history.replaceState(null, '', '/aluno/inicio'); location.assign('/aluno/inicio') }
    catch (failure) { setActivationError(activationErrorText(failure)) }
  }
  async function switchAccount() {
    const { error } = await supabase!.auth.signOut({ scope: 'local' })
    if (error) setActivationError(authErrorText(error.message))
    else location.reload()
  }
  return <main className="shell"><header><span className="eyebrow">Convite do aluno</span><h1>Ativar cadastro</h1></header><section className="panel">
    {!token ? <p>Este link não contém um convite. Verifique o endereço recebido.</p> : userId ? <><span className="eyebrow">Etapa 2 de 2</span><h2>Confirme sua ativação</h2><p>Você está conectado como <strong>{email}</strong>. Confirme para acessar a área do aluno.</p><div className="form-actions"><button onClick={() => void activate()}>Ativar meu cadastro</button><button type="button" className="secondary-button" onClick={() => void switchAccount()}>Trocar conta</button></div>{activationError && <p role="alert" className="feedback error">{activationError}</p>}</> : <><span className="eyebrow">Etapa 1 de 2</span><h2>Crie ou acesse sua conta</h2><p>Use o mesmo e-mail informado pelo seu personal ao criar o convite.</p>
      <form onSubmit={event => void signup(event)}><label>E-mail<input type="email" value={signupEmail} onChange={event => setSignupEmail(event.target.value)} required /></label>
      <label>Senha<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label><button>Criar conta</button></form>
      <p>Já tem conta? <a href={`/login#returnTo=${encodeURIComponent(`/ativar#token=${token}`)}`}>Entre e volte ao convite automaticamente</a>.</p>
      {signupMessage && <p role="status" className="feedback">{signupMessage}</p>}</>}
  </section></main>
}

function ProfessionalActivation({ userId, email }: { userId: string | null; email: string }) {
  const [signupEmail, setSignupEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupMessage, setSignupMessage] = useState('')
  const [activationError, setActivationError] = useState('')
  const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
  async function signup(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase!.auth.signUp({ email: signupEmail, password })
    setSignupMessage(error ? authErrorText(error.message) : 'Conta criada. Se a confirmação por e-mail for solicitada, confirme antes de continuar.')
    setPassword('')
  }
  async function activate() {
    try { await claimProfessionalInvite(token); history.replaceState(null, '', '/app'); location.assign('/app') }
    catch (failure) { setActivationError(activationErrorText(failure)) }
  }
  async function switchAccount() {
    const { error } = await supabase!.auth.signOut({ scope: 'local' })
    if (error) setActivationError(authErrorText(error.message))
    else location.reload()
  }
  return <main className="shell"><header><span className="eyebrow">Convite do personal</span><h1>Ativar acesso profissional</h1></header><section className="panel">
    {!token ? <p>Este link não contém um convite. Verifique o endereço recebido.</p> : userId ? <><span className="eyebrow">Etapa 2 de 2</span><h2>Confirme sua ativação</h2><p>Você está conectado como <strong>{email}</strong>. Confirme para entrar no seu espaço.</p><div className="form-actions"><button onClick={() => void activate()}>Ativar meu acesso</button><button type="button" className="secondary-button" onClick={() => void switchAccount()}>Trocar conta</button></div>{activationError && <p role="alert" className="feedback error">{activationError}</p>}</> : <><span className="eyebrow">Etapa 1 de 2</span><h2>Crie ou acesse sua conta</h2><p>Use o mesmo e-mail informado pelo administrador ao criar o convite.</p>
      <form onSubmit={event => void signup(event)}><label>E-mail<input type="email" value={signupEmail} onChange={event => setSignupEmail(event.target.value)} required /></label>
      <label>Senha<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label><button>Criar conta</button></form>
      <p>Já tem conta? <a href={`/login#returnTo=${encodeURIComponent(`/ativar-profissional#token=${token}`)}`}>Entre e volte ao convite automaticamente</a>.</p>
      {signupMessage && <p role="status" className="feedback">{signupMessage}</p>}</>}
  </section></main>
}
