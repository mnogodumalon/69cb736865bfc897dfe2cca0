import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichGesamtuebersicht } from '@/lib/enrich';
import type { EnrichedGesamtuebersicht } from '@/types/enriched';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconAlertCircle, IconPlus, IconPencil, IconTrash,
  IconClock, IconCurrencyEuro, IconBriefcase, IconCalendar,
  IconChevronRight, IconFileAnalytics, IconBolt,
} from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// --- Helpers ---

function computeHours(start?: string, end?: string, pauseMin?: number): number | null {
  if (!start || !end) return null;
  const sp = start.trim().split(':');
  const ep = end.trim().split(':');
  if (sp.length < 2 || ep.length < 2) return null;
  const sh = parseInt(sp[0]), sm = parseInt(sp[1]);
  const eh = parseInt(ep[0]), em = parseInt(ep[1]);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
  const totalMin = (eh * 60 + em) - (sh * 60 + sm) - (pauseMin ?? 0);
  if (totalMin < 0) return null;
  return Math.round(totalMin) / 60;
}

function fmtHours(h: number | null): string {
  if (h === null || h === 0) return h === 0 ? '0h' : '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function fmtMonth(ym: string): string {
  try {
    return format(parseISO(ym + '-01'), 'MMM yyyy', { locale: de });
  } catch {
    return ym;
  }
}

// --- Main Component ---

