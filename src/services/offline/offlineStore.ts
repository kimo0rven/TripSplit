/**
 * Offline support for the Firebase Realtime Database.
 *
 * The Firebase JavaScript SDK keeps no copy of the data on disk, so with no
 * network it cannot answer a read at all - and a read that is waiting on the
 * network simply hangs. This module adds the three pieces that make the app
 * usable without a connection:
 *
 *   1. a saved copy of every read, kept on the device;
 *   2. a saved copy is served when the network is missing or slow;
 *   3. writes made while offline wait in a queue and are sent on reconnect.
 *
 * Reads are cached as the *raw* tree Firebase returns (not the shaped result),
 * so a queued write can be folded into the saved copy and the screen shows the
 * change straight away, before the server ever sees it.
 */

import { db } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, onValue, ref, update } from 'firebase/database';

const CACHE_PREFIX = 'tripsplit:cache:';
const CACHE_INDEX_KEY = 'tripsplit:cache-index';
const QUEUE_KEY = 'tripsplit:pending-writes';

/** Keeps the saved copy from growing without limit on a busy phone. */
const MAX_CACHE_ENTRIES = 150;

/** How long a read waits for the network before the saved copy is used. */
const READ_TIMEOUT_MS = 4000;

/** Writes are never waited on for long; a slow one is queued instead. */
const WRITE_TIMEOUT_MS = 8000;

type Tree = unknown;

interface CacheEntry {
  savedAt: string;
  value: Tree;
}

interface CacheIndexEntry {
  path: string;
  savedAt: string;
}

export interface PendingWrite {
  id: string;
  createdAt: string;
  /** The same multi-path object the app already hands to Firebase. */
  updates: Record<string, unknown>;
  /**
   * How many times the server has refused this change on permission grounds.
   * See `flushPendingWrites` for why a refusal is not retried forever.
   */
  permissionFailures?: number;
}

/* -------------------------------------------------------------------------- */
/* Connection state                                                            */
/* -------------------------------------------------------------------------- */

// Optimistic: assume there is a connection until Firebase says otherwise, so
// the very first screen is not shown as "offline" for a moment.
let connected = true;
let watching = false;
const listeners = new Set<(online: boolean) => void>();

/**
 * Starts watching Firebase's own connection flag.
 *
 * `.info/connected` is a special path the database maintains by itself: it is
 * true while the device can reach Firebase and false the moment it cannot.
 * It is readable without being signed in.
 */
export const startConnectionWatch = (): void => {
  if (watching) return;
  watching = true;

  try {
    onValue(
      ref(db, '.info/connected'),
      (snapshot) => {
        const next = snapshot.val() === true;
        if (next === connected) return;
        connected = next;
        listeners.forEach((listener) => listener(connected));
      },
      (error) => {
        // Without the flag the app still works - it just falls back to the
        // saved copy only when a read actually fails.
        console.warn('Could not watch the connection state:', error);
      },
    );
  } catch (error) {
    console.warn('Could not watch the connection state:', error);
  }
};

export const isConnected = (): boolean => connected;

/* -------------------------------------------------------------------------- */
/* Sign-in state                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Whether a user is signed in.
 *
 * The queue must not be sent before Firebase Auth has restored the session.
 * Every rule starts with `auth != null`, so a flush that runs during start-up
 * is refused for every entry - which is exactly the
 * `update at / failed: permission_denied` that filled the console.
 */
let authReady = false;

export const setAuthReady = (ready: boolean): void => {
  authReady = ready;
};

export const isAuthReady = (): boolean => authReady;

