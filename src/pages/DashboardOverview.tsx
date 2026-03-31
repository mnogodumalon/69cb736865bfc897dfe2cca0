import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichGesamtuebersicht } from '@/lib/enrich';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconPlus, IconPencil, IconTrash,
  IconBriefcase, IconClock, IconCurrencyEuro, IconCalendar,
  IconChevronLeft, IconChevronRight
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const APPGROUP_ID = '69cb736865bfc897dfe2cca0';
const REPAIR_URL = '/claude/repair';

type EntryType = { type: 'job1'; entry: Job1Stundeneintrag } | { type: 'job2'; entry: Job2Stundeneintrag };

function calcHours(entry: Job1Stundeneintrag | Job2Stundeneintrag, jobType: 'job1' | 'job2'): number {
  if (jobType === 'job1') {
    const e = entry as Job1Stundeneintrag;
    if (e.fields.job1_arbeitsstunden != null) return e.fields.job1_arbeitsstunden;
    if (e.fields.job1_startzeit && e.fields.job1_endzeit) {
      const [sh, sm] = e.fields.job1_startzeit.split(':').map(Number);
      const [eh, em] = e.fields.job1_endzeit.split(':').map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm) - (e.fields.job1_pause ?? 0);
      return Math.max(0, mins / 60);
    }
    return 0;
  } else {
    const e = entry as Job2Stundeneintrag;
    if (e.fields.job2_arbeitsstunden != null) return e.fields.job2_arbeitsstunden;
    if (e.fields.job2_startzeit && e.fields.job2_endzeit) {
      const [sh, sm] = e.fields.job2_startzeit.split(':').map(Number);
      const [eh, em] = e.fields.job2_endzeit.split(':').map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm) - (e.fields.job2_pause ?? 0);
      return Math.max(0, mins / 60);
    }
    return 0;
  }
}

function calcEarnings(entry: Job1Stundeneintrag | Job2Stundeneintrag, jobType: 'job1' | 'job2'): number {
  const hours = calcHours(entry, jobType);
  if (jobType === 'job1') {
    const e = entry as Job1Stundeneintrag;
    return hours * (e.fields.job1_stundenlohn ?? 0);
  } else {
    const e = entry as Job2Stundeneintrag;
    return hours * (e.fields.job2_stundenlohn ?? 0);
  }
}

function getEntryDate(entry: EntryType): string {
  if (entry.type === 'job1') return entry.entry.fields.job1_datum ?? '';
  return entry.entry.fields.job2_datum ?? '';
}

function getEmployer(entry: EntryType): string {
  if (entry.type === 'job1') return entry.entry.fields.job1_arbeitgeber ?? 'Job 1';
  return entry.entry.fields.job2_arbeitgeber ?? 'Job 2';
}

function getTimeRange(entry: EntryType): string {
  if (entry.type === 'job1') {
    const e = entry.entry as Job1Stundeneintrag;
    if (e.fields.job1_startzeit && e.fields.job1_endzeit) {
      return `${e.fields.job1_startzeit} – ${e.fields.job1_endzeit}`;
    }
    return '';
  } else {
    const e = entry.entry as Job2Stundeneintrag;
    if (e.fields.job2_startzeit && e.fields.job2_endzeit) {
      return `${e.fields.job2_startzeit} – ${e.fields.job2_endzeit}`;
    }
    return '';
  }
}

