import { describe, expect, it } from 'vitest'
import { normalizeYoutubeUrl, youtubeThumbnailUrl } from './workouts'

describe('link de vídeo do YouTube', () => {
  it('normaliza formatos comuns para um único endereço', () => {
    expect(normalizeYoutubeUrl('https://youtu.be/dQw4w9WgXcQ?t=40')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(normalizeYoutubeUrl('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('rejeita domínios parecidos, links sem HTTPS e IDs inválidos', () => {
    expect(() => normalizeYoutubeUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toThrow()
    expect(() => normalizeYoutubeUrl('http://youtube.com/watch?v=dQw4w9WgXcQ')).toThrow()
    expect(() => normalizeYoutubeUrl('https://youtu.be/invalido')).toThrow()
  })

  it('gera uma prévia leve apenas para vídeos públicos válidos', () => {
    expect(youtubeThumbnailUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
    expect(youtubeThumbnailUrl('storage:tenant/exercicio/video.mp4')).toBeNull()
    expect(youtubeThumbnailUrl('https://example.com/video')).toBeNull()
  })
})
