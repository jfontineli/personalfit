import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { IdentityApp } from './app/IdentityApp'
import { routes } from './routes/routes'
import './style.css'

registerSW({ immediate: true })
createRoot(document.getElementById('root')!).render(<React.StrictMode>{window.location.pathname === routes.diagnostics ? <App /> : <IdentityApp />}</React.StrictMode>)
