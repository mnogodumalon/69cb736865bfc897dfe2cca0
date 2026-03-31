import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Job1Stundeneintrag, Gesamtuebersicht, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [job1Stundeneintrag, setJob1Stundeneintrag] = useState<Job1Stundeneintrag[]>([]);
  const [gesamtuebersicht, setGesamtuebersicht] = useState<Gesamtuebersicht[]>([]);
  const [job2Stundeneintrag, setJob2Stundeneintrag] = useState<Job2Stundeneintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [job1StundeneintragData, gesamtuebersichtData, job2StundeneintragData] = await Promise.all([
        LivingAppsService.getJob1Stundeneintrag(),
        LivingAppsService.getGesamtuebersicht(),
        LivingAppsService.getJob2Stundeneintrag(),
      ]);
      setJob1Stundeneintrag(job1StundeneintragData);
      setGesamtuebersicht(gesamtuebersichtData);
      setJob2Stundeneintrag(job2StundeneintragData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [job1StundeneintragData, gesamtuebersichtData, job2StundeneintragData] = await Promise.all([
          LivingAppsService.getJob1Stundeneintrag(),
          LivingAppsService.getGesamtuebersicht(),
          LivingAppsService.getJob2Stundeneintrag(),
        ]);
        setJob1Stundeneintrag(job1StundeneintragData);
        setGesamtuebersicht(gesamtuebersichtData);
        setJob2Stundeneintrag(job2StundeneintragData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const job1StundeneintragMap = useMemo(() => {
    const m = new Map<string, Job1Stundeneintrag>();
    job1Stundeneintrag.forEach(r => m.set(r.record_id, r));
    return m;
  }, [job1Stundeneintrag]);

  const job2StundeneintragMap = useMemo(() => {
    const m = new Map<string, Job2Stundeneintrag>();
    job2Stundeneintrag.forEach(r => m.set(r.record_id, r));
    return m;
  }, [job2Stundeneintrag]);

  return { job1Stundeneintrag, setJob1Stundeneintrag, gesamtuebersicht, setGesamtuebersicht, job2Stundeneintrag, setJob2Stundeneintrag, loading, error, fetchAll, job1StundeneintragMap, job2StundeneintragMap };
}