export default function DashboardOverview() {
  const {
    job1Stundeneintrag, gesamtuebersicht, job2Stundeneintrag,
    job1StundeneintragMap, job2StundeneintragMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedGesamtuebersicht: EnrichedGesamtuebersicht[] = enrichGesamtuebersicht(gesamtuebersicht, { job1StundeneintragMap, job2StundeneintragMap });

  const [activeJob, setActiveJob] = useState<'job1' | 'job2'>('job1');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job1EditRecord, setJob1EditRecord] = useState<Job1Stundeneintrag | null>(null);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [job2EditRecord, setJob2EditRecord] = useState<Job2Stundeneintrag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; job: 'job1' | 'job2' } | null>(null);

  // Employer names (from first entry with data)
  const job1Employer = useMemo(() => {
    return job1Stundeneintrag.find(e => e.fields.job1_arbeitgeber)?.fields.job1_arbeitgeber ?? 'Job 1';
  }, [job1Stundeneintrag]);

  const job2Employer = useMemo(() => {
    return job2Stundeneintrag.find(e => e.fields.job2_arbeitgeber)?.fields.job2_arbeitgeber ?? 'Job 2';
  }, [job2Stundeneintrag]);

  // Available months per job (sorted desc)
  const job1Months = useMemo(() => {
    const months = new Set<string>();
    job1Stundeneintrag.forEach(e => { if (e.fields.job1_datum) months.add(e.fields.job1_datum.slice(0, 7)); });
    return Array.from(months).sort().reverse();
  }, [job1Stundeneintrag]);

  const job2Months = useMemo(() => {
    const months = new Set<string>();
    job2Stundeneintrag.forEach(e => { if (e.fields.job2_datum) months.add(e.fields.job2_datum.slice(0, 7)); });
    return Array.from(months).sort().reverse();
  }, [job2Stundeneintrag]);

  const activeMonths = activeJob === 'job1' ? job1Months : job2Months;
  const currentMonth = selectedMonth ?? (activeMonths[0] ?? null);

  // Filtered entries for selected job + month
  const filteredJob1 = useMemo(() => {
    if (activeJob !== 'job1' || !currentMonth) return [] as Job1Stundeneintrag[];
    return job1Stundeneintrag
      .filter(e => e.fields.job1_datum?.slice(0, 7) === currentMonth)
      .sort((a, b) => (b.fields.job1_datum ?? '').localeCompare(a.fields.job1_datum ?? ''));
  }, [job1Stundeneintrag, activeJob, currentMonth]);

  const filteredJob2 = useMemo(() => {
    if (activeJob !== 'job2' || !currentMonth) return [] as Job2Stundeneintrag[];
    return job2Stundeneintrag
      .filter(e => e.fields.job2_datum?.slice(0, 7) === currentMonth)
      .sort((a, b) => (b.fields.job2_datum ?? '').localeCompare(a.fields.job2_datum ?? ''));
  }, [job2Stundeneintrag, activeJob, currentMonth]);

  // All-time KPIs
  const job1TotalHours = useMemo(() =>
    job1Stundeneintrag.reduce((sum, e) => {
      const h = e.fields.job1_arbeitsstunden ?? computeHours(e.fields.job1_startzeit, e.fields.job1_endzeit, e.fields.job1_pause);
      return sum + (h ?? 0);
    }, 0), [job1Stundeneintrag]);

  const job2TotalHours = useMemo(() =>
    job2Stundeneintrag.reduce((sum, e) => {
      const h = e.fields.job2_arbeitsstunden ?? computeHours(e.fields.job2_startzeit, e.fields.job2_endzeit, e.fields.job2_pause);
      return sum + (h ?? 0);
    }, 0), [job2Stundeneintrag]);

  const job1TotalEarnings = useMemo(() =>
    job1Stundeneintrag.reduce((sum, e) => {
      const h = e.fields.job1_arbeitsstunden ?? computeHours(e.fields.job1_startzeit, e.fields.job1_endzeit, e.fields.job1_pause);
      return sum + (h != null && e.fields.job1_stundenlohn != null ? h * e.fields.job1_stundenlohn : 0);
    }, 0), [job1Stundeneintrag]);

  const job2TotalEarnings = useMemo(() =>
    job2Stundeneintrag.reduce((sum, e) => {
      const h = e.fields.job2_arbeitsstunden ?? computeHours(e.fields.job2_startzeit, e.fields.job2_endzeit, e.fields.job2_pause);
      return sum + (h != null && e.fields.job2_stundenlohn != null ? h * e.fields.job2_stundenlohn : 0);
    }, 0), [job2Stundeneintrag]);

  // Month totals
  const monthJob1Hours = useMemo(() =>
    filteredJob1.reduce((sum, e) => {
      const h = e.fields.job1_arbeitsstunden ?? computeHours(e.fields.job1_startzeit, e.fields.job1_endzeit, e.fields.job1_pause);
      return sum + (h ?? 0);
    }, 0), [filteredJob1]);

  const monthJob2Hours = useMemo(() =>
    filteredJob2.reduce((sum, e) => {
      const h = e.fields.job2_arbeitsstunden ?? computeHours(e.fields.job2_startzeit, e.fields.job2_endzeit, e.fields.job2_pause);
      return sum + (h ?? 0);
    }, 0), [filteredJob2]);

  // Latest Gesamtübersicht for manual summary
  const latestBericht: EnrichedGesamtuebersicht | undefined = enrichedGesamtuebersicht.slice().sort(
    (a, b) => (b.fields.auswertung_bis ?? '').localeCompare(a.fields.auswertung_bis ?? '')
  )[0];

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const activeEntries = activeJob === 'job1' ? filteredJob1 : filteredJob2;
  const monthHours = activeJob === 'job1' ? monthJob1Hours : monthJob2Hours;

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.job === 'job1') {
      await LivingAppsService.deleteJob1StundeneintragEntry(deleteTarget.id);
    } else {
      await LivingAppsService.deleteJob2StundeneintragEntry(deleteTarget.id);
    }
    setDeleteTarget(null);
    fetchAll();
  }

  return (
    <div className="space-y-6">

      {/* Workflow Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/monatsauswertung" className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 overflow-hidden border-l-4 border-l-primary">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <IconFileAnalytics size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">Monatsauswertung erstellen</p>
            <p className="text-xs text-muted-foreground truncate">Zeitraum wählen · Einträge prüfen · Bericht speichern</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
        <a href="#/intents/schnellerfassung" className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 overflow-hidden border-l-4 border-l-primary">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <IconBolt size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">Schnellerfassung</p>
            <p className="text-xs text-muted-foreground truncate">Mehrere Schichten auf einmal für beide Jobs erfassen</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title={job1Employer}
          value={fmtHours(job1TotalHours)}
          description={`${job1Stundeneintrag.length} Einträge`}
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title={job2Employer}
          value={fmtHours(job2TotalHours)}
          description={`${job2Stundeneintrag.length} Einträge`}
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 1"
          value={formatCurrency(job1TotalEarnings)}
          description="Gesamtverdienst"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 2"
          value={formatCurrency(job2TotalEarnings)}
          description="Gesamtverdienst"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Latest Bericht (if exists) */}
      {latestBericht && (latestBericht.fields.auswertung_von || latestBericht.fields.auswertung_bis) && (
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Letzter Bericht</p>
              <p className="text-sm font-medium">
                {latestBericht.fields.auswertung_von && formatDate(latestBericht.fields.auswertung_von)}
                {latestBericht.fields.auswertung_von && latestBericht.fields.auswertung_bis && ' – '}
                {latestBericht.fields.auswertung_bis && formatDate(latestBericht.fields.auswertung_bis)}
              </p>
            </div>
            <div className="flex gap-6 flex-wrap">
              {latestBericht.fields.gesamt_stunden != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Stunden</p>
                  <p className="font-semibold">{fmtHours(latestBericht.fields.gesamt_stunden)}</p>
                </div>
              )}
              {latestBericht.fields.gesamt_verdienst != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Verdienst</p>
                  <p className="font-semibold">{formatCurrency(latestBericht.fields.gesamt_verdienst)}</p>
                </div>
              )}
            </div>
          </div>
          {latestBericht.fields.auswertung_notizen && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{latestBericht.fields.auswertung_notizen}</p>
          )}
        </div>
      )}

      {/* Job Tabs + Add Button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeJob === 'job1'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setActiveJob('job1'); setSelectedMonth(null); }}
          >
            {job1Employer}
          </button>
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeJob === 'job2'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setActiveJob('job2'); setSelectedMonth(null); }}
          >
            {job2Employer}
          </button>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => activeJob === 'job1' ? setJob1DialogOpen(true) : setJob2DialogOpen(true)}
        >
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          Neuer Eintrag
        </Button>
      </div>

      {/* Month Filter Tabs */}
      {activeMonths.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {activeMonths.map(m => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m === currentMonth ? null : m)}
              className={`px-3 py-1 rounded-full text-sm transition-colors border ${
                m === currentMonth
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground'
              }`}
            >
              {fmtMonth(m)}
            </button>
          ))}
        </div>
      )}

      {/* Month Summary */}
      {currentMonth && activeEntries.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          <div className="rounded-xl border border-border bg-card px-4 py-2 flex items-center gap-2">
            <IconClock size={14} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold">{fmtHours(monthHours)}</span>
            <span className="text-xs text-muted-foreground">diesen Monat</span>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-2 flex items-center gap-2">
            <IconCalendar size={14} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold">{activeEntries.length}</span>
            <span className="text-xs text-muted-foreground">Einträge</span>
          </div>
        </div>
      )}

      {/* Entry List */}
      <div className="space-y-2">
        {activeEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-border">
            <IconCalendar size={40} className="text-muted-foreground" stroke={1.5} />
            <p className="text-sm text-muted-foreground text-center">
              {currentMonth
                ? `Keine Einträge für ${fmtMonth(currentMonth)}`
                : 'Noch keine Einträge vorhanden'}
            </p>
            <Button
              size="sm" variant="outline"
              onClick={() => activeJob === 'job1' ? setJob1DialogOpen(true) : setJob2DialogOpen(true)}
            >
              <IconPlus size={16} className="mr-1.5" />
              Eintrag hinzufügen
            </Button>
          </div>
        ) : activeJob === 'job1' ? (
          filteredJob1.map(e => {
            const hours = e.fields.job1_arbeitsstunden ?? computeHours(e.fields.job1_startzeit, e.fields.job1_endzeit, e.fields.job1_pause);
            const earnings = hours != null && e.fields.job1_stundenlohn != null ? hours * e.fields.job1_stundenlohn : null;
            return (
              <div key={e.record_id} className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:shadow-sm transition-shadow overflow-hidden">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{formatDate(e.fields.job1_datum)}</span>
                    {e.fields.job1_startzeit && e.fields.job1_endzeit && (
                      <span className="text-xs text-muted-foreground">{e.fields.job1_startzeit} – {e.fields.job1_endzeit}</span>
                    )}
                    {!!e.fields.job1_pause && (
                      <span className="text-xs text-muted-foreground">Pause: {e.fields.job1_pause} min</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <IconClock size={14} className="shrink-0 text-muted-foreground" />
                      {fmtHours(hours)}
                    </span>
                    {earnings != null && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <IconCurrencyEuro size={14} className="shrink-0" />
                        {formatCurrency(earnings)}
                      </span>
                    )}
                    {e.fields.job1_arbeitgeber && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{e.fields.job1_arbeitgeber}</span>
                    )}
                  </div>
                  {e.fields.job1_notizen && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{e.fields.job1_notizen}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => { setJob1EditRecord(e); setJob1DialogOpen(true); }}
                  >
                    <IconPencil size={16} />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setDeleteTarget({ id: e.record_id, job: 'job1' })}
                  >
                    <IconTrash size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          filteredJob2.map(e => {
            const hours = e.fields.job2_arbeitsstunden ?? computeHours(e.fields.job2_startzeit, e.fields.job2_endzeit, e.fields.job2_pause);
            const earnings = hours != null && e.fields.job2_stundenlohn != null ? hours * e.fields.job2_stundenlohn : null;
            return (
              <div key={e.record_id} className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:shadow-sm transition-shadow overflow-hidden">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{formatDate(e.fields.job2_datum)}</span>
                    {e.fields.job2_startzeit && e.fields.job2_endzeit && (
                      <span className="text-xs text-muted-foreground">{e.fields.job2_startzeit} – {e.fields.job2_endzeit}</span>
                    )}
                    {!!e.fields.job2_pause && (
                      <span className="text-xs text-muted-foreground">Pause: {e.fields.job2_pause} min</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <IconClock size={14} className="shrink-0 text-muted-foreground" />
                      {fmtHours(hours)}
                    </span>
                    {earnings != null && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <IconCurrencyEuro size={14} className="shrink-0" />
                        {formatCurrency(earnings)}
                      </span>
                    )}
                    {e.fields.job2_arbeitgeber && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{e.fields.job2_arbeitgeber}</span>
                    )}
                  </div>
                  {e.fields.job2_notizen && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{e.fields.job2_notizen}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => { setJob2EditRecord(e); setJob2DialogOpen(true); }}
                  >
                    <IconPencil size={16} />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setDeleteTarget({ id: e.record_id, job: 'job2' })}
                  >
                    <IconTrash size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dialogs */}
      <Job1StundeneintragDialog
        open={job1DialogOpen}
        onClose={() => { setJob1DialogOpen(false); setJob1EditRecord(null); }}
        onSubmit={async (fields) => {
          if (job1EditRecord) {
            await LivingAppsService.updateJob1StundeneintragEntry(job1EditRecord.record_id, fields);
          } else {
            await LivingAppsService.createJob1StundeneintragEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={job1EditRecord?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Job1Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job1Stundeneintrag']}
      />

      <Job2StundeneintragDialog
        open={job2DialogOpen}
        onClose={() => { setJob2DialogOpen(false); setJob2EditRecord(null); }}
        onSubmit={async (fields) => {
          if (job2EditRecord) {
            await LivingAppsService.updateJob2StundeneintragEntry(job2EditRecord.record_id, fields);
          } else {
            await LivingAppsService.createJob2StundeneintragEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={job2EditRecord?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Job2Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job2Stundeneintrag']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description="Möchtest du diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// --- Sub-components ---

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Erneut versuchen</Button>
    </div>
  );
}
