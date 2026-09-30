import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../services/supabase'

export function TechnicalAuth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [identity, setIdentity] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void client.auth.getSession().then(({ data }) => setIdentity(data.session?.user.email ?? null))
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setIdentity(session?.user.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function login(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : 'Sessão iniciada')
    setPassword('')
  }

  async function logout() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    setMessage(error ? error.message : 'Sessão encerrada')
  }

  async function refresh() {
    if (!supabase) return
    const { error } = await supabase.auth.refreshSession()
    setMessage(error ? error.message : 'Sessão renovada')
  }

  return <section className="panel" aria-label="Autenticação técnica">
    <h2>Autenticação técnica</h2>
    {!supabase ? <p>Configure o Supabase local para habilitar login.</p> : identity ? <>
      <p data-testid="identity">Sessão ativa: {identity}</p>
      <button onClick={() => void refresh()}>Renovar sessão</button>{' '}
      <button onClick={() => void logout()}>Sair</button>
    </> : <form onSubmit={event => void login(event)}>
      <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
      <label>Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
      <button type="submit">Entrar</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </section>
}
