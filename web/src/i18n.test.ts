import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setLang, useI18n } from './i18n'

afterEach(() => act(() => setLang('en')))

describe('i18n', () => {
  it('interpolates params', () => {
    const { result } = renderHook(() => useI18n())
    expect(result.current.t('freeSeats', { n: 3 })).toBe('free seats: 3')
  })

  it('switches language, re-renders and remembers the choice', () => {
    const { result } = renderHook(() => useI18n())
    act(() => setLang('fr'))
    expect(result.current.lang).toBe('fr')
    expect(result.current.t('join')).toBe('rejoindre')
    expect(document.documentElement.lang).toBe('fr')
    expect(localStorage.getItem('treachery:lang')).toBe('fr')
  })

  it('translates the role inside a server error', () => {
    const { result } = renderHook(() => useI18n())
    act(() => setLang('fr'))
    const msg = result.current.error({ code: 'notEnoughIdentities', params: { role: 'Traitor', have: 1, need: 2 } })
    expect(msg).toBe("Pas assez d'identités Traître avec ces raretés (1 pour 2).")
  })

  it('falls back on an unknown error code instead of showing a raw key', () => {
    const { result } = renderHook(() => useI18n())
    expect(result.current.error({ code: 'brandNew' })).toBe('Something went wrong (brandNew).')
  })

  it('has no hint for rarities without one', () => {
    const { result } = renderHook(() => useI18n())
    expect(result.current.rarityHint('R')).toBe('')
    expect(result.current.rarityHint('U')).toBe('best for beginners')
  })
})
