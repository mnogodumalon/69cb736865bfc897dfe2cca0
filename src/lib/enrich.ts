import type { EnrichedGesamtuebersicht } from '@/types/enriched';
import type { Gesamtuebersicht, Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface GesamtuebersichtMaps {
  job1StundeneintragMap: Map<string, Job1Stundeneintrag>;
  job2StundeneintragMap: Map<string, Job2Stundeneintrag>;
}

export function enrichGesamtuebersicht(
  gesamtuebersicht: Gesamtuebersicht[],
  maps: GesamtuebersichtMaps
): EnrichedGesamtuebersicht[] {
  return gesamtuebersicht.map(r => ({
    ...r,
    job1_eintraegeName: resolveDisplay(r.fields.job1_eintraege, maps.job1StundeneintragMap, 'job1_arbeitgeber'),
    job2_eintraegeName: resolveDisplay(r.fields.job2_eintraege, maps.job2StundeneintragMap, 'job2_arbeitgeber'),
  }));
}
