import { useState, type ReactNode } from 'react'
import { codeFromUrl, useRoom } from './useRoom'
import { LANGS, setLang, useI18n } from './i18n'
import type { Card, Rarity, RoomView } from './types'

const RARITIES: Rarity[] = ['U', 'R', 'M', 'S']
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
  const { t, lang, error } = useI18n()
  const [creditsBefore, creditsAfter] = t('credits').split('{site}')

  let screen: ReactNode
  if (r.kicked) {
    screen = <p className="notice">{t('kicked')}</p>
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
            {t('leave')}
          </button>
        )}
      </header>
      {!r.connected && !r.kicked && <p className="notice">{t('connecting')}</p>}
      {r.error && <p className="error">{error(r.error)}</p>}
      {screen}
      <footer>
        <p>
          {creditsBefore}
          <a href={`https://mtgtreachery.net/${lang}/`} target="_blank" rel="noreferrer">
            mtgtreachery.net
          </a>
          {creditsAfter}
        </p>
        <p className="langs">
          {LANGS.map((l) => (
            <button key={l} className={`link ${l === lang ? 'on' : ''}`} onClick={() => setLang(l)} aria-pressed={l === lang}>
              {l.toUpperCase()}
            </button>
          ))}
        </p>
      </footer>
    </main>
  )
}

type Send = ReturnType<typeof useRoom>['send']

function Home({ connected, send }: { connected: boolean; send: Send }) {
  const { t, rarity, rarityHint } = useI18n()
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
        {t('nickname')}
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} autoComplete="nickname" />
      </label>

      <section className="panel">
        <h2>{t('joinTitle')}</h2>
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
            placeholder={t('codePlaceholder')}
            autoCapitalize="characters"
            aria-label={t('roomCode')}
          />
          <button disabled={!connected || !nick || code.length !== 4}>{t('join')}</button>
        </form>
      </section>

      <section className="panel">
        <h2>{t('createTitle')}</h2>
        <p className="label">{t('playerCount')}</p>
        <div className="segmented">
          {[4, 5, 6, 7, 8].map((n) => (
            <button key={n} className={n === playerCount ? 'on' : ''} onClick={() => setPlayerCount(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="label">{t('rarities')}</p>
        {RARITIES.map((id) => (
          <label key={id} className="check">
            <input type="checkbox" checked={rarities.includes(id)} onChange={() => toggle(id)} />
            <span>
              {rarity(id)} {rarityHint(id) && <small>({rarityHint(id)})</small>}
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
          {t('create')}
        </button>
      </section>
    </>
  )
}

function Players({ room, playerId, showReady }: { room: RoomView; playerId: string; showReady: boolean }) {
  const { t } = useI18n()
  return (
    <ul className="players">
      {room.players.map((p) => (
        <li key={p.id} className={p.connected ? '' : 'away'}>
          <span>
            {p.name}
            {p.id === playerId && ` ${t('you')}`}
            {p.id === room.hostId && ' 👑'}
          </span>
          {showReady && <span>{p.ready ? t('ready') : '…'}</span>}
          {!p.connected && <small>{t('disconnected')}</small>}
        </li>
      ))}
    </ul>
  )
}

function Lobby({ room, playerId, send }: { room: RoomView; playerId: string; send: Send }) {
  const { t, rarity } = useI18n()
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
        <p className="label">{t('roomCode')}</p>
        <p className="code">{room.code}</p>
        <button onClick={share}>{copied ? t('linkCopied') : t('shareLink')}</button>
      </section>

      <section className="panel">
        <h2>{t('playersCount', { n: room.players.length, max: room.settings.playerCount })}</h2>
        <Players room={room} playerId={playerId} showReady />
        <p className="muted">{t('raritiesList', { list: room.settings.rarities.map(rarity).join(', ') })}</p>
      </section>

      <button className={me?.ready ? '' : 'primary'} onClick={() => send({ type: 'ready', value: !me?.ready })}>
        {me?.ready ? t('notReadyAnymore') : t('imReady')}
      </button>
      {isHost && (
        <button className="primary" disabled={!allReady} onClick={() => send({ type: 'start' })}>
          {allReady ? t('startDraw') : full ? t('waitingReady') : t('waitingPlayers')}
        </button>
      )}
    </>
  )
}

function CardFace({ card }: { card: Card }) {
  const { t } = useI18n()
  return (
    <figure className="card">
      <img src={`/cards/${card.id}.jpg`} alt={card.name} draggable={false} />
      <figcaption>{t('illustration', { artist: card.artist })}</figcaption>
    </figure>
  )
}

function Game({ room, playerId, me, send }: { room: RoomView; playerId: string; me: Card | null; send: Send }) {
  const { t, role } = useI18n()
  const [shown, setShown] = useState(false)
  const leaderName = room.players.find((p) => p.id === room.leader?.playerId)?.name
  const iAmLeader = room.leader?.playerId === playerId

  return (
    <>
      {room.leader && (
        <section className="panel leader">
          <h2>{iAmLeader ? t('youAreLeader') : t('leaderIs', { name: leaderName ?? '' })}</h2>
          <CardFace card={room.leader.card} />
        </section>
      )}

      {me && !iAmLeader && (
        <section className="panel center">
          <h2>{t('secretIdentity')}</h2>
          <div
            className={`secret ${shown ? 'shown' : ''}`}
            onPointerDown={() => setShown(true)}
            onPointerUp={() => setShown(false)}
            onPointerLeave={() => setShown(false)}
            onPointerCancel={() => setShown(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <p className="hold">{t('holdToReveal')}</p>
            {/* always rendered so the image is loaded before the first reveal */}
            <div className="reveal" aria-hidden={!shown}>
              <p className={`role role-${me.role}`}>{role(me.role)}</p>
              <CardFace card={me} />
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>{t('players')}</h2>
        <Players room={room} playerId={playerId} showReady={false} />
      </section>

      {room.hostId === playerId && (
        <button onClick={() => confirm(t('confirmNewGame')) && send({ type: 'reset' })}>{t('newGame')}</button>
      )}
    </>
  )
}
