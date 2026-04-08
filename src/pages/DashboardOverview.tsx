import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichGesamtuebersicht } from '@/lib/enrich';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatCard } from '@/components/StatCard';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconClock, IconCoin,
  IconCalendar, IconBriefcase, IconChevronLeft, IconChevronRight,
} from '@tabler/icons-react';
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval,
  format, isToday, parseISO, isSameDay,
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const APPGROUP_ID = '69cb736865bfc897dfe2cca0';
const REPAIR_ENDPOINT = '/claude/build/repair';

function calcHours(start?: string, end?: string, pauseMin?: number): number {
  if (!start || !end) return 0;
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const diff = toMin(end) - toMin(start) - (pauseMin || 0);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
}

export default function DashboardOverview() {
  const {
    job1Stundeneintrag, gesamtuebersicht, job2Stundeneintrag,
    job1StundeneintragMap, job2StundeneintragMap,
    loading, error, fetchAll,
  } = useDashboardData();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _enriched = enrichGesamtuebersicht(gesamtuebersicht, { job1StundeneintragMap, job2StundeneintragMap });

  const [weekOffset, setWeekOffset] = useState(0);
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [editJob1, setEditJob1] = useState<Job1Stundeneintrag | null>(null);
  const [editJob2, setEditJob2] = useState<Job2Stundeneintrag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; job: 1 | 2 } | null>(null);
  const [activeTab, setActiveTab] = useState<'woche' | 'verlauf'>('woche');

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return weekOffset === 0 ? base : (weekOffset > 0 ? addWeeks(base, weekOffset) : subWeeks(base, -weekOffset));
  }, [weekOffset]);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const totalJob1Hours = useMemo(() =>
    job1Stundeneintrag.reduce((s, r) => s + (r.fields.job1_arbeitsstunden ?? calcHours(r.fields.job1_startzeit, r.fields.job1_endzeit, r.fields.job1_pause)), 0),
    [job1Stundeneintrag]
  );
  const totalJob2Hours = useMemo(() =>
    job2Stundeneintrag.reduce((s, r) => s + (r.fields.job2_arbeitsstunden ?? calcHours(r.fields.job2_startzeit, r.fields.job2_endzeit, r.fields.job2_pause)), 0),
    [job2Stundeneintrag]
  );
  const totalJob1Earn = useMemo(() =>
    job1Stundeneintrag.reduce((s, r) => {
      const h = r.fields.job1_arbeitsstunden ?? calcHours(r.fields.job1_startzeit, r.fields.job1_endzeit, r.fields.job1_pause);
      return s + h * (r.fields.job1_stundenlohn ?? 0);
    }, 0),
    [job1Stundeneintrag]
  );
  const totalJob2Earn = useMemo(() =>
    job2Stundeneintrag.reduce((s, r) => {
      const h = r.fields.job2_arbeitsstunden ?? calcHours(r.fields.job2_startzeit, r.fields.job2_endzeit, r.fields.job2_pause);
      return s + h * (r.fields.job2_stundenlohn ?? 0);
    }, 0),
    [job2Stundeneintrag]
  );

  const job1Name = job1Stundeneintrag[0]?.fields.job1_arbeitgeber || 'Job 1';
  const job2Name = job2Stundeneintrag[0]?.fields.job2_arbeitgeber || 'Job 2';

  // Chart data: last 8 weeks
  const chartData = useMemo(() => {
    const weeks: { label: string; job1: number; job2: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const j1h = job1Stundeneintrag
        .filter(r => r.fields.job1_datum && (() => { try { const d = parseISO(r.fields.job1_datum!); return d >= ws && d <= we; } catch { return false; } })())
        .reduce((s, r) => s + (r.fields.job1_arbeitsstunden ?? calcHours(r.fields.job1_startzeit, r.fields.job1_endzeit, r.fields.job1_pause)), 0);
      const j2h = job2Stundeneintrag
        .filter(r => r.fields.job2_datum && (() => { try { const d = parseISO(r.fields.job2_datum!); return d >= ws && d <= we; } catch { return false; } })())
        .reduce((s, r) => s + (r.fields.job2_arbeitsstunden ?? calcHours(r.fields.job2_startzeit, r.fields.job2_endzeit, r.fields.job2_pause)), 0);
      weeks.push({ label: `KW ${format(ws, 'w', { locale: de })}`, job1: Math.round(j1h * 10) / 10, job2: Math.round(j2h * 10) / 10 });
    }
    return weeks;
  }, [job1Stundeneintrag, job2Stundeneintrag]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title={job1Name}
          value={`${Math.round(totalJob1Hours * 10) / 10} h`}
          description="Gesamtstunden Job 1"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title={job2Name}
          value={`${Math.round(totalJob2Hours * 10) / 10} h`}
          description="Gesamtstunden Job 2"
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 1"
          value={totalJob1Earn > 0 ? formatCurrency(totalJob1Earn) : '—'}
          description="Gesamt berechnet"
          icon={<IconCoin size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Verdienst Job 2"
          value={totalJob2Earn > 0 ? formatCurrency(totalJob2Earn) : '—'}
          description="Gesamt berechnet"
          icon={<IconCoin size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('woche')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'woche' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Wochenansicht
        </button>
        <button
          onClick={() => setActiveTab('verlauf')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'verlauf' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Verlauf (8 Wochen)
        </button>
      </div>

      {activeTab === 'woche' && (
        <>
          {/* Week Navigator */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o - 1)}>
                <IconChevronLeft size={16} />
              </Button>
              <span className="font-semibold text-sm min-w-0">
                {format(weekStart, 'd. MMM', { locale: de })} – {format(weekEnd, 'd. MMM yyyy', { locale: de })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}>
                <IconChevronRight size={16} />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                  <IconCalendar size={14} className="mr-1 shrink-0" />Heute
                </Button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => { setEditJob1(null); setJob1DialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <IconPlus size={14} className="mr-1 shrink-0" />
                <span className="hidden sm:inline">{job1Name} </span>Eintrag
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditJob2(null); setJob2DialogOpen(true); }}>
                <IconPlus size={14} className="mr-1 shrink-0" />
                <span className="hidden sm:inline">{job2Name} </span>Eintrag
              </Button>
            </div>
          </div>

          {/* Week Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[480px] grid grid-cols-7 gap-2">
              {weekDays.map(day => {
                const dayJ1 = job1Stundeneintrag.filter(r => {
                  if (!r.fields.job1_datum) return false;
                  try { return isSameDay(parseISO(r.fields.job1_datum), day); } catch { return false; }
                });
                const dayJ2 = job2Stundeneintrag.filter(r => {
                  if (!r.fields.job2_datum) return false;
                  try { return isSameDay(parseISO(r.fields.job2_datum), day); } catch { return false; }
                });
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`rounded-xl border p-2 min-h-[120px] flex flex-col gap-1 ${today ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                      <div>{format(day, 'EEE', { locale: de })}</div>
                      <div className={`text-lg font-bold ${today ? 'text-primary' : 'text-foreground'}`}>{format(day, 'd')}</div>
                    </div>

                    {dayJ1.map(r => {
                      const h = r.fields.job1_arbeitsstunden ?? calcHours(r.fields.job1_startzeit, r.fields.job1_endzeit, r.fields.job1_pause);
                      return (
                        <div key={r.record_id} className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 rounded-lg px-2 py-1 text-xs">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium truncate min-w-0">{r.fields.job1_startzeit || '?'} – {r.fields.job1_endzeit || '?'}</span>
                            <div className="flex gap-0.5 shrink-0">
                              <button
                                onClick={() => { setEditJob1(r); setJob1DialogOpen(true); }}
                                className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded"
                              >
                                <IconPencil size={11} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ id: r.record_id, job: 1 })}
                                className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded text-red-600"
                              >
                                <IconTrash size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="text-indigo-600 dark:text-indigo-300">{h > 0 ? `${h} h` : ''}</div>
                        </div>
                      );
                    })}

                    {dayJ2.map(r => {
                      const h = r.fields.job2_arbeitsstunden ?? calcHours(r.fields.job2_startzeit, r.fields.job2_endzeit, r.fields.job2_pause);
                      return (
                        <div key={r.record_id} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-lg px-2 py-1 text-xs">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium truncate min-w-0">{r.fields.job2_startzeit || '?'} – {r.fields.job2_endzeit || '?'}</span>
                            <div className="flex gap-0.5 shrink-0">
                              <button
                                onClick={() => { setEditJob2(r); setJob2DialogOpen(true); }}
                                className="p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded"
                              >
                                <IconPencil size={11} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ id: r.record_id, job: 2 })}
                                className="p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded text-red-600"
                              >
                                <IconTrash size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="text-emerald-600 dark:text-emerald-300">{h > 0 ? `${h} h` : ''}</div>
                        </div>
                      );
                    })}

                    {dayJ1.length === 0 && dayJ2.length === 0 && (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-400 inline-block shrink-0" />{job1Name}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400 inline-block shrink-0" />{job2Name}</span>
          </div>
        </>
      )}

      {activeTab === 'verlauf' && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-4 text-foreground">Arbeitsstunden der letzten 8 Wochen</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="label" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} unit=" h" />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [`${v} h`, name === 'job1' ? job1Name : job2Name]}
              />
              <Legend formatter={(v) => v === 'job1' ? job1Name : job2Name} />
              <Bar dataKey="job1" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="job2" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Entries List */}
      {activeTab === 'woche' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Letzte Einträge</h3>
          </div>
          <div className="divide-y divide-border">
            {[
              ...job1Stundeneintrag.map(r => ({ ...r, _job: 1 as const })),
              ...job2Stundeneintrag.map(r => ({ ...r, _job: 2 as const })),
            ]
              .sort((a, b) => {
                const da = a._job === 1 ? (a as Job1Stundeneintrag).fields.job1_datum : (a as Job2Stundeneintrag).fields.job2_datum;
                const db = b._job === 1 ? (b as Job1Stundeneintrag).fields.job1_datum : (b as Job2Stundeneintrag).fields.job2_datum;
                return (db || '').localeCompare(da || '');
              })
              .slice(0, 10)
              .map(entry => {
                if (entry._job === 1) {
                  const r = entry as Job1Stundeneintrag & { _job: 1 };
                  const h = r.fields.job1_arbeitsstunden ?? calcHours(r.fields.job1_startzeit, r.fields.job1_endzeit, r.fields.job1_pause);
                  const earn = h * (r.fields.job1_stundenlohn ?? 0);
                  return (
                    <div key={`j1-${r.record_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      <span className="text-xs text-muted-foreground w-20 shrink-0">{formatDate(r.fields.job1_datum)}</span>
                      <span className="text-sm font-medium truncate min-w-0 flex-1">{r.fields.job1_arbeitgeber || job1Name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{r.fields.job1_startzeit} – {r.fields.job1_endzeit}</span>
                      <span className="text-xs font-semibold text-indigo-600 w-12 text-right shrink-0">{h > 0 ? `${h} h` : '—'}</span>
                      <span className="text-xs text-muted-foreground w-20 text-right shrink-0">{earn > 0 ? formatCurrency(earn) : ''}</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditJob1(r); setJob1DialogOpen(true); }} className="p-1 rounded hover:bg-accent">
                          <IconPencil size={13} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteTarget({ id: r.record_id, job: 1 })} className="p-1 rounded hover:bg-accent">
                          <IconTrash size={13} className="text-destructive" />
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  const r = entry as Job2Stundeneintrag & { _job: 2 };
                  const h = r.fields.job2_arbeitsstunden ?? calcHours(r.fields.job2_startzeit, r.fields.job2_endzeit, r.fields.job2_pause);
                  const earn = h * (r.fields.job2_stundenlohn ?? 0);
                  return (
                    <div key={`j2-${r.record_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs text-muted-foreground w-20 shrink-0">{formatDate(r.fields.job2_datum)}</span>
                      <span className="text-sm font-medium truncate min-w-0 flex-1">{r.fields.job2_arbeitgeber || job2Name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{r.fields.job2_startzeit} – {r.fields.job2_endzeit}</span>
                      <span className="text-xs font-semibold text-emerald-600 w-12 text-right shrink-0">{h > 0 ? `${h} h` : '—'}</span>
                      <span className="text-xs text-muted-foreground w-20 text-right shrink-0">{earn > 0 ? formatCurrency(earn) : ''}</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditJob2(r); setJob2DialogOpen(true); }} className="p-1 rounded hover:bg-accent">
                          <IconPencil size={13} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteTarget({ id: r.record_id, job: 2 })} className="p-1 rounded hover:bg-accent">
                          <IconTrash size={13} className="text-destructive" />
                        </button>
                      </div>
                    </div>
                  );
                }
              })}
            {job1Stundeneintrag.length === 0 && job2Stundeneintrag.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Noch keine Einträge vorhanden. Erstelle deinen ersten Arbeitseintrag!
              </div>
            )}
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
        description="Möchtest du diesen Arbeitseintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-10 w-64" />
      <div className="min-w-[480px] grid grid-cols-7 gap-2">
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
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

      if (!resp.ok || !resp.body) { setRepairing(false); setRepairFailed(true); return; }

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
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
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
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
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
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
