// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Job1Stundeneintrag {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    job1_arbeitgeber?: string;
    job1_datum?: string; // Format: YYYY-MM-DD oder ISO String
    job1_startzeit?: string;
    job1_endzeit?: string;
    job1_pause?: number;
    job1_arbeitsstunden?: number;
    job1_stundenlohn?: number;
    job1_notizen?: string;
  };
}

export interface Job2Stundeneintrag {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    job2_arbeitgeber?: string;
    job2_datum?: string; // Format: YYYY-MM-DD oder ISO String
    job2_startzeit?: string;
    job2_endzeit?: string;
    job2_pause?: number;
    job2_arbeitsstunden?: number;
    job2_stundenlohn?: number;
    job2_notizen?: string;
  };
}

export interface Gesamtuebersicht {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    gesamt_stunden?: number;
    gesamt_verdienst?: number;
    auswertung_notizen?: string;
    auswertung_von?: string; // Format: YYYY-MM-DD oder ISO String
    auswertung_bis?: string; // Format: YYYY-MM-DD oder ISO String
    job1_eintraege?: string; // applookup -> URL zu 'Job1Stundeneintrag' Record
    job2_eintraege?: string; // applookup -> URL zu 'Job2Stundeneintrag' Record
  };
}

export const APP_IDS = {
  JOB_1_STUNDENEINTRAG: '69cb734c19aa4d63f7e92821',
  JOB_2_STUNDENEINTRAG: '69cb7352247126dbd46208a7',
  GESAMTUEBERSICHT: '69cb73547ee4df080cc34824',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'job_1_stundeneintrag': {
    'job1_arbeitgeber': 'string/text',
    'job1_datum': 'date/date',
    'job1_startzeit': 'string/text',
    'job1_endzeit': 'string/text',
    'job1_pause': 'number',
    'job1_arbeitsstunden': 'number',
    'job1_stundenlohn': 'number',
    'job1_notizen': 'string/textarea',
  },
  'job_2_stundeneintrag': {
    'job2_arbeitgeber': 'string/text',
    'job2_datum': 'date/date',
    'job2_startzeit': 'string/text',
    'job2_endzeit': 'string/text',
    'job2_pause': 'number',
    'job2_arbeitsstunden': 'number',
    'job2_stundenlohn': 'number',
    'job2_notizen': 'string/textarea',
  },
  'gesamtuebersicht': {
    'gesamt_stunden': 'number',
    'gesamt_verdienst': 'number',
    'auswertung_notizen': 'string/textarea',
    'auswertung_von': 'date/date',
    'auswertung_bis': 'date/date',
    'job1_eintraege': 'applookup/select',
    'job2_eintraege': 'applookup/select',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateJob1Stundeneintrag = StripLookup<Job1Stundeneintrag['fields']>;
export type CreateJob2Stundeneintrag = StripLookup<Job2Stundeneintrag['fields']>;
export type CreateGesamtuebersicht = StripLookup<Gesamtuebersicht['fields']>;