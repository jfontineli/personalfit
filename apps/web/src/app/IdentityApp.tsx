import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../services/supabase'
import { claimInvite, createInvite, createStudent, getBrand, getStudent, getStudentNotes, isPlatformAdmin, listMemberships, listStudents, listTenants, saveStudentNotes, updateBrand, updateStudent, type Brand, type Membership, type Student, type StudentInput, type Tenant } from '../services/business'

const path = window.location.pathname
const textError = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação'

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
        const { data: { user }, error: authError } = await client.auth.getUser()
        if (authError || !user) { setUserId(null); setLoading(false); return }
        setUserId(user.id)
        setEmail(user.email ?? '')
        const [links, tenantRows, admin] = await Promise.all([listMemberships(), listTenants(), isPlatformAdmin()])
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
    else { setUserId(null); setMemberships([]); window.location.replace('/login') }
  }

  if (loading) return <main className="shell"><p>Carregando sessão…</p></main>
  if (!supabase) return <main className="shell"><p>Supabase local não configurado.</p></main>
  if (path === '/ativar') return <Activation userId={userId} email={email} />
  if (!userId) return <Login />

  const membership = memberships.find(link => link.tenant_id === tenantId)
  const tenant = tenants.find(item => item.id === tenantId)
  return <main className="shell">
    <header><span className="eyebrow">PersonalFit · Identidade</span><h1>{membership?.role === 'ALUNO' ? 'Área do aluno' : 'Área profissional'}</h1>
      <p>Conectado como {email}</p><button onClick={() => void logout()}>Sair</button></header>
    {error && <p role="alert">{error}</p>}
    {memberships.length === 0 ? <section className="panel"><h2>{platformAdmin ? 'Administração da plataforma' : 'Acesso restrito'}</h2><p>{platformAdmin ? 'Papel SUPER_ADMIN ativo. Operações administrativas privilegiadas serão implementadas em contrato servidor auditado.' : 'Nenhum vínculo ativo com tenant.'}</p></section> : <>
      {memberships.length > 1 && <label>Tenant<select aria-label="Selecionar tenant" value={tenantId} onChange={event => setTenantId(event.target.value)}><option value="">Escolha um tenant</option>{memberships.map(link => <option key={link.tenant_id} value={link.tenant_id}>{tenants.find(item => item.id === link.tenant_id)?.name ?? link.tenant_id}</option>)}</select></label>}
      {!membership ? <p>Selecione um tenant para continuar.</p> : <>
        <p>Tenant: <strong>{tenant?.name}</strong> · Papel: {membership.role}</p>
        {membership.role === 'PROFISSIONAL' ? <ProfessionalArea tenantId={tenantId} /> : <StudentArea tenantId={tenantId} userId={userId} />}
      </>}
    </>}
  </main>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    const { error: authError } = await supabase!.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
    else window.location.assign('/app')
  }
  return <main className="shell"><header><h1>Entrar</h1></header><section className="panel"><form onSubmit={event => void submit(event)}>
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
  const [invite, setInvite] = useState('')
  const [form, setForm] = useState<StudentInput>({ full_name: '', email: '', phone: null, goal: null })
  const studentId = path.startsWith('/app/alunos/') ? path.split('/')[3] : null
  const onBrandPage = path === '/app/configuracoes'
  const onListPage = path === '/app/alunos'

  useEffect(() => {
    let active = true
    void Promise.all([getBrand(tenantId), listStudents(tenantId)]).then(([brandRow, studentRows]) => {
      if (active) { setBrand(brandRow); setStudents(studentRows) }
    }).catch(failure => { if (active) setError(textError(failure)) })
    return () => { active = false }
  }, [tenantId])
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
    try { setDetail(await updateStudent(tenantId, detail.id, { status: detail.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })); setMessage('Status atualizado') }
    catch (failure) { setError(textError(failure)) }
  }
  async function issueInvite() {
    if (!detail) return
    try { const result = await createInvite(detail.id); setInvite(`${result.link} (expira em ${new Date(result.expiresAt).toLocaleString()})`) }
    catch (failure) { setError(textError(failure)) }
  }
  async function saveBrand(event: FormEvent) {
    event.preventDefault()
    if (!brand) return
    try { await updateBrand(tenantId, { brand_name: brand.brand_name, display_name: brand.display_name, accent_color: brand.accent_color, secondary_color: brand.secondary_color, logo_url: brand.logo_url, whatsapp: brand.whatsapp, instagram: brand.instagram }); setMessage('Marca atualizada') }
    catch (failure) { setError(textError(failure)) }
  }

  return <><nav className="panel"><a href="/app">Início</a><a href="/app/alunos">Alunos</a><a href="/app/configuracoes">Marca</a></nav>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {onBrandPage ? <section className="panel"><h2>Configurações da marca</h2>{brand && <form onSubmit={event => void saveBrand(event)}>
      {(['brand_name','display_name','accent_color','secondary_color','logo_url','whatsapp','instagram'] as const).map(field => <label key={field}>{field}<input value={brand[field] ?? ''} onChange={event => setBrand({ ...brand, [field]: event.target.value || (['logo_url','whatsapp','instagram'].includes(field) ? null : '') })} required={!['logo_url','whatsapp','instagram'].includes(field)} /></label>)}
      <button>Salvar marca</button></form>}</section> : studentId ? <section className="panel"><h2>Aluno</h2>{detail ? <><p>Status: {detail.status} · Conta: {detail.user_id ? 'ativada' : 'pendente'}</p>
      <StudentForm form={form} setForm={setForm} notes={notes} setNotes={setNotes} onSubmit={saveStudent} />
      <button onClick={() => void toggleStatus()}>{detail.status === 'ACTIVE' ? 'Inativar aluno' : 'Reativar aluno'}</button>{' '}
      {!detail.user_id && detail.status === 'ACTIVE' && <button onClick={() => void issueInvite()}>Criar convite</button>}
      {invite && <p role="status">Convite de uso único: <code>{invite}</code></p>}</> : <p>Aluno não encontrado ou acesso negado.</p>}</section> : onListPage ? <><section className="panel"><h2>Alunos</h2><ul>{students.map(student => <li key={student.id}><a href={`/app/alunos/${student.id}`}>{student.full_name}</a> · {student.status}</li>)}</ul></section>
      <section className="panel"><h2>Criar aluno</h2><StudentForm form={form} setForm={setForm} onSubmit={saveStudent} /></section></> : <section className="panel"><h2>Visão inicial</h2><p>{students.length} aluno(s) cadastrado(s).</p><p>Marca: {brand?.display_name ?? 'carregando'}</p></section>}
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

