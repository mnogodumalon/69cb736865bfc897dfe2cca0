import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichGesamtuebersicht } from '@/lib/enrich';
import type { EnrichedGesamtuebersicht } from '@/types/enriched';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconClock, IconCurrencyEuro, IconCalendar,
  IconChevronRight, IconBriefcase, IconChartBar,
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const APPGROUP_ID = '69cb736865bfc897dfe2cca0';
const REPAIR_ENDPOINT = '/claude/build/repair';

type Entry =
  | { jobType: 1; data: Job1Stundeneintrag }
  | { jobType: 2; data: Job2Stundeneintrag };

type JobFilter = 'all' | 'job1' | 'job2';

export default function DashboardOverview() {
  const {
    job1Stundeneintrag, gesamtuebersicht, job2Stundeneintrag,
    job1StundeneintragMap, job2StundeneintragMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedGesamtuebersicht: EnrichedGesamtuebersicht[] = enrichGesamtuebersicht(gesamtuebersicht, { job1StundeneintragMap, job2StundeneintragMap });

  const [activeFilter, setActiveFilter] = useState<JobFilter>('all');
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [editJob1, setEditJob1] = useState<Job1Stundeneintrag | null>(null);
  const [editJob2, setEditJob2] = useState<Job2Stundeneintrag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; job: 1 | 2 } | null>(null);

  const stats = useMemo(() => {
    const j1Hours = job1Stundeneintrag.reduce((s, r) => s + (r.fields.job1_arbeitsstunden ?? 0), 0);
    const j2Hours = job2Stundeneintrag.reduce((s, r) => s + (r.fields.job2_arbeitsstunden ?? 0), 0);
    const j1Earnings = job1Stundeneintrag.reduce((s, r) =>
      s + ((r.fields.job1_arbeitsstunden ?? 0) * (r.fields.job1_stundenlohn ?? 0)), 0);
    const j2Earnings = job2Stundeneintrag.reduce((s, r) =>
      s + ((r.fields.job2_arbeitsstunden ?? 0) * (r.fields.job2_stundenlohn ?? 0)), 0);
    return { j1Hours, j2Hours, j1Earnings, j2Earnings };
  }, [job1Stundeneintrag, job2Stundeneintrag]);

  const chartData = useMemo(() => {
    const months: Record<string, { monat: string; job1: number; job2: number }> = {};

    job1Stundeneintrag.forEach(r => {
      if (!r.fields.job1_datum) return;
      const monthKey = r.fields.job1_datum.slice(0, 7);
      if (!months[monthKey]) {
        months[monthKey] = {
          monat: format(parseISO(monthKey + '-01'), 'MMM yy', { locale: de }),
          job1: 0, job2: 0,
        };
      }
      months[monthKey].job1 += r.fields.job1_arbeitsstunden ?? 0;
    });

    job2Stundeneintrag.forEach(r => {
      if (!r.fields.job2_datum) return;
      const monthKey = r.fields.job2_datum.slice(0, 7);
      if (!months[monthKey]) {
        months[monthKey] = {
          monat: format(parseISO(monthKey + '-01'), 'MMM yy', { locale: de }),
          job1: 0, job2: 0,
        };
      }
      months[monthKey].job2 += r.fields.job2_arbeitsstunden ?? 0;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => v);
  }, [job1Stundeneintrag, job2Stundeneintrag]);

  const allEntries = useMemo<Entry[]>(() => {
    const j1: Entry[] = job1Stundeneintrag.map(d => ({ jobType: 1 as const, data: d }));
    const j2: Entry[] = job2Stundeneintrag.map(d => ({ jobType: 2 as const, data: d }));
    return [...j1, ...j2].sort((a, b) => {
      const dA = a.jobType === 1 ? (a.data.fields.job1_datum ?? '') : (a.data.fields.job2_datum ?? '');
      const dB = b.jobType === 1 ? (b.data.fields.job1_datum ?? '') : (b.data.fields.job2_datum ?? '');
      return dB.localeCompare(dA);
    });
  }, [job1Stundeneintrag, job2Stundeneintrag]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'job1') return allEntries.filter(e => e.jobType === 1);
    if (activeFilter === 'job2') return allEntries.filter(e => e.jobType === 2);
    return allEntries;
  }, [allEntries, activeFilter]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.job === 1) {
      await LivingAppsService.deleteJob1StundeneintragEntry(deleteTarget.id);
    } else {
      await LivingAppsService.deleteJob2StundeneintragEntry(deleteTarget.id);
    }
    setDeleteTarget(null);
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  // TEST: Erzwungener Fehler zum Testen des Repair-Buttons
  const forcedError = new Error('Testfehler: Dashboard konnte nicht geladen werden.');
  if (error || forcedError) return <DashboardError error={error ?? forcedError} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Intent Workflows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/arbeitstage-erfassen" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconBriefcase size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">Arbeitstag erfassen</div>
            <div className="text-xs text-muted-foreground truncate">Stunden für einen Tag in beiden Jobs eintragen</div>
          </div>
          <IconChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
        </a>
        <a href="#/intents/monatsauswertung-erstellen" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconChartBar size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">Monatsauswertung erstellen</div>
            <div className="text-xs text-muted-foreground truncate">Einträge eines Zeitraums zur Gesamtübersicht zusammenfassen</div>
          </div>
          <IconChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
        </a>
      </div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arbeitsstunden</h1>
          <p className="text-sm text-muted-foreground">{allEntries.length} Einträge gesamt</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditJob1(null); setJob1DialogOpen(true); }}
          >
            <IconPlus size={14} className="shrink-0 mr-1" />
            <span>Job 1 erfassen</span>
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditJob2(null); setJob2DialogOpen(true); }}
          >
            <IconPlus size={14} className="shrink-0 mr-1" />
            <span>Job 2 erfassen</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Stunden Job 1"
          value={`${stats.j1Hours % 1 === 0 ? stats.j1Hours.toFixed(0) : stats.j1Hours.toFixed(1)} h`}
          description={`${job1Stundeneintrag.length} Einträge`}
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Stunden Job 2"
          value={`${stats.j2Hours % 1 === 0 ? stats.j2Hours.toFixed(0) : stats.j2Hours.toFixed(1)} h`}
          description={`${job2Stundeneintrag.length} Einträge`}
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 1"
          value={stats.j1Earnings > 0 ? formatCurrency(stats.j1Earnings) : '—'}
          description="Gesamtverdienst"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 2"
          value={stats.j2Earnings > 0 ? formatCurrency(stats.j2Earnings) : '—'}
          description="Gesamtverdienst"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Monthly Chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 sm:p-5 overflow-hidden">
          <h2 className="text-sm font-semibold text-foreground mb-4">Stunden pro Monat</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4} barCategoryGap="30%">
              <XAxis
                dataKey="monat"
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v.toFixed(1)} h`]}
              />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="job1" name="Job 1" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="job2" name="Job 2" fill="#ea580c" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Filter Tabs */}
        <div className="flex border-b px-2 sm:px-4">
          {(['all', 'job1', 'job2'] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeFilter === f
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Alle' : f === 'job1' ? 'Job 1' : 'Job 2'}
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                activeFilter === f ? 'bg-primary/10' : 'bg-muted'
              }`}>
                {f === 'all'
                  ? allEntries.length
                  : f === 'job1'
                  ? job1Stundeneintrag.length
                  : job2Stundeneintrag.length}
              </span>
            </button>
          ))}
        </div>

        {/* Entry List */}
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <IconCalendar size={48} className="text-muted-foreground" stroke={1.5} />
            <div>
              <p className="text-sm font-medium text-foreground">Keine Einträge</p>
              <p className="text-xs text-muted-foreground mt-0.5">Erstelle deinen ersten Stundeneintrag.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {filteredEntries.map(entry => {
              if (entry.jobType === 1) {
                const r = entry.data;
                const hours = r.fields.job1_arbeitsstunden;
                const earnings = (hours != null && r.fields.job1_stundenlohn != null && r.fields.job1_stundenlohn > 0)
                  ? hours * r.fields.job1_stundenlohn
                  : null;
                return (
                  <div key={r.record_id} className="flex items-start gap-3 px-4 py-3">
                    <div className="shrink-0 mt-0.5">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary whitespace-nowrap">
                        Job 1
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium text-sm truncate">{r.fields.job1_arbeitgeber || '—'}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.fields.job1_datum)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {r.fields.job1_startzeit && r.fields.job1_endzeit && (
                          <span className="text-xs text-muted-foreground">
                            {r.fields.job1_startzeit} – {r.fields.job1_endzeit}
                            {r.fields.job1_pause ? ` (${r.fields.job1_pause} min Pause)` : ''}
                          </span>
                        )}
                        {hours != null && (
                          <span className="text-xs font-semibold text-foreground">{hours.toFixed(1)} h</span>
                        )}
                        {earnings != null && (
                          <span className="text-xs text-muted-foreground">{formatCurrency(earnings)}</span>
                        )}
                      </div>
                      {r.fields.job1_notizen && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.fields.job1_notizen}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditJob1(r); setJob1DialogOpen(true); }}
                      >
                        <IconPencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: r.record_id, job: 1 })}
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  </div>
                );
              } else {
                const r = entry.data;
                const hours = r.fields.job2_arbeitsstunden;
                const earnings = (hours != null && r.fields.job2_stundenlohn != null && r.fields.job2_stundenlohn > 0)
                  ? hours * r.fields.job2_stundenlohn
                  : null;
                return (
                  <div key={r.record_id} className="flex items-start gap-3 px-4 py-3">
                    <div className="shrink-0 mt-0.5">
                      <span className="inline-flex items-center rounded-md bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-600 whitespace-nowrap">
                        Job 2
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium text-sm truncate">{r.fields.job2_arbeitgeber || '—'}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.fields.job2_datum)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {r.fields.job2_startzeit && r.fields.job2_endzeit && (
                          <span className="text-xs text-muted-foreground">
                            {r.fields.job2_startzeit} – {r.fields.job2_endzeit}
                            {r.fields.job2_pause ? ` (${r.fields.job2_pause} min Pause)` : ''}
                          </span>
                        )}
                        {hours != null && (
                          <span className="text-xs font-semibold text-foreground">{hours.toFixed(1)} h</span>
                        )}
                        {earnings != null && (
                          <span className="text-xs text-muted-foreground">{formatCurrency(earnings)}</span>
                        )}
                      </div>
                      {r.fields.job2_notizen && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.fields.job2_notizen}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditJob2(r); setJob2DialogOpen(true); }}
                      >
                        <IconPencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: r.record_id, job: 2 })}
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* Auswertungen */}
      {enrichedGesamtuebersicht.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 sm:p-5 overflow-hidden">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Auswertungen
            <span className="ml-2 text-xs font-normal text-muted-foreground">{enrichedGesamtuebersicht.length} gespeichert</span>
          </h2>
          <div className="space-y-2">
            {enrichedGesamtuebersicht.slice(0, 5).map(r => (
              <div key={r.record_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                {r.fields.auswertung_von && r.fields.auswertung_bis && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(r.fields.auswertung_von)} – {formatDate(r.fields.auswertung_bis)}
                  </span>
                )}
                {r.fields.gesamt_stunden != null && (
                  <span className="text-xs font-semibold text-foreground">{r.fields.gesamt_stunden} h</span>
                )}
                {r.fields.gesamt_verdienst != null && (
                  <span className="text-xs text-muted-foreground">{formatCurrency(r.fields.gesamt_verdienst)}</span>
                )}
                {r.fields.auswertung_notizen && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{r.fields.auswertung_notizen}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Job1StundeneintragDialog
        open={job1DialogOpen}
        onClose={() => { setJob1DialogOpen(false); setEditJob1(null); }}
        onSubmit={async (fields) => {
          if (editJob1) {
            await LivingAppsService.updateJob1StundeneintragEntry(editJob1.record_id, fields);
          } else {
            await LivingAppsService.createJob1StundeneintragEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editJob1?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Job1Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job1Stundeneintrag']}
      />

      <Job2StundeneintragDialog
        open={job2DialogOpen}
        onClose={() => { setJob2DialogOpen(false); setEditJob2(null); }}
        onSubmit={async (fields) => {
          if (editJob2) {
            await LivingAppsService.updateJob2StundeneintragEntry(editJob2.record_id, fields);
          } else {
            await LivingAppsService.createJob2StundeneintragEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editJob2?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Job2Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job2Stundeneintrag']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description="Möchtest du diesen Stundeneintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

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
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
