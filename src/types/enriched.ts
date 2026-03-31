import type { Gesamtuebersicht } from './app';

export type EnrichedGesamtuebersicht = Gesamtuebersicht & {
  job1_eintraegeName: string;
  job2_eintraegeName: string;
};
