import { useState, type ReactNode } from 'react'
import { codeFromUrl, useRoom } from './useRoom'
import type { Card, Rarity, Role, RoomView } from './types'

const ROLE_FR: Record<Role, string> = { Leader: 'Leader', Traitor: 'Traître', Assassin: 'Assassin', Guardian: 'Gardien' }
const RARITIES: { id: Rarity; label: string; hint?: string }[] = [
  { id: 'U', label: 'Peu commune', hint: 'idéal pour débuter' },
  { id: 'R', label: 'Rare' },
  { id: 'M', label: 'Mythique' },
  { id: 'S', label: 'Spéciale', hint: 'Traîtres chaotiques' },
]
const NICK_KEY = 'treachery:nickname'

function storedNick() {
  try {
    return localStorage.getItem(NICK_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function App() {
  const r = useRoom()

  let screen: ReactNode
  if (r.kicked) {
    screen = <p className="notice">Ta place est ouverte sur un autre appareil.</p>
  } else if (!r.room || !r.playerId) {
    screen = <Home connected={r.connected} send={r.send} />
  } else if (r.room.phase === 'lobby') {
    screen = <Lobby room={r.room} playerId={r.playerId} send={r.send} />
  } else {
    screen = <Game room={r.room} playerId={r.playerId} me={r.me} send={r.send} />
  }

  return (
    <main>
      <header>
        <h1>Treachery</h1>
        {r.room && (
          <button className="link" onClick={r.leave}>
            Quitter
          </button>
        )}
      </header>
      {!r.connected && !r.kicked && <p className="notice">Connexion…</p>}
      {r.error && <p className="error">{r.error}</p>}
      {screen}
      <footer>
        Identités et illustrations :{' '}
        <a href="https://mtgtreachery.net/fr/" target="_blank" rel="noreferrer">
          mtgtreachery.net
        </a>
        , chaque illustration appartient à son artiste. Magic: The Gathering © Wizards of the Coast. Projet non officiel.
      </footer>
    </main>
  )
}

type Send = ReturnType<typeof useRoom>['send']

function Home({ connected, send }: { connected: boolean; send: Send }) {
  const [nickname, setNickname] = useState(storedNick)
  const [code, setCode] = useState(codeFromUrl)
  const [playerCount, setPlayerCount] = useState(5)
  const [rarities, setRarities] = useState<Rarity[]>(['U', 'R', 'M'])
  const nick = nickname.trim()

  const remember = () => {
    try {
      localStorage.setItem(NICK_KEY, nick)
    } catch {}
  }
  const toggle = (id: Rarity) => setRarities((rs) => (rs.includes(id) ? rs.filter((x) => x !== id) : [...rs, id]))

  return (
    <>
      <label className="field">
        Ton pseudo
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} autoComplete="nickname" />
      </label>

      <section className="panel">
        <h2>Rejoindre une room</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            remember()
            send({ type: 'join', code: code.toUpperCase(), nickname: nick })
          }}
        >
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            maxLength={4}
            placeholder="CODE"
            autoCapitalize="characters"
            aria-label="Code de la room"
          />
          <button disabled={!connected || !nick || code.length !== 4}>Rejoindre</button>
        </form>
      </section>

      <section className="panel">
        <h2>Créer une room</h2>
        <p className="label">Nombre de joueurs</p>
        <div className="segmented">
          {[4, 5, 6, 7, 8].map((n) => (
            <button key={n} className={n === playerCount ? 'on' : ''} onClick={() => setPlayerCount(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="label">Raretés des identités</p>
        {RARITIES.map((x) => (
          <label key={x.id} className="check">
            <input type="checkbox" checked={rarities.includes(x.id)} onChange={() => toggle(x.id)} />
            <span>
              {x.label} {x.hint && <small>({x.hint})</small>}
            </span>
          </label>
        ))}
        <button
          className="primary"
          disabled={!connected || !nick || rarities.length === 0}
          onClick={() => {
            remember()
            send({ type: 'create', nickname: nick, playerCount, rarities })
          }}
        >
          Créer la room
        </button>
      </section>
    </>
  )
}

function Players({ room, playerId, showReady }: { room: RoomView; playerId: string; showReady: boolean }) {
  return (
    <ul className="players">
      {room.players.map((p) => (
        <li key={p.id} className={p.connected ? '' : 'away'}>
          <span>
            {p.name}
            {p.id === playerId && ' (toi)'}
            {p.id === room.hostId && ' 👑'}
          </span>
          {showReady && <span>{p.ready ? '✅ prêt' : '…'}</span>}
          {!p.connected && <small>déconnecté</small>}
        </li>
      ))}
    </ul>
  )
}

function Lobby({ room, playerId, send }: { room: RoomView; playerId: string; send: Send }) {
  const me = room.players.find((p) => p.id === playerId)
  const isHost = room.hostId === playerId
  const full = room.players.length === room.settings.playerCount
  const allReady = full && room.players.every((p) => p.ready)
  const url = `${location.origin}/r/${room.code}`
  const [copied, setCopied] = useState(false)

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Treachery', url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    }
  }

  return (
    <>
      <section className="panel center">
        <p className="label">Code de la room</p>
        <p className="code">{room.code}</p>
        <button onClick={share}>{copied ? 'Lien copié ✓' : 'Partager le lien'}</button>
      </section>

      <section className="panel">
        <h2>
          Joueurs {room.players.length}/{room.settings.playerCount}
        </h2>
        <Players room={room} playerId={playerId} showReady />
        <p className="muted">
          Raretés : {room.settings.rarities.map((id) => RARITIES.find((x) => x.id === id)?.label).join(', ')}
        </p>
      </section>

      <button className={me?.ready ? '' : 'primary'} onClick={() => send({ type: 'ready', value: !me?.ready })}>
        {me?.ready ? 'Je ne suis plus prêt' : 'Je suis prêt'}
      </button>
      {isHost && (
        <button className="primary" disabled={!allReady} onClick={() => send({ type: 'start' })}>
          {allReady ? 'Lancer le tirage' : full ? 'En attente des joueurs prêts' : 'En attente de joueurs'}
        </button>
      )}
    </>
  )
}

function CardFace({ card }: { card: Card }) {
  return (
    <figure className="card">
      <img src={`/cards/${card.id}.jpg`} alt={card.name} draggable={false} />
      <figcaption>Illustration : {card.artist}</figcaption>
    </figure>
  )
}

function Game({ room, playerId, me, send }: { room: RoomView; playerId: string; me: Card | null; send: Send }) {
  const [shown, setShown] = useState(false)
  const leaderName = room.players.find((p) => p.id === room.leader?.playerId)?.name
  const iAmLeader = room.leader?.playerId === playerId

  return (
    <>
      {room.leader && (
        <section className="panel leader">
          <h2>{iAmLeader ? 'Tu es le Leader' : `Leader : ${leaderName}`}</h2>
          <CardFace card={room.leader.card} />
        </section>
      )}

      {me && !iAmLeader && (
        <section className="panel center">
          <h2>Ton identité secrète</h2>
          <div
            className={`secret ${shown ? 'shown' : ''}`}
            onPointerDown={() => setShown(true)}
            onPointerUp={() => setShown(false)}
            onPointerLeave={() => setShown(false)}
            onPointerCancel={() => setShown(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <p className="hold">Maintiens appuyé pour voir ta carte</p>
            {/* always rendered so the image is loaded before the first reveal */}
            <div className="reveal" aria-hidden={!shown}>
              <p className={`role role-${me.role}`}>{ROLE_FR[me.role]}</p>
              <CardFace card={me} />
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Joueurs</h2>
        <Players room={room} playerId={playerId} showReady={false} />
      </section>

      {room.hostId === playerId && (
        <button onClick={() => confirm('Relancer une nouvelle partie ?') && send({ type: 'reset' })}>Nouvelle partie</button>
      )}
    </>
  )
}