export const subscribeToConnection = (listener: (online: boolean) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How many times a refused change is retried before it is dropped.
 *
 * Small on purpose: the point is to stop one bad entry from holding up every
 * later change, not to keep insisting at a server that has already said no.
 */
const PERMISSION_DENIED_LIMIT = 3;

/** True when the server said "you may not write this", rather than "not yet". */
export const isPermissionDenied = (error: unknown): boolean => {
  const code = (error as { code?: unknown })?.code;
  const message = String((error as { message?: unknown })?.message ?? '');

  return (
    code === 'PERMISSION_DENIED' ||
    code === 'permission-denied' ||
    /PERMISSION_DENIED|permission_denied/i.test(message)
  );
};

/**
 * Turns a failed save into words a person can act on.
 *
 * A refused write is the one case worth naming out loud: "try again" is a lie
 * when the server will refuse it every time, and the reason is the deployed
 * security rules rather than anything the person did wrong.
 */
export const saveErrorMessage = (
  error: unknown,
  fallback = 'That could not be saved. Try again.',
): string =>
  isPermissionDenied(error)
    ? 'The app is not allowed to save this yet. Update the database rules, then try again.'
    : fallback;

/** How many saved changes the server refused and that were dropped. */
let rejectedWrites = 0;

export const rejectedWriteCount = (): number => rejectedWrites;

/** Rejects after `ms` so a hanging network call cannot block a screen. */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for the network')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads one depth level out of a tree, e.g. `a/b` out of `{ a: { b: 1 } }`. */
const readDeep = (tree: Tree, parts: string[]): Tree | undefined => {
  let current: Tree = tree;
  for (const part of parts) {
    if (!isPlainObject(current)) return undefined;
    current = current[part];
    if (current === undefined) return undefined;
  }
  return current;
};

/** Writes one value at `a/b`, cloning only the branch it touches. */
const writeDeep = (tree: Tree, parts: string[], value: Tree): Tree => {
  const [head, ...rest] = parts;
  const base = isPlainObject(tree) ? { ...tree } : {};

  if (rest.length === 0) {
    // A null write is how Firebase deletes a key.
    if (value === null || value === undefined) {
      delete base[head];
    } else {
      base[head] = value;
    }
    return base;
  }

  base[head] = writeDeep(base[head], rest, value);
  return base;
};

/**
 * Folds one pending write into a saved tree.
 *
 * A write usually sits *below* the path being read (`trips/x/expenses/new`),
 * but it can also sit above it (`trips/x` when a whole trip is saved), so both
 * directions are handled.
 */
const applyUpdatesToTree = (
  basePath: string,
  tree: Tree,
  updates: Record<string, unknown>,
): Tree => {
  let result = tree;

  Object.entries(updates).forEach(([key, value]) => {
    if (key === basePath) {
      result = value;
      return;
    }

    if (key.startsWith(`${basePath}/`)) {
      const rest = key
        .slice(basePath.length + 1)
        .split('/')
        .filter(Boolean);
      result = writeDeep(result, rest, value);
      return;
    }

    if (basePath.startsWith(`${key}/`)) {
      const rest = basePath
        .slice(key.length + 1)
        .split('/')
        .filter(Boolean);
      const inside = readDeep(value, rest);

      // `null` here means "the branch this read lives in was deleted".
      result = inside === undefined ? result : inside;
    }
  });

  return result;
};

/* -------------------------------------------------------------------------- */
/* Locks                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Runs tasks one at a time.
 *
 * The saved index and the pending queue are each a single value that is read,
 * changed and written back. Several screens load at once (a trip list reads
 * every trip in parallel), so without this two callers read the same old value
 * and one of their changes is lost.
 */
const makeLock = () => {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
};

const withIndexLock = makeLock();
const withQueueLock = makeLock();

/* -------------------------------------------------------------------------- */
/* The saved copy                                                              */
/* -------------------------------------------------------------------------- */

const cacheKey = (path: string): string => `${CACHE_PREFIX}${path}`;

/**
 * The saved copies, kept in memory as well as on disk.
 *
 * Reading from disk is fast but still a wait of a few milliseconds, and every
 * screen visit used to pay it. Holding the same values in memory means a screen
 * that has been opened once can paint immediately.
 */
const memo = new Map<string, Tree>();

/** Paths being re-read in the background, so one path is fetched only once. */
const refreshing = new Set<string>();

// Screens listen here to hear that a path changed underneath them, so the
// background re-read below reaches the display instead of being thrown away.
const dataListeners = new Set<(path: string) => void>();

export const subscribeToDataRefresh = (listener: (path: string) => void): (() => void) => {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
};

const notifyDataRefresh = (path: string): void => {
  dataListeners.forEach((listener) => listener(path));
};

/**
 * Tells the screens watching a path that its saved copy changed.
 *
 * One screen visit reads a whole trip (the trip, its expenses, its
 * settlements...), and each can refresh in the background. Telling the screen
 * on every single one would make it reload several times over, so the paths are
 * collected and reported once.
 */
let queuedRefreshPaths: string[] = [];
let flushScheduled = false;

const queueDataRefresh = (path: string): void => {
  if (!queuedRefreshPaths.includes(path)) queuedRefreshPaths.push(path);
  if (flushScheduled) return;

  flushScheduled = true;
  setTimeout(() => {
    const paths = queuedRefreshPaths;
    queuedRefreshPaths = [];
    flushScheduled = false;
    paths.forEach(notifyDataRefresh);
  }, 0);
};

/**
 * Asks the network for a path whose saved copy has already been shown.
 *
 * This is the quiet half of a read: the screen is already painted, and this
 * only re-paints it if the server really has something different. A failure
 * here says nothing about the saved copy, so it is simply dropped.
 *
 * The write on purpose is not `await`ed. `readPath` returns as soon as it has
 * the saved copy, and a caller writing it as `await readPath(...)` would
 * otherwise be held until the network answered - exactly the wait this removes.
 */
const refreshInBackground = (path: string): void => {
  if (!connected || refreshing.has(path)) return;
  refreshing.add(path);

  get(ref(db, path))
    .then((snapshot) => {
      const value = snapshot.exists() ? snapshot.val() : null;

      // Only a real difference is worth telling the screens about. Without this
      // check every read would announce a change, each announcement would load
      // the screen again, and the two would go round for ever.
      const before = JSON.stringify(memo.get(path) ?? null);
      if (JSON.stringify(value ?? null) === before) {
        // Same data: keep the newer saved copy, say nothing.
        return cacheSet(path, value);
      }

      // cacheSet updates the in-memory copy, saves it, and then tells the
      // screens - none of which the caller has to wait for.
      return cacheSet(path, value).then(() => queueDataRefresh(path));
    })
    .catch(() => undefined)
    .finally(() => {
      refreshing.delete(path);
    });
};

const readIndex = async (): Promise<CacheIndexEntry[]> => {
  const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY).catch(() => null);
  return safeParse<CacheIndexEntry[]>(raw) ?? [];
};

