// Mirrors the Go wire format in room.go.
export type Rarity = 'U' | 'R' | 'M' | 'S'
export type Role = 'Leader' | 'Traitor' | 'Assassin' | 'Guardian'

export interface Card {
  id: number
  name: string
  role: Role
  rarity: Rarity
  artist: string
}

export interface Settings {
  playerCount: number
  rarities: Rarity[]
}

export interface PlayerView {
  id: string
  name: string
  ready: boolean
  connected: boolean
}

export interface RoomView {
  type: 'room'
  code: string
  phase: 'lobby' | 'playing'
  hostId: string
  settings: Settings
  players: PlayerView[]
  leader?: { playerId: string; card: Card }
}

export type ServerMsg =
  | { type: 'welcome'; code: string; playerId: string; token: string }
  | RoomView
  | { type: 'you'; role: Role; card: Card }
  | { type: 'error'; message: string }

export type ClientMsg =
  | { type: 'create'; nickname: string; playerCount: number; rarities: Rarity[] }
  | { type: 'join'; code: string; nickname: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'ready'; value: boolean }
  | { type: 'start' }
  | { type: 'reset' }
