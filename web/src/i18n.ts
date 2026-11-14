import { useSyncExternalStore } from 'react'
import type { AppError, Rarity, Role } from './types'

const en = {
  connecting: 'Connecting…',
  leave: 'Leave',
  kicked: 'Your seat is open on another device.',
  nickname: 'Your nickname',
  joinTitle: 'Join a room',
  codePlaceholder: 'CODE',
  roomCode: 'Room code',
  join: 'Join',
  createTitle: 'Create a room',
  playerCount: 'Number of players',
  rarities: 'Identity rarities',
  create: 'Create room',
  you: '(you)',
  ready: '✅ ready',
  disconnected: 'disconnected',
  shareLink: 'Share link',
  linkCopied: 'Link copied ✓',
  players: 'Players',
  playersCount: 'Players {n}/{max}',
  raritiesList: 'Rarities: {list}',
  imReady: "I'm ready",
  notReadyAnymore: "I'm not ready anymore",
  startDraw: 'Start the draw',
  waitingReady: 'Waiting for everyone to be ready',
  waitingPlayers: 'Waiting for players',
  illustration: 'Illustration: {artist}',
  youAreLeader: 'You are the Leader',
  leaderIs: 'Leader: {name}',
  secretIdentity: 'Your secret identity',
  holdToReveal: 'Press and hold to see your card',
  newGame: 'New game',
  confirmNewGame: 'Start a new game?',
  credits: 'Identities and artwork from {site}; each illustration belongs to its artist. Magic: The Gathering © Wizards of the Coast. Unofficial project.',
  role_Leader: 'Leader',
  role_Traitor: 'Traitor',
  role_Assassin: 'Assassin',
  role_Guardian: 'Guardian',
  rarity_U: 'Uncommon',
  rarity_R: 'Rare',
  rarity_M: 'Mythic',
  rarity_S: 'Special',
  rarityHint_U: 'best for beginners',
  rarityHint_S: 'chaotic Traitors',
  error_invalidPlayerCount: 'The number of players must be between 4 and 8.',
  error_noRarity: 'Pick at least one rarity.',
  error_unknownRarity: 'Unknown rarity: {rarity}.',
  error_notEnoughIdentities: 'Not enough {role} identities with these rarities ({have} for {need}).',
  error_invalidNickname: 'Your nickname must be 1 to 20 characters long.',
  error_roomNotFound: 'Room not found.',
  error_gameStarted: 'The game has already started.',
  error_roomFull: 'The room is full.',
  error_nicknameTaken: 'This nickname is already taken in the room.',
  error_seatNotFound: 'Seat not found in this room.',
  error_seatExpired: 'Your seat in the room has expired. Join it again.',
  error_roomNotFull: 'The room is not full.',
  error_notAllReady: 'Not everyone is ready.',
  error_unknown: 'Something went wrong ({code}).',
}

type Key = keyof typeof en

const fr: Record<Key, string> = {
  connecting: 'Connexion…',
  leave: 'Quitter',
  kicked: 'Ta place est ouverte sur un autre appareil.',
  nickname: 'Ton pseudo',
  joinTitle: 'Rejoindre une room',
  codePlaceholder: 'CODE',
  roomCode: 'Code de la room',
  join: 'Rejoindre',
  createTitle: 'Créer une room',
  playerCount: 'Nombre de joueurs',
  rarities: 'Raretés des identités',
  create: 'Créer la room',
  you: '(toi)',
  ready: '✅ prêt',
  disconnected: 'déconnecté',
  shareLink: 'Partager le lien',
  linkCopied: 'Lien copié ✓',
  players: 'Joueurs',
  playersCount: 'Joueurs {n}/{max}',
  raritiesList: 'Raretés : {list}',
  imReady: 'Je suis prêt',
  notReadyAnymore: 'Je ne suis plus prêt',
  startDraw: 'Lancer le tirage',
  waitingReady: 'En attente des joueurs prêts',
  waitingPlayers: 'En attente de joueurs',
  illustration: 'Illustration : {artist}',
  youAreLeader: 'Tu es le Leader',
  leaderIs: 'Leader : {name}',
  secretIdentity: 'Ton identité secrète',
  holdToReveal: 'Maintiens appuyé pour voir ta carte',
  newGame: 'Nouvelle partie',
  confirmNewGame: 'Relancer une nouvelle partie ?',
  credits: 'Identités et illustrations : {site}, chaque illustration appartient à son artiste. Magic: The Gathering © Wizards of the Coast. Projet non officiel.',
  role_Leader: 'Leader',
  role_Traitor: 'Traître',
  role_Assassin: 'Assassin',
  role_Guardian: 'Gardien',
  rarity_U: 'Peu commune',
  rarity_R: 'Rare',
  rarity_M: 'Mythique',
  rarity_S: 'Spéciale',
  rarityHint_U: 'idéal pour débuter',
  rarityHint_S: 'Traîtres chaotiques',
  error_invalidPlayerCount: 'Le nombre de joueurs doit être entre 4 et 8.',
  error_noRarity: 'Choisis au moins une rareté.',
  error_unknownRarity: 'Rareté inconnue : {rarity}.',
  error_notEnoughIdentities: "Pas assez d'identités {role} avec ces raretés ({have} pour {need}).",
  error_invalidNickname: 'Le pseudo doit faire entre 1 et 20 caractères.',
  error_roomNotFound: 'Room introuvable.',
  error_gameStarted: 'La partie a déjà commencé.',
  error_roomFull: 'La room est pleine.',
  error_nicknameTaken: 'Ce pseudo est déjà pris dans la room.',
  error_seatNotFound: 'Place introuvable dans cette room.',
  error_seatExpired: 'Ta place dans la room a expiré. Rejoins-la à nouveau.',
  error_roomNotFull: "La room n'est pas pleine.",
  error_notAllReady: "Tout le monde n'est pas prêt.",
  error_unknown: 'Une erreur est survenue ({code}).',
}

const dicts = { en, fr }
export type Lang = keyof typeof dicts
export const LANGS = Object.keys(dicts) as Lang[]
const LANG_KEY = 'treachery:lang'

let lang: Lang = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && saved in dicts) return saved as Lang
  } catch {}
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
})()
document.documentElement.lang = lang

const listeners = new Set<() => void>()

export function setLang(next: Lang) {
  lang = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(LANG_KEY, next)
  } catch {}
  listeners.forEach((l) => l())
}

type Params = Record<string, string | number>

function translate(key: Key, params: Params = {}) {
  return dicts[lang][key].replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? `{${p}}`))
}

export function useI18n() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => lang,
  )
  const t = translate
  return {
    lang: current,
    t,
    role: (r: Role) => t(`role_${r}`),
    rarity: (r: Rarity) => t(`rarity_${r}`),
    rarityHint: (r: Rarity) => (`rarityHint_${r}` in en ? t(`rarityHint_${r}` as Key) : ''),
    error: (e: AppError) => {
      const key = `error_${e.code}`
      if (!(key in en)) return t('error_unknown', { code: e.code })
      const params = { ...e.params }
      if (typeof params.role === 'string') params.role = t(`role_${params.role as Role}`)
      return t(key as Key, params)
    },
  }
}
