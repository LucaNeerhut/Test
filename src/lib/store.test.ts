import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import type { AppState } from './model'
import { seedState } from './seed'

type StateRecord = { version: number; revision?: number; state: AppState }

async function tab() {
  // Each imported module has its own loaded revision, like separate tabs,
  // while both use the same actual IndexedDB factory and transaction scheduler.
  vi.resetModules()
  return import('./store')
}

async function rawRecord(write?: StateRecord): Promise<StateRecord | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('gather-albums', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('app')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction('app', write ? 'readwrite' : 'readonly')
      const store = transaction.objectStore('app')
      const request = write ? store.put(write, 'state') : store.get('state')
      transaction.oncomplete = () => { db.close(); resolve(write ?? request.result) }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  })
}

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('local album persistence', () => {
  it('initializes the demo atomically and shares simultaneous initial loads', async () => {
    const store = await tab()
    const first = store.loadState()
    const second = store.loadState()
    expect(first).toBe(second)
    const state = await first
    expect(state.albums).toHaveLength(7)
    expect(await rawRecord()).toEqual({ version: 1, revision: 0, state })
  })

  it('preserves sequential edits and reads them from a fresh tab', async () => {
    const first = await tab()
    const state = await first.loadState()
    const edited = { ...state, settings: { ...state.settings, reminders: true } }
    const withNote = { ...edited, notes: { 'your-october': [{ id: 'note', text: 'Keep this.', createdAt: '2026-11-01T00:00:00Z' }] } }
    // Even callers without their own save queue preserve invocation order.
    await Promise.all([first.saveState(edited), first.saveState(withNote)])
    expect((await rawRecord())?.revision).toBe(2)
    const fresh = await tab()
    expect(await fresh.loadState()).toEqual(withNote)
  })

  it('upgrades existing version-one records without losing their data', async () => {
    const state = seedState()
    state.albums[0].title = 'An existing collection'
    await rawRecord({ version: 1, state })
    const store = await tab()
    expect(await store.loadState()).toEqual(state)
    const edited = { ...state, savedAlbumIds: [state.albums[0].id] }
    await store.saveState(edited)
    expect(await rawRecord()).toEqual({ version: 1, revision: 1, state: edited })
  })

  it('rejects a stale tab without overwriting newer albums or notes', async () => {
    const first = await tab()
    const firstState = await first.loadState()
    const stale = await tab()
    const staleState = await stale.loadState()
    const winner = { ...firstState, notes: { 'your-october': [{ id: 'new', text: 'A newer memory', createdAt: '2026-11-01T00:00:00Z' }] } }
    await first.saveState(winner)
    await expect(stale.saveState({ ...staleState, savedAlbumIds: ['your-october'] })).rejects.toBeInstanceOf(stale.StorageConflictError)
    expect((await rawRecord())?.state).toEqual(winner)
    // A blind retry must keep failing until the stale tab explicitly reloads.
    await expect(stale.saveState(staleState)).rejects.toBeInstanceOf(stale.StorageConflictError)
    expect(await stale.loadState()).toEqual(winner)
    await stale.saveState({ ...winner, savedAlbumIds: ['your-october'] })
    expect((await rawRecord())?.revision).toBe(2)
  })

  it('allows exactly one simultaneous writer from the same revision', async () => {
    const first = await tab()
    const second = await tab()
    const [a, b] = await Promise.all([first.loadState(), second.loadState()])
    const aEdit = { ...a, savedAlbumIds: ['sophie-october'] }
    const bEdit = { ...b, savedAlbumIds: ['james-coast'] }
    const results = await Promise.allSettled([first.saveState(aEdit), second.saveState(bEdit)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    expect(failure.reason.name).toBe('StorageConflictError')
    const saved = await rawRecord()
    expect(saved?.revision).toBe(1)
    expect(saved?.state.savedAlbumIds).toEqual(results[0].status === 'fulfilled' ? aEdit.savedAlbumIds : bEdit.savedAlbumIds)
  })

  it('does not reseed when two new tabs initialize the empty database together', async () => {
    const first = await tab()
    const second = await tab()
    const put = vi.spyOn(IDBObjectStore.prototype, 'put')
    await Promise.all([first.loadState(), second.loadState()])
    expect(put).toHaveBeenCalledTimes(1)
    expect((await rawRecord())?.revision).toBe(0)
  })

  it('preserves the previous record and revision after a simulated quota error, then retries', async () => {
    const store = await tab()
    const original = await store.loadState()
    const edited = { ...original, settings: { ...original.settings, reminders: true } }
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('The storage quota has been exceeded.', 'QuotaExceededError')
    })
    await expect(store.saveState(edited)).rejects.toMatchObject({ name: 'QuotaExceededError' })
    put.mockRestore()
    expect(await rawRecord()).toEqual({ version: 1, revision: 0, state: original })
    await store.saveState(edited)
    expect(await rawRecord()).toEqual({ version: 1, revision: 1, state: edited })
  })

  it('does not cache a failed initial load or replace unsupported saved data', async () => {
    const state = seedState()
    await rawRecord({ version: 99, revision: 3, state })
    const store = await tab()
    await expect(store.loadState()).rejects.toThrow('unsupported format')
    expect((await rawRecord())?.version).toBe(99)
    await rawRecord({ version: 1, revision: 3, state })
    expect(await store.loadState()).toEqual(state)
    await store.saveState({ ...state, savedAlbumIds: ['your-october'] })
    expect((await rawRecord())?.revision).toBe(4)
  })
})
