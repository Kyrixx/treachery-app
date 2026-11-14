import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeSocket } from './test/fakeSocket'
import type { RoomView } from './types'

const card = { id: 7, name: 'The Oracle', role: 'Guardian' as const, rarity: 'U' as const, artist: 'Someone' }
const leaderCard = { id: 62, name: 'The Void Tyrant', role: 'Leader' as const, rarity: 'M' as const, artist: 'Other' }

const playing: RoomView = {
  type: 'room',
  code: 'ABCD',
  phase: 'playing',
  hostId: 'p2',
  settings: { playerCount: 4, rarities: ['U', 'M'] },
  players: [
    { id: 'p1', name: 'Alice', ready: true, connected: true },
    { id: 'p2', name: 'Bob', ready: true, connected: true },
  ],
  leader: { playerId: 'p2', card: leaderCard },
}

beforeEach(() => {
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  localStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

function startGame() {
  render(<App />)
  act(() => {
    const sock = FakeSocket.last
    sock.serverOpen()
    sock.serverSend({ type: 'welcome', code: 'ABCD', playerId: 'p1', token: 't' })
    sock.serverSend(playing)
    sock.serverSend({ type: 'you', role: 'Guardian', card })
  })
}

describe('Game screen', () => {
  it('shows the Leader to everyone, with artist credit on the full card', () => {
    startGame()
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('The Void Tyrant')).toBeTruthy()
    const full = screen.getByText('leader: Bob').closest('.reveal')!
    expect(full.className).not.toContain('shown')
    fireEvent.click(screen.getByText('See'))
    expect(full.className).toContain('shown')
    expect(screen.getByText('062/062 · m · ill. Other')).toBeTruthy()
  })

  it('reveals the secret card only while held', () => {
    startGame()
    const secret = screen.getByText('Hold to reveal').parentElement!
    const reveal = screen.getByText('your identity').closest('.reveal')!
    expect(reveal.className).not.toContain('shown')

    fireEvent.pointerDown(secret)
    expect(reveal.className).toContain('shown')
    expect(screen.getByText('Guardian')).toBeTruthy()
    expect(screen.getByText('007/062 · u · ill. Someone')).toBeTruthy()

    fireEvent.pointerUp(secret)
    expect(reveal.className).not.toContain('shown')
  })

  it('hides the secret card again when the finger slides off', () => {
    startGame()
    const secret = screen.getByText('Hold to reveal').parentElement!
    const reveal = screen.getByText('your identity').closest('.reveal')!
    fireEvent.pointerDown(secret)
    fireEvent.pointerLeave(secret)
    expect(reveal.className).not.toContain('shown')
  })
})
