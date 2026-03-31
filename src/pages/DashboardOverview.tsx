import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichGesamtuebersicht } from '@/lib/enrich';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import {
  IconAlertCircle, IconPlus, IconPencil, IconTrash,
  IconBriefcase, IconCurrencyEuro, IconClock, IconCalendar,
  IconRocket, IconChevronRight, IconCalendarStats, IconReportMoney,
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';

type EntryItem =
  | { type: 'job1'; entry: Job1Stundeneintrag }
  | { type: 'job2'; entry: Job2Stundeneintrag };

export default function DashboardOverview() {
  const {
    job1Stundeneintrag, job2Stundeneintrag, gesamtuebersicht,
    job1StundeneintragMap, job2StundeneintragMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedGesamtuebersicht = enrichGesamtuebersicht(gesamtuebersicht, { job1StundeneintragMap, job2StundeneintragMap });

  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [editJob1, setEditJob1] = useState<Job1Stundeneintrag | null>(null);
  const [editJob2, setEditJob2] = useState<Job2Stundeneintrag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'job1' | 'job2'; id: string } | null>(null);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthLabel = format(new Date(), 'MMMM yyyy', { locale: de });

  const monthEntries1 = useMemo(
    () => job1Stundeneintrag.filter(e => e.fields.job1_datum?.startsWith(currentMonth)),
    [job1Stundeneintrag, currentMonth]
  );
  const monthEntries2 = useMemo(
    () => job2Stundeneintrag.filter(e => e.fields.job2_datum?.startsWith(currentMonth)),
    [job2Stundeneintrag, currentMonth]
  );

  const totalHoursThisMonth = useMemo(() =>
    monthEntries1.reduce((s, e) => s + (e.fields.job1_arbeitsstunden ?? 0), 0) +
    monthEntries2.reduce((s, e) => s + (e.fields.job2_arbeitsstunden ?? 0), 0),
    [monthEntries1, monthEntries2]
  );

  const totalEarningsThisMonth = useMemo(() =>
    monthEntries1.reduce((s, e) => s + (e.fields.job1_arbeitsstunden ?? 0) * (e.fields.job1_stundenlohn ?? 0), 0) +
    monthEntries2.reduce((s, e) => s + (e.fields.job2_arbeitsstunden ?? 0) * (e.fields.job2_stundenlohn ?? 0), 0),
    [monthEntries1, monthEntries2]
  );

  const chartData = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => {
      const date = subDays(new Date(), 27 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const label = format(date, 'dd.MM', { locale: de });
      const job1 = job1Stundeneintrag
        .filter(e => e.fields.job1_datum === dateStr)
        .reduce((s, e) => s + (e.fields.job1_arbeitsstunden ?? 0), 0);
      const job2 = job2Stundeneintrag
        .filter(e => e.fields.job2_datum === dateStr)
        .reduce((s, e) => s + (e.fields.job2_arbeitsstunden ?? 0), 0);
      return { date: label, job1, job2 };
    });
  }, [job1Stundeneintrag, job2Stundeneintrag]);

  const recentEntries = useMemo((): EntryItem[] => {
    const j1: EntryItem[] = job1Stundeneintrag.map(e => ({ type: 'job1', entry: e }));
    const j2: EntryItem[] = job2Stundeneintrag.map(e => ({ type: 'job2', entry: e }));
    const all = [...j1, ...j2];
    all.sort((a, b) => {
      const da = a.type === 'job1' ? (a.entry.fields.job1_datum ?? '') : (a.entry.fields.job2_datum ?? '');
      const db = b.type === 'job1' ? (b.entry.fields.job1_datum ?? '') : (b.entry.fields.job2_datum ?? '');
      return db.localeCompare(da);
    });
    return all.slice(0, 20);
  }, [job1Stundeneintrag, job2Stundeneintrag]);

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

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const hasChartData = chartData.some(d => d.job1 > 0 || d.job2 > 0);

  return (
    <div className="space-y-6">
      {/* Workflows */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <IconRocket size={18} className="text-primary" stroke={2} />
          <h2 className="text-sm font-semibold text-foreground">Workflows</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="#/intents/tageserfassung"
            className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconCalendarStats size={18} className="text-primary" stroke={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground">Arbeitstag erfassen</p>
              <p className="text-xs text-muted-foreground truncate">Datum wählen → Job 1 + Job 2 eintragen → Tagesabschluss</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
          </a>
          <a
            href="#/intents/periodenabrechnung"
            className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconReportMoney size={18} className="text-primary" stroke={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground">Periodenabrechnung</p>
              <p className="text-xs text-muted-foreground truncate">Zeitraum wählen → Einträge verknüpfen → Gesamtübersicht erstellen</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
          </a>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stunden-Übersicht</h1>
          <p className="text-sm text-muted-foreground capitalize">{currentMonthLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => { setEditJob1(null); setJob1DialogOpen(true); }}
          >
            <IconPlus size={15} className="shrink-0" />
            <span className="ml-1">Job 1</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditJob2(null); setJob2DialogOpen(true); }}
          >
            <IconPlus size={15} className="shrink-0" />
            <span className="ml-1">Job 2</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Stunden diesen Monat"
          value={`${totalHoursThisMonth.toFixed(1)} h`}
          description="Job 1 + Job 2 gesamt"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst diesen Monat"
          value={formatCurrency(totalEarningsThisMonth)}
          description="Stunden × Stundenlohn"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Job 1 – Schichten"
          value={String(monthEntries1.length)}
          description="Einträge diesen Monat"
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Job 2 – Schichten"
          value={String(monthEntries2.length)}
          description="Einträge diesen Monat"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Bar Chart */}
      <div className="rounded-2xl border bg-card p-4 overflow-hidden">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">Arbeitsstunden – letzte 28 Tage</h2>
          <div className="flex gap-3 ml-auto text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--primary)' }} />
              Job 1
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block bg-orange-400" />
              Job 2
            </span>
          </div>
        </div>
        {hasChartData ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 10 }}
                interval={3}
              />
              <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(val, name) => [`${val} h`, name === 'job1' ? 'Job 1' : 'Job 2']}
              />
              <Bar dataKey="job1" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="job2" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] gap-2 text-center">
            <IconClock size={40} className="text-muted-foreground" stroke={1.5} />
            <p className="text-sm text-muted-foreground">Noch keine Einträge in den letzten 28 Tagen</p>
            <Button size="sm" variant="outline" onClick={() => { setEditJob1(null); setJob1DialogOpen(true); }}>
              <IconPlus size={14} className="mr-1 shrink-0" />
              Ersten Eintrag erfassen
            </Button>
          </div>
        )}
      </div>

      {/* Recent Entries */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Letzte Einträge</h2>
          <span className="text-xs text-muted-foreground">{recentEntries.length} Einträge</span>
        </div>

        {recentEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <IconBriefcase size={40} className="text-muted-foreground" stroke={1.5} />
            <p className="text-sm text-muted-foreground">Noch keine Stunden erfasst</p>
            <Button size="sm" variant="outline" onClick={() => { setEditJob1(null); setJob1DialogOpen(true); }}>
              <IconPlus size={14} className="mr-1 shrink-0" />
              Ersten Eintrag erstellen
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Job</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Datum</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Arbeitgeber</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Zeiten</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Stunden</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Verdienst</th>
                  <th className="px-4 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentEntries.map((item) => {
                  if (item.type === 'job1') {
                    const e = item.entry;
                    const earnings = (e.fields.job1_arbeitsstunden ?? 0) * (e.fields.job1_stundenlohn ?? 0);
                    return (
                      <tr key={`j1-${e.record_id}`} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                            J1
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">{formatDate(e.fields.job1_datum)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell max-w-[140px] truncate">{e.fields.job1_arbeitgeber ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                          {e.fields.job1_startzeit && e.fields.job1_endzeit
                            ? `${e.fields.job1_startzeit} – ${e.fields.job1_endzeit}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                          {e.fields.job1_arbeitsstunden != null ? `${e.fields.job1_arbeitsstunden} h` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap hidden md:table-cell">
                          {earnings > 0 ? formatCurrency(earnings) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7"
                              onClick={() => { setEditJob1(e); setJob1DialogOpen(true); }}
                            >
                              <IconPencil size={14} />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: 'job1', id: e.record_id })}
                            >
                              <IconTrash size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  } else {
                    const e = item.entry;
                    const earnings = (e.fields.job2_arbeitsstunden ?? 0) * (e.fields.job2_stundenlohn ?? 0);
                    return (
                      <tr key={`j2-${e.record_id}`} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-600 px-2 py-0.5 text-xs font-semibold">
                            J2
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">{formatDate(e.fields.job2_datum)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell max-w-[140px] truncate">{e.fields.job2_arbeitgeber ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                          {e.fields.job2_startzeit && e.fields.job2_endzeit
                            ? `${e.fields.job2_startzeit} – ${e.fields.job2_endzeit}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                          {e.fields.job2_arbeitsstunden != null ? `${e.fields.job2_arbeitsstunden} h` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap hidden md:table-cell">
                          {earnings > 0 ? formatCurrency(earnings) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7"
                              onClick={() => { setEditJob2(e); setJob2DialogOpen(true); }}
                            >
                              <IconPencil size={14} />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: 'job2', id: e.record_id })}
                            >
                              <IconTrash size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auswertungen */}
      {enrichedGesamtuebersicht.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-foreground">Auswertungen</h2>
          </div>
          <div className="divide-y">
            {enrichedGesamtuebersicht.map(e => (
              <div key={e.record_id} className="px-4 py-3 flex flex-wrap gap-3 items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {e.fields.auswertung_von && e.fields.auswertung_bis
                      ? `${formatDate(e.fields.auswertung_von)} – ${formatDate(e.fields.auswertung_bis)}`
                      : 'Zeitraum nicht angegeben'}
                  </p>
                  {e.fields.auswertung_notizen && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{e.fields.auswertung_notizen}</p>
                  )}
                </div>
                <div className="flex gap-4 text-sm shrink-0">
                  {e.fields.gesamt_stunden != null && (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{e.fields.gesamt_stunden} h</span>
                    </span>
                  )}
                  {e.fields.gesamt_verdienst != null && (
                    <span className="font-semibold text-foreground">{formatCurrency(e.fields.gesamt_verdienst)}</span>
                  )}
                </div>
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
        description="Möchtest du diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
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
