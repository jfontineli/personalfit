import { describe, expect, it } from 'vitest'
import { safeActivationReturn } from './routes'

describe('retorno após login', () => {
  const token = 'a'.repeat(64)

  it('retorna somente aos convites locais de aluno e personal', () => {
    expect(safeActivationReturn(`/ativar#token=${token}`)).toBe(`/ativar#token=${token}`)
    expect(safeActivationReturn(`/ativar-profissional#token=${token}`)).toBe(`/ativar-profissional#token=${token}`)
  })

  it('recusa destinos externos, caminhos arbitrários e convites malformados', () => {
    for (const value of [null, '//outro-site.com', 'https://outro-site.com', '/admin', '/ativar#token=curto', `/ativar#token=${token}?next=//outro-site.com`]) {
      expect(safeActivationReturn(value)).toBe('/app')
    }
  })
})
