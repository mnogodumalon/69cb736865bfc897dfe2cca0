import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import {
  IconAlertCircle, IconPlus, IconPencil, IconTrash,
  IconClock, IconCurrencyEuro, IconBriefcase,
  IconRocket, IconChevronRight, IconCalendarPlus, IconFileText,
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface ShiftEntry {
  id: string;
  job: 'job1' | 'job2';
  datum: string;
  arbeitgeber: string;
  startzeit: string;
  endzeit: string;
  pause: number;
  stunden: number;
  stundenlohn: number;
  verdienst: number;
  notizen: string;
  raw: Job1Stundeneintrag | Job2Stundeneintrag;
}

function computeStunden(
  stunden?: number,
  start?: string,
  end?: string,
  pause?: number,
): number {
  if (stunden != null && stunden > 0) return stunden;
  if (!start || !end) return 0;
  const parseT = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };
  const total = parseT(end) - parseT(start) - (pause ?? 0);
  return Math.max(0, total / 60);
}

function fmtH(h: number): string {
  if (h === 0) return '0 h';
  const rounded = Math.round(h * 10) / 10;
  return `${rounded.toLocaleString('de-DE')} h`;
}

export default function DashboardOverview() {
  const {
    job1Stundeneintrag,
    job2Stundeneintrag,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  // All hooks before early returns
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [jobFilter, setJobFilter] = useState<'all' | 'job1' | 'job2'>('all');
  const [job1Dialog, setJob1Dialog] = useState<{ open: boolean; record: Job1Stundeneintrag | null }>({
    open: false,
    record: null,
  });
  const [job2Dialog, setJob2Dialog] = useState<{ open: boolean; record: Job2Stundeneintrag | null }>({
    open: false,
    record: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'job1' | 'job2'; id: string } | null>(null);

  const thisMonth = format(new Date(), 'yyyy-MM');

  const allEntries = useMemo<ShiftEntry[]>(() => {
    const j1: ShiftEntry[] = job1Stundeneintrag.map(r => {
      const stunden = computeStunden(
        r.fields.job1_arbeitsstunden,
        r.fields.job1_startzeit,
        r.fields.job1_endzeit,
        r.fields.job1_pause,
      );
      return {
        id: r.record_id,
        job: 'job1',
        datum: r.fields.job1_datum ?? '',
        arbeitgeber: r.fields.job1_arbeitgeber ?? '—',
        startzeit: r.fields.job1_startzeit ?? '',
        endzeit: r.fields.job1_endzeit ?? '',
        pause: r.fields.job1_pause ?? 0,
        stunden,
        stundenlohn: r.fields.job1_stundenlohn ?? 0,
        verdienst: stunden * (r.fields.job1_stundenlohn ?? 0),
        notizen: r.fields.job1_notizen ?? '',
        raw: r,
      };
    });
    const j2: ShiftEntry[] = job2Stundeneintrag.map(r => {
      const stunden = computeStunden(
        r.fields.job2_arbeitsstunden,
        r.fields.job2_startzeit,
        r.fields.job2_endzeit,
        r.fields.job2_pause,
      );
      return {
        id: r.record_id,
        job: 'job2',
        datum: r.fields.job2_datum ?? '',
        arbeitgeber: r.fields.job2_arbeitgeber ?? '—',
        startzeit: r.fields.job2_startzeit ?? '',
        endzeit: r.fields.job2_endzeit ?? '',
        pause: r.fields.job2_pause ?? 0,
        stunden,
        stundenlohn: r.fields.job2_stundenlohn ?? 0,
        verdienst: stunden * (r.fields.job2_stundenlohn ?? 0),
        notizen: r.fields.job2_notizen ?? '',
        raw: r,
      };
    });
    return [...j1, ...j2].sort((a, b) => b.datum.localeCompare(a.datum));
  }, [job1Stundeneintrag, job2Stundeneintrag]);

  const filteredEntries = useMemo(() => {
    return allEntries.filter(e => {
      if (period === 'month' && !e.datum.startsWith(thisMonth)) return false;
      if (jobFilter !== 'all' && e.job !== jobFilter) return false;
      return true;
    });
  }, [allEntries, period, jobFilter, thisMonth]);

  const kpi = useMemo(() => {
    const j1 = allEntries.filter(e => e.job === 'job1' && e.datum.startsWith(thisMonth));
    const j2 = allEntries.filter(e => e.job === 'job2' && e.datum.startsWith(thisMonth));
    return {
      job1Stunden: j1.reduce((s, e) => s + e.stunden, 0),
      job1Verdienst: j1.reduce((s, e) => s + e.verdienst, 0),
      job2Stunden: j2.reduce((s, e) => s + e.stunden, 0),
      job2Verdienst: j2.reduce((s, e) => s + e.verdienst, 0),
    };
  }, [allEntries, thisMonth]);

  const chartData = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(format(d, 'yyyy-MM'));
    }
    return months.map(m => ({
      monat: format(parseISO(m + '-01'), 'MMM yy', { locale: de }),
      'Job 1': Math.round(
        allEntries.filter(e => e.job === 'job1' && e.datum.startsWith(m)).reduce((s, e) => s + e.stunden, 0) * 10,
      ) / 10,
      'Job 2': Math.round(
        allEntries.filter(e => e.job === 'job2' && e.datum.startsWith(m)).reduce((s, e) => s + e.stunden, 0) * 10,
      ) / 10,
    }));
  }, [allEntries]);

  // Early returns after all hooks
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'job1') {
      await LivingAppsService.deleteJob1StundeneintragEntry(deleteTarget.id);
    } else {
      await LivingAppsService.deleteJob2StundeneintragEntry(deleteTarget.id);
    }
    setDeleteTarget(null);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      {/* Workflows */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <IconRocket size={18} className="text-primary" stroke={1.5} />
          <h2 className="font-semibold text-foreground">Workflows</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="#/intents/arbeitstage-erfassen"
            className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-0"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconCalendarPlus size={18} className="text-primary" stroke={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Arbeitstag erfassen</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Job 1 &amp; Job 2 Schichten an einem Tag loggen</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
          </a>
          <a
            href="#/intents/monatsbericht-erstellen"
            className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-0"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconFileText size={18} className="text-primary" stroke={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Monatsbericht erstellen</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Einträge auswählen &amp; Gesamtübersicht speichern</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
          </a>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schicht-Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), 'MMMM yyyy', { locale: de })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setJob1Dialog({ open: true, record: null })}
          >
            <IconPlus size={15} className="shrink-0" />
            <span>Job 1</span>
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setJob2Dialog({ open: true, record: null })}
          >
            <IconPlus size={15} className="shrink-0" />
            <span>Job 2</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Stunden Job 1"
          value={fmtH(kpi.job1Stunden)}
          description="Dieser Monat"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 1"
          value={formatCurrency(kpi.job1Verdienst)}
          description="Dieser Monat"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Stunden Job 2"
          value={fmtH(kpi.job2Stunden)}
          description="Dieser Monat"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 2"
          value={formatCurrency(kpi.job2Verdienst)}
          description="Dieser Monat"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Hours Chart */}
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold text-foreground mb-4">Stunden der letzten 6 Monate</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4} barCategoryGap="30%">
            <XAxis
              dataKey="monat"
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
              unit="h"
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | string) => [`${value}h`]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Job 1" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Job 2" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Shift Log */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
            Zeitraum
          </span>
          <Button
            size="sm"
            variant={period === 'month' ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setPeriod('month')}
          >
            Dieser Monat
          </Button>
          <Button
            size="sm"
            variant={period === 'all' ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setPeriod('all')}
          >
            Alle
          </Button>
          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
          <Button
            size="sm"
            variant={jobFilter === 'all' ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setJobFilter('all')}
          >
            Alle Jobs
          </Button>
          <Button
            size="sm"
            variant={jobFilter === 'job1' ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setJobFilter('job1')}
          >
            Job 1
          </Button>
          <Button
            size="sm"
            variant={jobFilter === 'job2' ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setJobFilter('job2')}
          >
            Job 2
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredEntries.length} Einträge
          </span>
        </div>

        {/* Empty state */}
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <IconBriefcase size={44} stroke={1.5} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Keine Einträge vorhanden</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setJob1Dialog({ open: true, record: null })}
              >
                <IconPlus size={14} className="mr-1 shrink-0" />
                Job 1 Eintrag
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setJob2Dialog({ open: true, record: null })}
              >
                <IconPlus size={14} className="mr-1 shrink-0" />
                Job 2 Eintrag
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {filteredEntries.map(entry => (
              <div
                key={`${entry.job}-${entry.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                {/* Date + job badge */}
                <div className="flex flex-col min-w-[86px]">
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatDate(entry.datum)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`mt-1 w-fit text-[10px] px-1.5 py-0 h-4 ${
                      entry.job === 'job1'
                        ? 'border-primary/40 text-primary bg-primary/5'
                        : 'border-amber-500/40 text-amber-600 bg-amber-50'
                    }`}
                  >
                    {entry.job === 'job1' ? 'Job 1' : 'Job 2'}
                  </Badge>
                </div>

                {/* Employer + time */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {entry.arbeitgeber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.startzeit && entry.endzeit
                      ? `${entry.startzeit} – ${entry.endzeit}${entry.pause ? ` · ${entry.pause} min Pause` : ''}`
                      : 'Zeiten nicht eingetragen'}
                  </p>
                </div>

                {/* Hours + earnings */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {fmtH(entry.stunden)}
                    </p>
                    {entry.verdienst > 0 && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatCurrency(entry.verdienst)}
                      </p>
                    )}
                  </div>

                  {/* Action buttons — always visible */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        if (entry.job === 'job1') {
                          setJob1Dialog({ open: true, record: entry.raw as Job1Stundeneintrag });
                        } else {
                          setJob2Dialog({ open: true, record: entry.raw as Job2Stundeneintrag });
                        }
                      }}
                    >
                      <IconPencil size={14} className="shrink-0" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget({ type: entry.job, id: entry.id })}
                    >
                      <IconTrash size={14} className="shrink-0" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Job1StundeneintragDialog
        open={job1Dialog.open}
        onClose={() => setJob1Dialog({ open: false, record: null })}
        onSubmit={async fields => {
          if (job1Dialog.record) {
            await LivingAppsService.updateJob1StundeneintragEntry(job1Dialog.record.record_id, fields);
          } else {
            await LivingAppsService.createJob1StundeneintragEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={job1Dialog.record?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Job1Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job1Stundeneintrag']}
      />
      <Job2StundeneintragDialog
        open={job2Dialog.open}
        onClose={() => setJob2Dialog({ open: false, record: null })}
        onSubmit={async fields => {
          if (job2Dialog.record) {
            await LivingAppsService.updateJob2StundeneintragEntry(job2Dialog.record.record_id, fields);
          } else {
            await LivingAppsService.createJob2StundeneintragEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={job2Dialog.record?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Job2Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job2Stundeneintrag']}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description="Möchtest du diesen Schichteintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
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
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
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
      <Button variant="outline" size="sm" onClick={onRetry}>
        Erneut versuchen
      </Button>
    </div>
  );
}
