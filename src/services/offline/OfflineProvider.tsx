import {
  flushPendingWrites,
  forceSync as runForceSync,
  pendingCount,
  rejectedWriteCount,
  setAuthReady,
  startConnectionWatch,
  subscribeToConnection,
  subscribeToSync,
  subscribeToSyncActivity,
  SyncResult,
} from '@/services/offline/offlineStore';
import { useAuth } from '@/services/Firebase/useAuth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Offline status for the whole app.
 *
 * Three things live here:
 *   - the on/off line state, so the profile can say what is happening;
 *   - the queue of changes made while offline, which is sent the moment the
 *     connection comes back and the user comes back to the app;
 *   - a manual sync, for the times the user would rather not wait.
 */

interface OfflineContextType {
  online: boolean;
  /** How many changes are still waiting to reach the server. */
  pendingWrites: number;
  /** How many saved changes the server refused and that were dropped. */
  rejectedWrites: number;
  /** True while a sync the user asked for is running. */
  syncing: boolean;
  /** Sends waiting changes and re-reads the saved data, right now. */
  forceSync: () => Promise<SyncResult>;
}

const OfflineContext = createContext<OfflineContextType>({
  online: true,
  pendingWrites: 0,
  rejectedWrites: 0,
  syncing: false,
  forceSync: async () => ({ online: true, sent: 0, remaining: 0, refreshed: 0 }),
});

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();

  const [online, setOnline] = useState(true);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [rejectedWrites, setRejectedWrites] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Every database rule begins with `auth != null`, so nothing may be sent
  // until Firebase Auth has restored the session - otherwise each queued
  // change is refused and the console fills with permission errors.
  const signedIn = !authLoading && !!currentUser;

  // Declared before the sending effects below, so the gate is open by the time
  // they run. Setting this while rendering would be a side effect in the render
  // pass, which React may run more than once.
  useEffect(() => {
    setAuthReady(signedIn);
  }, [signedIn]);

  const sendQueued = async (): Promise<void> => {
    await flushPendingWrites();
    setPendingWrites(await pendingCount());
    setRejectedWrites(rejectedWriteCount());
  };

  useEffect(() => {
    startConnectionWatch();

    const unsubscribeStatus = subscribeToConnection((isOnline) => setOnline(isOnline));
    const unsubscribeSync = subscribeToSync(() => {
      pendingCount()
        .then(setPendingWrites)
        .catch(() => undefined);
      setRejectedWrites(rejectedWriteCount());
    });

    const unsubscribeActivity = subscribeToSyncActivity(setSyncing);

    // Phones pause the app in the background; a connection that came back
    // while it was paused should be used as soon as it returns.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sendQueued().catch(() => undefined);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeSync();
      unsubscribeActivity();
      appState.remove();
    };
  }, []);

  // Signing in is the first moment the queue may be sent: a queue left over
  // from an earlier session is pushed as soon as there is someone to send it as.
  useEffect(() => {
    if (!signedIn) return;
    sendQueued().catch(() => undefined);
  }, [signedIn]);

  // Coming back online is the moment to push whatever was saved up.
  useEffect(() => {
    if (!online || !signedIn) return;
    sendQueued().catch(() => undefined);
  }, [online, signedIn]);

  // A slow connection can leave changes waiting with no state change to react
  // to, so the queue is retried on a short timer while anything is pending.
  useEffect(() => {
    if (pendingWrites === 0 || !signedIn) return;

    const timer = setInterval(
      () => {
        sendQueued().catch(() => undefined);
      },
      online ? 10000 : 3000,
    );

    return () => clearInterval(timer);
  }, [pendingWrites, online]);

  const forceSync = async (): Promise<SyncResult> => {
    const result = await runForceSync();
    setPendingWrites(result.remaining);
    return result;
  };

  return (
    <OfflineContext.Provider value={{ online, pendingWrites, rejectedWrites, syncing, forceSync }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = (): OfflineContextType => useContext(OfflineContext);