function StudentArea({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [student, setStudent] = useState<Student | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void Promise.all([listStudents(tenantId), getBrand(tenantId)]).then(([rows, value]) => { setStudent(rows.find(row => row.user_id === userId) ?? null); setBrand(value) }).catch(failure => setError(textError(failure)))
  }, [tenantId, userId])
  return <section className="panel"><h2>Início do aluno</h2>{error && <p role="alert">{error}</p>}
    <p>Marca: {brand?.display_name ?? 'carregando'}</p><p>Identificação: {student?.full_name ?? 'Cadastro indisponível'}</p>
    <p>Treino será implementado em uma fase futura.</p></section>
}

function Activation({ userId, email }: { userId: string | null; email: string }) {
  const [signupEmail, setSignupEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
  async function signup(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase!.auth.signUp({ email: signupEmail, password })
    setMessage(error ? error.message : 'Conta criada. Confirme o e-mail se solicitado e conclua a ativação.')
    setPassword('')
  }
  async function activate() {
    try { await claimInvite(token); history.replaceState(null, '', '/aluno/inicio'); location.assign('/aluno/inicio') }
    catch (failure) { setMessage(textError(failure)) }
  }
  return <main className="shell"><header><h1>Ativar cadastro</h1></header><section className="panel">
    {!token ? <p>Convite ausente.</p> : userId ? <><p>Conta: {email}</p><button onClick={() => void activate()}>Concluir ativação</button></> : <><p>Crie a conta com o mesmo e-mail do cadastro ou <a href="/login">entre em uma conta existente</a> e volte ao convite.</p>
      <form onSubmit={event => void signup(event)}><label>E-mail<input type="email" value={signupEmail} onChange={event => setSignupEmail(event.target.value)} required /></label>
      <label>Senha<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label><button>Criar conta</button></form></>}
    {message && <p role="status">{message}</p>}</section></main>
}
