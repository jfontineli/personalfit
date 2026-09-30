import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { App } from './App'

it('mostra diagnóstico e prova gravação local pela interface', async () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Diagnóstico da aplicação' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Testar IndexedDB' }))
  await waitFor(() => expect(screen.getByText(/Gravação local: OK/)).toBeInTheDocument())
})
