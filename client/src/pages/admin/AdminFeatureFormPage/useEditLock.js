import { useEffect, useRef, useState, useCallback } from 'react';
import { acquireEditLock, releaseEditLock } from '../../../api/features';

const HEARTBEAT_MS = 30_000;

export function useEditLock(featureId) {
  const [otherEditor, setOtherEditor] = useState(null);
  const intervalRef = useRef(null);
  const featureIdRef = useRef(featureId);
  featureIdRef.current = featureId;

  const acquire = useCallback(async () => {
    if (!featureIdRef.current) return;
    try {
      const data = await acquireEditLock(featureIdRef.current);
      setOtherEditor(data?.currentEditor ?? null);
    } catch { /* silent — presence is non-critical */ }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(acquire, HEARTBEAT_MS);
  }, [acquire]);

  const stopHeartbeat = useCallback(() => {
    clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!featureId) return;

    acquire();
    startHeartbeat();

    // Pause heartbeat when tab is hidden so the lock expires naturally in 60s.
    // Resume and re-acquire when the user returns to the tab.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopHeartbeat();
      } else {
        acquire();
        startHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopHeartbeat();
      releaseEditLock(featureId).catch(() => {});
    };
  }, [featureId, acquire, startHeartbeat, stopHeartbeat]);

  return { otherEditor };
}