export default function DashboardOverview() {
  const {
    job1Stundeneintrag, gesamtuebersicht, job2Stundeneintrag,
    job1StundeneintragMap, job2StundeneintragMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedGesamtuebersicht = enrichGesamtuebersicht(gesamtuebersicht, { job1StundeneintragMap, job2StundeneintragMap });

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [editJob1, setEditJob1] = useState<Job1Stundeneintrag | null>(null);
  const [editJob2, setEditJob2] = useState<Job2Stundeneintrag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EntryType | null>(null);

  const monthEntries = useMemo<EntryType[]>(() => {
    const monthStart = currentMonth;
    const monthEnd = endOfMonth(currentMonth);

    const job1 = job1Stundeneintrag
      .filter(e => {
        const d = e.fields.job1_datum;
        if (!d) return false;
        try { const date = parseISO(d); return date >= monthStart && date <= monthEnd; } catch { return false; }
      })
      .map(e => ({ type: 'job1' as const, entry: e }));

    const job2 = job2Stundeneintrag
      .filter(e => {
        const d = e.fields.job2_datum;
        if (!d) return false;
        try { const date = parseISO(d); return date >= monthStart && date <= monthEnd; } catch { return false; }
      })
      .map(e => ({ type: 'job2' as const, entry: e }));

    return [...job1, ...job2].sort((a, b) => getEntryDate(b).localeCompare(getEntryDate(a)));
  }, [job1Stundeneintrag, job2Stundeneintrag, currentMonth]);

  const monthStats = useMemo(() => {
    let job1Hours = 0, job2Hours = 0, job1Earn = 0, job2Earn = 0;
    monthEntries.forEach(e => {
      if (e.type === 'job1') {
        job1Hours += calcHours(e.entry, 'job1');
        job1Earn += calcEarnings(e.entry, 'job1');
      } else {
        job2Hours += calcHours(e.entry, 'job2');
        job2Earn += calcEarnings(e.entry, 'job2');
      }
    });
    return { job1Hours, job2Hours, job1Earn, job2Earn, totalHours: job1Hours + job2Hours, totalEarn: job1Earn + job2Earn };
  }, [monthEntries]);

  const chartData = useMemo(() => {
    const weeks: Record<string, { week: string; job1: number; job2: number }> = {};
    monthEntries.forEach(e => {
      const dateStr = getEntryDate(e);
      if (!dateStr) return;
      try {
        const date = parseISO(dateStr);
        const weekKey = `KW ${format(date, 'w', { locale: de })}`;
        if (!weeks[weekKey]) weeks[weekKey] = { week: weekKey, job1: 0, job2: 0 };
        const hours = calcHours(e.type === 'job1' ? e.entry : e.entry, e.type);
        weeks[weekKey][e.type] += hours;
      } catch { /* skip */ }
    });
    return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
  }, [monthEntries]);

  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'job1') {
      await LivingAppsService.deleteJob1StundeneintragEntry(deleteTarget.entry.record_id);
    } else {
      await LivingAppsService.deleteJob2StundeneintragEntry(deleteTarget.entry.record_id);
    }
    setDeleteTarget(null);
    fetchAll();
  };

  // Gesamtübersicht stats from overview records (all time)
  const overallStats = useMemo(() => {
    let totalJob1Hours = 0, totalJob2Hours = 0, totalJob1Earn = 0, totalJob2Earn = 0;
    job1Stundeneintrag.forEach(e => {
      totalJob1Hours += calcHours(e, 'job1');
      totalJob1Earn += calcEarnings(e, 'job1');
    });
    job2Stundeneintrag.forEach(e => {
      totalJob2Hours += calcHours(e, 'job2');
      totalJob2Earn += calcEarnings(e, 'job2');
    });
    // Use manual gesamt if available
    const latestGesamt = enrichedGesamtuebersicht.sort((a, b) =>
      (b.fields.auswertung_bis ?? '').localeCompare(a.fields.auswertung_bis ?? '')
    )[0];
    return { totalJob1Hours, totalJob2Hours, totalJob1Earn, totalJob2Earn, latestGesamt };
  }, [job1Stundeneintrag, job2Stundeneintrag, enrichedGesamtuebersicht]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Intent Workflows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/stunden-erfassen" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconClock size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">Stunden erfassen</p>
            <p className="text-sm text-muted-foreground truncate">Schicht für Job 1 oder Job 2 eintragen</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
        <a href="#/intents/monatsauswertung" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconCalendar size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">Monatsauswertung erstellen</p>
            <p className="text-sm text-muted-foreground truncate">Gesamtübersicht für einen Zeitraum anlegen</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arbeitsstunden</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Übersicht deiner Arbeitszeiten</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditJob1(null); setJob1DialogOpen(true); }}
            className="flex items-center gap-1.5"
          >
            <IconPlus size={16} className="shrink-0" />
            <span>Job 1</span>
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditJob2(null); setJob2DialogOpen(true); }}
            className="flex items-center gap-1.5"
          >
            <IconPlus size={16} className="shrink-0" />
            <span>Job 2</span>
          </Button>
        </div>
      </div>

      {/* Overall KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Gesamt Job 1"
          value={`${overallStats.totalJob1Hours.toFixed(1)} h`}
          description="Alle Einträge"
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamt Job 2"
          value={`${overallStats.totalJob2Hours.toFixed(1)} h`}
          description="Alle Einträge"
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 1"
          value={formatCurrency(overallStats.totalJob1Earn)}
          description="Gesamt"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 2"
          value={formatCurrency(overallStats.totalJob2Earn)}
          description="Gesamt"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Month Navigator + Stats */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <IconChevronLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-foreground min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: de })}
            </h2>
            <button
              onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              disabled={isCurrentMonth}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <IconChevronRight size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{monthStats.totalHours.toFixed(1)} h</span>
              {' '}gesamt
            </span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{formatCurrency(monthStats.totalEarn)}</span>
              {' '}verdient
            </span>
          </div>
        </div>

        {/* Month sub-stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border">
          <div className="px-5 py-3">
            <p className="text-xs text-muted-foreground">Job 1 Stunden</p>
            <p className="text-lg font-bold text-foreground">{monthStats.job1Hours.toFixed(1)} h</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-muted-foreground">Job 2 Stunden</p>
            <p className="text-lg font-bold text-foreground">{monthStats.job2Hours.toFixed(1)} h</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-muted-foreground">Job 1 Verdienst</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(monthStats.job1Earn)}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-muted-foreground">Job 2 Verdienst</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(monthStats.job2Earn)}</p>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground mb-3">Stunden pro Woche</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barGap={4} barCategoryGap="30%">
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v.toFixed(1)} h`]}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="job1" name="Job 1" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="job2" name="Job 2" fill="var(--primary)" opacity={0.45} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Entry List */}
        <div className="divide-y divide-border">
          {monthEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <IconClock size={40} stroke={1.5} className="text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Keine Einträge</p>
                <p className="text-sm text-muted-foreground">Füge deinen ersten Eintrag für diesen Monat hinzu.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditJob1(null); setJob1DialogOpen(true); }}>
                  <IconPlus size={14} className="mr-1" />Job 1
                </Button>
                <Button size="sm" onClick={() => { setEditJob2(null); setJob2DialogOpen(true); }}>
                  <IconPlus size={14} className="mr-1" />Job 2
                </Button>
              </div>
            </div>
          ) : (
            monthEntries.map(entry => {
              const dateStr = getEntryDate(entry);
              const employer = getEmployer(entry);
              const timeRange = getTimeRange(entry);
              const hours = entry.type === 'job1'
                ? calcHours(entry.entry, 'job1')
                : calcHours(entry.entry, 'job2');
              const earnings = entry.type === 'job1'
                ? calcEarnings(entry.entry, 'job1')
                : calcEarnings(entry.entry, 'job2');
              const pause = entry.type === 'job1'
                ? (entry.entry as Job1Stundeneintrag).fields.job1_pause
                : (entry.entry as Job2Stundeneintrag).fields.job2_pause;
              const notes = entry.type === 'job1'
                ? (entry.entry as Job1Stundeneintrag).fields.job1_notizen
                : (entry.entry as Job2Stundeneintrag).fields.job2_notizen;

              return (
                <div key={`${entry.type}-${entry.entry.record_id}`} className="flex items-start gap-3 px-5 py-4 hover:bg-accent/30 transition-colors">
                  <div className="mt-0.5 shrink-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${entry.type === 'job1' ? 'bg-primary/10' : 'bg-orange-500/10'}`}>
                      <IconCalendar size={15} className={entry.type === 'job1' ? 'text-primary' : 'text-orange-500'} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-medium text-foreground truncate">{employer}</span>
                      <Badge variant={entry.type === 'job1' ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {entry.type === 'job1' ? 'Job 1' : 'Job 2'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      {dateStr && <span className="flex items-center gap-1"><IconCalendar size={12} />{formatDate(dateStr)}</span>}
                      {timeRange && <span className="flex items-center gap-1"><IconClock size={12} />{timeRange}</span>}
                      {pause != null && pause > 0 && <span>{pause} min Pause</span>}
                    </div>
                    {notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    <span className="font-semibold text-foreground text-sm">{hours.toFixed(1)} h</span>
                    {earnings > 0 && <span className="text-xs text-muted-foreground">{formatCurrency(earnings)}</span>}
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => {
                          if (entry.type === 'job1') { setEditJob1(entry.entry as Job1Stundeneintrag); setJob1DialogOpen(true); }
                          else { setEditJob2(entry.entry as Job2Stundeneintrag); setJob2DialogOpen(true); }
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <IconPencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description="Möchtest du diesen Zeiteintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
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
  const handleRepair = () => {
    const ctx = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 5).join('\n'),
      url: window.location.href,
    });
    window.open(
      `${REPAIR_URL}?appgroup_id=${APPGROUP_ID}&error=${encodeURIComponent(ctx)}`,
      '_blank',
    );
  };

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{error.message}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair}><IconTool size={14} className="mr-1" />Dashboard reparieren</Button>
      </div>
    </div>
  );
}