const writeIndex = async (entries: CacheIndexEntry[]): Promise<void> => {
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(entries)).catch(() => undefined);
};

export const cacheSet = async (path: string, value: Tree): Promise<void> => {
  memo.set(path, value);

  try {
    const entry: CacheEntry = { savedAt: new Date().toISOString(), value };
    await AsyncStorage.setItem(cacheKey(path), JSON.stringify(entry));

    await withIndexLock(async () => {
      const index = (await readIndex()).filter((item) => item.path !== path);
      index.unshift({ path, savedAt: entry.savedAt });

      // Oldest entries fall off the end once the list is full.
      const kept = index.slice(0, MAX_CACHE_ENTRIES);
      const dropped = index.slice(MAX_CACHE_ENTRIES);
      await Promise.all(
        dropped.map((item) => AsyncStorage.removeItem(cacheKey(item.path)).catch(() => undefined)),
      );

      await writeIndex(kept);
    });
  } catch (error) {
    // A missing saved copy only costs offline support; never break a save.
    console.warn('Could not save a copy of the data:', error);
  }
};

export const cacheGet = async (path: string): Promise<{ hit: boolean; value: Tree }> => {
  // Memory first: no wait at all for a path already read this session.
  if (memo.has(path)) return { hit: true, value: memo.get(path) };

  try {
    const raw = await AsyncStorage.getItem(cacheKey(path));
    const entry = safeParse<CacheEntry>(raw);
    if (!entry) return { hit: false, value: null };
    memo.set(path, entry.value);
    return { hit: true, value: entry.value };
  } catch {
    return { hit: false, value: null };
  }
};

/* -------------------------------------------------------------------------- */
/* The pending queue                                                           */
/* -------------------------------------------------------------------------- */

// The queue is read on every single read (to fold unsent changes into what the
// screen shows), so the last known copy is held here. Reading a list from disk
// on every screen paint would put back the very wait this work removed.
let pendingWritesMemo: PendingWrite[] | null = null;

export const loadPendingWrites = async (): Promise<PendingWrite[]> => {
  if (pendingWritesMemo) return pendingWritesMemo;

  const raw = await AsyncStorage.getItem(QUEUE_KEY).catch(() => null);
  pendingWritesMemo = safeParse<PendingWrite[]>(raw) ?? [];
  return pendingWritesMemo;
};

