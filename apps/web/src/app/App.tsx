import { useEffect, useState } from 'react'
import { TechnicalAuth } from '../modules/TechnicalAuth'
import { probeIndexedDb, getTechnicalRecord } from '../offline/db'
import { saveTechnicalRecord, listQueue } from '../offline/queue'
import { probeSupabase, supabase } from '../services/supabase'
import { syncTechnicalQueue } from '../services/technicalSync'
import { StatusRow } from '../shared/StatusRow'

export function App() {
  const [online, setOnline] = useState(navigator.onLine)
  const [dbReady, setDbReady] = useState<boolean | null>(null)
  const [api, setApi] = useState('verificando')
  const pwa = 'serviceWorker' in navigator ? 'disponível após build' : 'indisponível'
  const [localMessage, setLocalMessage] = useState('')

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    void probeIndexedDb().then(setDbReady)
    void probeSupabase().then(setApi)
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh) }
  }, [])

  async function testLocalStorage() {
    try {
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
      const operation = await saveTechnicalRecord('diagnóstico local', undefined, session?.user.id)
      const record = await getTechnicalRecord(operation.entityId)
      const queue = await listQueue()
      setLocalMessage(`Gravação local: ${record ? 'OK' : 'falhou'}. Fila pendente: ${queue.filter(item => item.status === 'PENDING').length}.`)
    } catch {
      setLocalMessage('Armazenamento local indisponível.')
    }
  }

  async function testTechnicalSync() {
    try {
      const result = await syncTechnicalQueue()
      setLocalMessage(`Sincronização técnica: ${result.synced} confirmada(s), ${result.pending} pendente(s).`)
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : 'Falha de sincronização técnica')
    }
  }

  return <main className="shell">
    <header><span className="eyebrow">PersonalFit · Fundação técnica</span><h1>Diagnóstico da aplicação</h1><p>Ambiente temporário para validar a infraestrutura do MVP.</p></header>
    <section className="panel" aria-label="Status técnico"><h2>Status</h2>
      <StatusRow label="Aplicação" value="ativa" />
      <StatusRow label="Conexão" value={online ? 'online' : 'offline'} />
      <StatusRow label="Supabase" value={api} />
      <StatusRow label="IndexedDB" value={dbReady === null ? 'verificando' : dbReady ? 'disponível' : 'indisponível'} />
      <StatusRow label="PWA" value={pwa} />
    </section>
    <TechnicalAuth />
    <section className="panel" aria-label="Armazenamento técnico"><h2>Teste local</h2><p>Grava uma entidade técnica e sua operação pendente em uma única transação.</p><button onClick={() => void testLocalStorage()}>Testar IndexedDB</button> <button onClick={() => void testTechnicalSync()}>Sincronizar teste técnico</button>{localMessage && <p role="status">{localMessage}</p>}</section>
  </main>
}
