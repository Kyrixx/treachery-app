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
  it('shows the Leader to everyone with artist credit', () => {
    startGame()
    expect(screen.getByText('Leader: Bob')).toBeTruthy()
    expect(screen.getByText('Illustration: Other')).toBeTruthy()
  })

  it('reveals the secret card only while held', () => {
    startGame()
    const secret = screen.getByText('Press and hold to see your card').parentElement!
    expect(secret.className).not.toContain('shown')

    fireEvent.pointerDown(secret)
    expect(secret.className).toContain('shown')
    expect(screen.getByText('Guardian')).toBeTruthy()

    fireEvent.pointerUp(secret)
    expect(secret.className).not.toContain('shown')
  })

  it('hides the secret card again when the finger slides off', () => {
    startGame()
    const secret = screen.getByText('Press and hold to see your card').parentElement!
    fireEvent.pointerDown(secret)
    fireEvent.pointerLeave(secret)
    expect(secret.className).not.toContain('shown')
  })
})