// Anything showing the queue (the offline banner) listens here, so it updates
// the moment a change is added rather than on the next screen visit.
const syncListeners = new Set<() => void>();

export const subscribeToSync = (listener: () => void): (() => void) => {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
};

const notifySync = (): void => {
  syncListeners.forEach((listener) => listener());
};

const savePendingWrites = async (entries: PendingWrite[]): Promise<void> => {
  pendingWritesMemo = entries;

  if (entries.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY).catch(() => undefined);
  } else {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries)).catch(() => undefined);
  }
  notifySync();
};

export const queueWrite = async (updates: Record<string, unknown>): Promise<void> => {
  await withQueueLock(async () => {
    const pending = await loadPendingWrites();
    pending.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      updates,
    });
    await savePendingWrites(pending);
  });
};

/**
 * Re-sends everything that was written while offline, oldest first.
 *
 * It stops at the first failure and keeps the rest: the queue order matters
 * (a trip is created before its first expense), so sending later entries while
 * an earlier one is stuck would put the data in the wrong order.
 */
export const flushPendingWrites = async (): Promise<number> => {
  // Nothing may be sent before sign-in: the rules refuse every unauthenticated
  // write, so the queue would be refused wholesale every few seconds.
  if (!authReady) return 0;

  // Two callers (coming back online and the retry timer) must not send the
  // same queued change twice.
  return withQueueLock(async () => {
    const pending = await loadPendingWrites();
    if (pending.length === 0) return 0;

    let sent = 0;
    const remaining: PendingWrite[] = [];

    for (let i = 0; i < pending.length; i += 1) {
      const entry = pending[i];
      if (remaining.length === 0) {
        try {
          await withTimeout(update(ref(db), entry.updates), WRITE_TIMEOUT_MS);
          sent += 1;
          continue;
        } catch (error) {
          // A refused change is not a slow network: retrying it forever would
          // block every later change behind it, so after a few tries it is set
          // aside and reported instead. Anything the user can simply redo.
          if (isPermissionDenied(error)) {
            const failures = (entry.permissionFailures ?? 0) + 1;

            if (failures >= PERMISSION_DENIED_LIMIT) {
              console.warn(
                'The server refused a saved change on every attempt, so it was dropped. It can be entered again:',
                error,
              );
              rejectedWrites += 1;
              notifySync();
              continue;
            }

            remaining.push({ ...entry, permissionFailures: failures });
            continue;
          }

          console.warn('A change made offline could not be sent yet:', error);
        }
      }
      remaining.push(entry);
    }

    await savePendingWrites(remaining);
    return sent;
  });
};

export const pendingCount = async (): Promise<number> => (await loadPendingWrites()).length;

/* -------------------------------------------------------------------------- */
/* Manual sync                                                                 */
/* -------------------------------------------------------------------------- */

// A forced sync is not the same as the quiet background work: the user pressed
// a button, so the screen shows a spinner and the button says so.
let syncing = false;
const syncingListeners = new Set<(syncing: boolean) => void>();

export const subscribeToSyncActivity = (listener: (syncing: boolean) => void): (() => void) => {
  syncingListeners.add(listener);
  return () => {
    syncingListeners.delete(listener);
  };
};

const setSyncing = (next: boolean): void => {
  if (syncing === next) return;
  syncing = next;
  syncingListeners.forEach((listener) => listener(syncing));
};

export interface SyncResult {
  online: boolean;
  /** How many waiting changes this press managed to send. */
  sent: number;
  /** How many are still waiting afterwards. */
  remaining: number;
  /** How many saved copies actually changed. */
  refreshed: number;
}

/**
 * Re-reads every saved path from the server.
 *
 * A normal read shows the phone's copy and asks the network in the background -
 * right for opening a page, wrong for a button labelled "sync": the user
 * pressed it to get the newest data, so this one waits for the answer.
 */
