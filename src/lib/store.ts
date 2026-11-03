import type { AppState } from './model'
import { seedState } from './seed'

const DATABASE = 'gather-albums'
const STORE = 'app'
const KEY = 'state'
let database: Promise<IDBDatabase> | undefined
let loadedRevision: number | undefined
let loading: Promise<AppState> | undefined
let operations: Promise<void> = Promise.resolve()

interface StoredState {
  version: number
  revision?: number
  state: AppState
}

export class StorageConflictError extends Error {
  constructor() {
    super('Another Gather tab has saved newer changes. Reload this tab to see them before making more changes.')
    this.name = 'StorageConflictError'
  }
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation)
  operations = result.then(() => {}, () => {})
  return result
}

function revisionOf(stored: StoredState): number {
  if (stored.version !== 1 || !stored.state || !Array.isArray(stored.state.albums) || !Array.isArray(stored.state.circles)
    || (stored.revision !== undefined && (!Number.isSafeInteger(stored.revision) || stored.revision < 0))) {
    throw new Error('Your saved album data uses an unsupported format. Your data has been kept on this device.')
  }
  return stored.revision ?? 0
}

function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('This browser does not support local album storage. Please use a current browser.'))
        return
      }
      const request = indexedDB.open(DATABASE, 1)
      let blocked = false
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => {
        const db = request.result
        if (blocked) { db.close(); return }
        db.onversionchange = () => { db.close(); database = undefined }
        resolve(db)
      }
      request.onerror = () => reject(request.error ?? new Error('Could not open local album storage.'))
      request.onblocked = () => {
        blocked = true
        reject(new Error('Album storage is being updated. Close other tabs and reload.'))
      }
    }).catch(error => { database = undefined; throw error })
  }
  return database
}

export function saveState(state: AppState): Promise<void> {
  return enqueue(async () => {
    const db = await openDatabase()
    if (loadedRevision === undefined) throw new Error('Load your albums before saving changes.')
    const expectedRevision = loadedRevision
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      const request = store.get(KEY)
      let failure: Error | DOMException | null = null
      request.onsuccess = () => {
        try {
          const stored: StoredState | undefined = request.result
          // Reading and comparing inside this same write transaction makes the
          // check atomic across tabs, including simultaneous saves.
          if (!stored || revisionOf(stored) !== expectedRevision) throw new StorageConflictError()
          store.put({ version: 1, revision: expectedRevision + 1, state }, KEY)
        } catch (error) {
          failure = error instanceof Error ? error : new Error('Could not save your changes locally.')
          transaction.abort()
        }
      }
      transaction.oncomplete = () => { loadedRevision = expectedRevision + 1; resolve() }
      transaction.onerror = event => { failure ??= (event.target as IDBRequest).error ?? transaction.error }
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Saving was interrupted. Your device may be out of storage.'))
    })
  })
}

async function readOrInitialize(): Promise<AppState> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    // A write transaction is also necessary for the first read: a second tab
    // must observe the first tab's initial record instead of reseeding over it.
    const transaction = db.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    const request = store.get(KEY)
    let state: AppState
    let revision: number
    let failure: Error | DOMException | null = null
    request.onsuccess = () => {
      try {
        const stored: StoredState | undefined = request.result
        if (stored === undefined) {
          state = seedState()
          revision = 0
          store.put({ version: 1, revision, state }, KEY)
        } else {
          revision = revisionOf(stored)
          state = stored.state
        }
      } catch (error) {
        failure = error instanceof Error ? error : new Error('Could not load your local albums.')
        transaction.abort()
      }
    }
    transaction.oncomplete = () => { loadedRevision = revision; resolve(state) }
    transaction.onerror = event => { failure ??= (event.target as IDBRequest).error ?? transaction.error }
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Loading your albums was interrupted.'))
  })
}

export function loadState(): Promise<AppState> {
  if (!loading) {
    const pending = enqueue(readOrInitialize)
    loading = pending
    const clear = () => { if (loading === pending) loading = undefined }
    void pending.then(clear, clear)
  }
  return loading
}