const refreshAllCachedPaths = async (): Promise<number> => {
  if (!connected) return 0;

  const index = await readIndex();
  let refreshed = 0;

  for (let i = 0; i < index.length; i += 1) {
    const item = index[i];

    try {
      const snapshot = await withTimeout(get(ref(db, item.path)), READ_TIMEOUT_MS);
      const value = snapshot.exists() ? snapshot.val() : null;
      const before = JSON.stringify(memo.get(item.path) ?? null);

      await cacheSet(item.path, value);

      if (JSON.stringify(value ?? null) !== before) {
        refreshed += 1;
        queueDataRefresh(item.path);
      }
    } catch {
      // A path that cannot be read keeps the copy already on the phone.
    }
  }

  return refreshed;
};

/**
 * Sends everything waiting and re-reads what is saved on the phone.
 *
 * One press does both halves of "sync", because either alone leaves the user
 * unsure: sending unsent changes while keeping stale reads looks exactly as
 * broken as fresh reads with changes still stuck in the queue.
 */
export const forceSync = async (): Promise<SyncResult> => {
  // Pressing again while one is running must not start a second pass.
  if (syncing) {
    return { online: connected, sent: 0, remaining: await pendingCount(), refreshed: 0 };
  }

  setSyncing(true);

  try {
    // Ask for Firebase's own flag now: the watcher can be a moment behind, and
    // a button press is the one time the answer has to be current.
    try {
      const snapshot = await withTimeout(get(ref(db, '.info/connected')), READ_TIMEOUT_MS);
      const next = snapshot.val() === true;

      if (next !== connected) {
        connected = next;
        listeners.forEach((listener) => listener(connected));
      }
    } catch {
      // Keep whatever the watcher last said.
    }

    if (!connected) {
      return { online: false, sent: 0, remaining: await pendingCount(), refreshed: 0 };
    }

    const sent = await flushPendingWrites();
    const refreshed = await refreshAllCachedPaths();

    return { online: true, sent, remaining: await pendingCount(), refreshed };
  } finally {
    setSyncing(false);
  }
};

/* -------------------------------------------------------------------------- */
/* Reads and writes used by the services                                       */
/* -------------------------------------------------------------------------- */

/**
 * Reads a path, using the saved copy when there is no network.
 *
 * Returns the raw tree (or null when the path is empty). Any write still in the
 * queue is folded in, so an expense added offline is visible immediately.
 */
export const readPath = async (
  path: string,
  options?: { timeoutMs?: number; allowCache?: boolean; preferCache?: boolean },
): Promise<Tree> => {
  const allowCache = options?.allowCache !== false;
  const preferCache = options?.preferCache !== false;

  // Offline: skip the network entirely rather than wait for a call that cannot
  // succeed. This is what makes the app feel instant with no connection.
  if (!connected) {
    const { hit, value } = await cacheGet(path);
    if (!hit && !allowCache) return null;
    return withPendingOverlay(path, hit ? value : null);
  }

  // A copy already on the phone is shown at once and the network is asked in
  // the background. Waiting for the network first is what made every page
  // switch show a spinner for data the phone already had.
  if (preferCache) {
    const { hit, value } = await cacheGet(path);
    if (hit) {
      refreshInBackground(path);
      return withPendingOverlay(path, value);
    }
  }

  try {
    const snapshot = await withTimeout(get(ref(db, path)), options?.timeoutMs ?? READ_TIMEOUT_MS);
    const value = snapshot.exists() ? snapshot.val() : null;
    await cacheSet(path, value);
    return withPendingOverlay(path, value);
  } catch (error) {
    const { hit, value } = await cacheGet(path);

    // A saved copy means the short timeout was just a slow network.
    if (hit) {
      console.warn('Reading from the network was slow, using the saved copy:', error);
      return withPendingOverlay(path, value);
    }

    // No saved copy at all: on a cold start Firebase may still be connecting,
    // so a short timeout must not be reported as "there is nothing here".
    try {
      const snapshot = await get(ref(db, path));
      const fresh = snapshot.exists() ? snapshot.val() : null;
      await cacheSet(path, fresh);
      return withPendingOverlay(path, fresh);
    } catch (retryError) {
      console.warn('Reading from the network failed and nothing is saved:', retryError);
      return null;
    }
  }
};

const withPendingOverlay = async (path: string, tree: Tree): Promise<Tree> => {
  const pending = await loadPendingWrites();
  if (pending.length === 0) return tree;

  return pending.reduce<Tree>(
    (current, entry) => applyUpdatesToTree(path, current, entry.updates),
    tree,
  );
};

/**
 * Saves one change. Offline (or on a slow connection) it waits in the queue
 * and is sent on reconnect, so nothing the user typed is ever lost.
 */
export const writeUpdates = async (
  updates: Record<string, unknown>,
): Promise<{ queued: boolean }> => {
  let queued = true;

  if (connected) {
    try {
      await withTimeout(update(ref(db), updates), WRITE_TIMEOUT_MS);
      queued = false;
    } catch (error) {
      // "Not allowed" is final: queueing it would retry a refused change for
      // ever and show the user a success that never happened. Passing it back
      // lets the screen say what is really wrong.
      if (isPermissionDenied(error)) {
        throw error;
      }

      console.warn('The network could not take this change, queueing it:', error);
    }
  }

  if (queued) {
    await queueWrite(updates);
  }

  // Keep the saved copy in step so the screen shows the change either way.
  await patchCache(updates);

  return { queued };
};

/** Rewrites every saved tree that the change touches. */
const patchCache = async (updates: Record<string, unknown>): Promise<void> => {
  const index = await readIndex();

  await Promise.all(
    index.map(async (item) => {
      const { hit, value } = await cacheGet(item.path);
      if (!hit) return;

      const next = applyUpdatesToTree(item.path, value, updates);
      if (next === value) return;

      // The in-memory copy has to move too, or the next screen visit would show
      // the old value again until the network caught up.
      memo.set(item.path, next);

      const entry: CacheEntry = { savedAt: item.savedAt, value: next };
      await AsyncStorage.setItem(cacheKey(item.path), JSON.stringify(entry)).catch(() => undefined);
    }),
  );
};

/** Saves a whole value at a path, the way `set()` does. */
export const writeAt = async (path: string, value: unknown): Promise<{ queued: boolean }> =>
  writeUpdates({ [path]: value });

/** Deletes a path, the way `remove()` does. */
export const removeAt = async (path: string): Promise<{ queued: boolean }> =>
  writeUpdates({ [path]: null });

/** A short id for a brand new record; works with no network. */
export const newId = (): string => {
  const random = Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}${random}`;
};

export interface CacheSize {
  /** How many saved reads are on the device. */
  entries: number;
  /** Rough size on disk, in bytes. */
  bytes: number;
}

/**
 * How much offline data the device is holding, for the Settings screen.
 *
 * The byte count is an estimate: a string's length is a fair stand-in for a
 * small JSON tree, and an exact figure would mean decoding every entry again.
 */
export const cacheSize = async (): Promise<CacheSize> => {
  const index = await readIndex();
  let bytes = 0;

  for (const item of index) {
    const raw = await AsyncStorage.getItem(cacheKey(item.path)).catch(() => null);
    if (raw) bytes += raw.length * 2; // UTF-16: two bytes per character
  }

  return { entries: index.length, bytes };
};

/**
 * Throws away the saved copies of the data, keeping unsent changes.
 *
 * A cache clear must never cost someone a change they made while offline, so
 * the pending queue and the dropped-write count are left alone. The next visit
 * to each screen simply re-reads it from the server, which is why this is
 * offered as a way to free space rather than a fix for wrong data.
 */
export const clearCache = async (): Promise<{ cleared: number; keptWrites: number }> => {
  const pending = await loadPendingWrites().catch(() => []);

  try {
    memo.clear();

    const index = await readIndex();
    await Promise.all(
      index.map((item) => AsyncStorage.removeItem(cacheKey(item.path)).catch(() => undefined)),
    );
    await AsyncStorage.removeItem(CACHE_INDEX_KEY).catch(() => undefined);

    return { cleared: index.length, keptWrites: pending.length };
  } catch (error) {
    console.warn('Could not clear the saved copies:', error);
    return { cleared: 0, keptWrites: pending.length };
  }
};

/** Wipes everything saved for one user, used when signing out. */
export const clearOfflineData = async (): Promise<void> => {
  try {
    memo.clear();
    pendingWritesMemo = null;
    rejectedWrites = 0;
    const index = await readIndex();
    await Promise.all(
      index.map((item) => AsyncStorage.removeItem(cacheKey(item.path)).catch(() => undefined)),
    );
    await AsyncStorage.multiRemove([CACHE_INDEX_KEY, QUEUE_KEY]);
  } catch (error) {
    console.warn('Could not clear the saved data:', error);
  }
};
