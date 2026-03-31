import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { Button } from '@/components/ui/button';
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconCheck,
  IconRefresh,
  IconBriefcase,
  IconClock,
  IconCurrencyEuro,
  IconCalendar,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Datum wählen' },
  { label: 'Job 1 Schicht' },
  { label: 'Job 2 Schicht' },
  { label: 'Tagesabschluss' },
];

function computeStunden(stunden?: number, start?: string, end?: string, pause?: number): number {
  if (stunden != null && stunden > 0) return stunden;
  if (!start || !end) return 0;
  const parseT = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  return Math.max(0, (parseT(end) - parseT(start) - (pause ?? 0)) / 60);
}

function formatHours(h: number): string {
  if (h === 0) return '0 Std.';
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (mins === 0) return `${hours} Std.`;
  return `${hours} Std. ${mins} Min.`;
}

function getInitialStep(): number {
  const params = new URLSearchParams(window.location.search);
  const s = parseInt(params.get('step') ?? '', 10);
  if (s >= 1 && s <= 4) return s;
  return 1;
}

export default function ArbeitstageErfassenPage() {
  const [currentStep, setCurrentStep] = useState<number>(getInitialStep);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [job1Entries, setJob1Entries] = useState<Job1Stundeneintrag[]>([]);
  const [job2Entries, setJob2Entries] = useState<Job2Stundeneintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);

  const [editJob1, setEditJob1] = useState<Job1Stundeneintrag | null>(null);
  const [editJob2, setEditJob2] = useState<Job2Stundeneintrag | null>(null);

  const [deleteJob1Target, setDeleteJob1Target] = useState<Job1Stundeneintrag | null>(null);
  const [deleteJob2Target, setDeleteJob2Target] = useState<Job2Stundeneintrag | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [j1, j2] = await Promise.all([
        LivingAppsService.getJob1Stundeneintrag(),
        LivingAppsService.getJob2Stundeneintrag(),
      ]);
      setJob1Entries(j1);
      setJob2Entries(j2);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const job1ForDate = useMemo(
    () => job1Entries.filter((e) => e.fields.job1_datum === selectedDate),
    [job1Entries, selectedDate]
  );

  const job2ForDate = useMemo(
    () => job2Entries.filter((e) => e.fields.job2_datum === selectedDate),
    [job2Entries, selectedDate]
  );

  const job1TotalHours = useMemo(
    () =>
      job1ForDate.reduce(
        (sum, e) =>
          sum +
          computeStunden(
            e.fields.job1_arbeitsstunden,
            e.fields.job1_startzeit,
            e.fields.job1_endzeit,
            e.fields.job1_pause
          ),
        0
      ),
    [job1ForDate]
  );

  const job1TotalEarnings = useMemo(
    () =>
      job1ForDate.reduce((sum, e) => {
        const h = computeStunden(
          e.fields.job1_arbeitsstunden,
          e.fields.job1_startzeit,
          e.fields.job1_endzeit,
          e.fields.job1_pause
        );
        return sum + h * (e.fields.job1_stundenlohn ?? 0);
      }, 0),
    [job1ForDate]
  );

  const job2TotalHours = useMemo(
    () =>
      job2ForDate.reduce(
        (sum, e) =>
          sum +
          computeStunden(
            e.fields.job2_arbeitsstunden,
            e.fields.job2_startzeit,
            e.fields.job2_endzeit,
            e.fields.job2_pause
          ),
        0
      ),
    [job2ForDate]
  );

  const job2TotalEarnings = useMemo(
    () =>
      job2ForDate.reduce((sum, e) => {
        const h = computeStunden(
          e.fields.job2_arbeitsstunden,
          e.fields.job2_startzeit,
          e.fields.job2_endzeit,
          e.fields.job2_pause
        );
        return sum + h * (e.fields.job2_stundenlohn ?? 0);
      }, 0),
    [job2ForDate]
  );

  const combinedHours = job1TotalHours + job2TotalHours;
  const combinedEarnings = job1TotalEarnings + job2TotalEarnings;

  const handleDeleteJob1 = useCallback(async () => {
    if (!deleteJob1Target) return;
    await LivingAppsService.deleteJob1StundeneintragEntry(deleteJob1Target.record_id);
    setDeleteJob1Target(null);
    await fetchAll();
  }, [deleteJob1Target, fetchAll]);

  const handleDeleteJob2 = useCallback(async () => {
    if (!deleteJob2Target) return;
    await LivingAppsService.deleteJob2StundeneintragEntry(deleteJob2Target.record_id);
    setDeleteJob2Target(null);
    await fetchAll();
  }, [deleteJob2Target, fetchAll]);

  const handleRestart = () => {
    setSelectedDate('');
    setCurrentStep(1);
  };

  return (
    <>
      <IntentWizardShell
        title="Arbeitstag erfassen"
        subtitle="Trage deine Arbeitszeiten für beide Jobs an einem Tag ein"
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        {/* Step 1: Datum wählen */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="p-5 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <IconCalendar size={18} className="text-primary shrink-0" />
                  <h2 className="font-semibold text-base">Welchen Tag möchtest du erfassen?</h2>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Datum
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    max="2099-12-31"
                  />
                </div>

                {selectedDate && (
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Bestehende Einträge für {formatDate(selectedDate)}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {job1ForDate.length}
                        </span>
                        Job-1-Einträge
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {job2ForDate.length}
                        </span>
                        Job-2-Einträge bereits für diesen Tag
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                disabled={!selectedDate}
                onClick={() => setCurrentStep(2)}
                className="min-w-[120px]"
              >
                Weiter
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Job 1 Schicht */}
        {currentStep === 2 && (
          <div className="space-y-5">
            {/* Live stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-card p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconClock size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-medium">Stunden Job 1</span>
                </div>
                <p className="text-xl font-bold truncate">{formatHours(job1TotalHours)}</p>
              </div>
              <div className="rounded-2xl border bg-card p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconCurrencyEuro size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-medium">Verdienst Job 1</span>
                </div>
                <p className="text-xl font-bold truncate">{formatCurrency(job1TotalEarnings)}</p>
              </div>
            </div>

            {/* Entries list */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <IconBriefcase size={16} className="text-primary shrink-0" />
                  <span className="font-semibold text-sm truncate">
                    Job 1 — {formatDate(selectedDate)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {job1ForDate.length} Einträge
                </span>
              </div>

              {job1ForDate.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Noch keine Job-1-Einträge für diesen Tag
                </div>
              ) : (
                <ul className="divide-y">
                  {job1ForDate.map((entry) => {
                    const h = computeStunden(
                      entry.fields.job1_arbeitsstunden,
                      entry.fields.job1_startzeit,
                      entry.fields.job1_endzeit,
                      entry.fields.job1_pause
                    );
                    const earnings = h * (entry.fields.job1_stundenlohn ?? 0);
                    return (
                      <li key={entry.record_id} className="p-4 flex items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-medium text-sm truncate">
                            {entry.fields.job1_arbeitgeber ?? 'Job 1'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.fields.job1_startzeit && entry.fields.job1_endzeit
                              ? `${entry.fields.job1_startzeit} – ${entry.fields.job1_endzeit}${entry.fields.job1_pause ? ` (${entry.fields.job1_pause} Min. Pause)` : ''}`
                              : formatHours(h)}
                          </p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{formatHours(h)}</span>
                            {entry.fields.job1_stundenlohn ? (
                              <span>{formatCurrency(earnings)}</span>
                            ) : null}
                          </div>
                          {entry.fields.job1_notizen && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {entry.fields.job1_notizen}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditJob1(entry);
                              setJob1DialogOpen(true);
                            }}
                          >
                            <IconPencil size={14} stroke={2} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteJob1Target(entry)}
                          >
                            <IconTrash size={14} stroke={2} />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setEditJob1(null);
                setJob1DialogOpen(true);
              }}
            >
              <IconPlus size={16} className="mr-2" />
              Job 1 Eintrag hinzufügen
            </Button>

            <div className="flex gap-3 justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setCurrentStep(3)}>
                  Überspringen
                </Button>
                <Button onClick={() => setCurrentStep(3)}>Weiter</Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Job 2 Schicht */}
        {currentStep === 3 && (
          <div className="space-y-5">
            {/* Live stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-card p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconClock size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-medium">Stunden Job 2</span>
                </div>
                <p className="text-xl font-bold truncate">{formatHours(job2TotalHours)}</p>
              </div>
              <div className="rounded-2xl border bg-card p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconCurrencyEuro size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-medium">Verdienst Job 2</span>
                </div>
                <p className="text-xl font-bold truncate">{formatCurrency(job2TotalEarnings)}</p>
              </div>
            </div>

            {/* Entries list */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <IconBriefcase size={16} className="text-primary shrink-0" />
                  <span className="font-semibold text-sm truncate">
                    Job 2 — {formatDate(selectedDate)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {job2ForDate.length} Einträge
                </span>
              </div>

              {job2ForDate.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Noch keine Job-2-Einträge für diesen Tag
                </div>
              ) : (
                <ul className="divide-y">
                  {job2ForDate.map((entry) => {
                    const h = computeStunden(
                      entry.fields.job2_arbeitsstunden,
                      entry.fields.job2_startzeit,
                      entry.fields.job2_endzeit,
                      entry.fields.job2_pause
                    );
                    const earnings = h * (entry.fields.job2_stundenlohn ?? 0);
                    return (
                      <li key={entry.record_id} className="p-4 flex items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-medium text-sm truncate">
                            {entry.fields.job2_arbeitgeber ?? 'Job 2'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.fields.job2_startzeit && entry.fields.job2_endzeit
                              ? `${entry.fields.job2_startzeit} – ${entry.fields.job2_endzeit}${entry.fields.job2_pause ? ` (${entry.fields.job2_pause} Min. Pause)` : ''}`
                              : formatHours(h)}
                          </p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{formatHours(h)}</span>
                            {entry.fields.job2_stundenlohn ? (
                              <span>{formatCurrency(earnings)}</span>
                            ) : null}
                          </div>
                          {entry.fields.job2_notizen && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {entry.fields.job2_notizen}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditJob2(entry);
                              setJob2DialogOpen(true);
                            }}
                          >
                            <IconPencil size={14} stroke={2} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteJob2Target(entry)}
                          >
                            <IconTrash size={14} stroke={2} />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setEditJob2(null);
                setJob2DialogOpen(true);
              }}
            >
              <IconPlus size={16} className="mr-2" />
              Job 2 Eintrag hinzufügen
            </Button>

            <div className="flex gap-3 justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setCurrentStep(4)}>
                  Überspringen
                </Button>
                <Button onClick={() => setCurrentStep(4)}>Weiter</Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Tagesabschluss */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {/* Success indicator */}
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                <IconCheck size={28} className="text-green-600" stroke={2.5} />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold">Tag erfasst!</h2>
                <p className="text-sm text-muted-foreground">
                  Zusammenfassung für {formatDate(selectedDate)}
                </p>
              </div>
            </div>

            {/* Job 1 summary */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                <IconBriefcase size={15} className="text-primary shrink-0" />
                <span className="font-semibold text-sm">Job 1</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {job1ForDate.length} Einträge
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x">
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stunden</p>
                  <p className="text-2xl font-bold">{formatHours(job1TotalHours)}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Verdienst</p>
                  <p className="text-2xl font-bold">{formatCurrency(job1TotalEarnings)}</p>
                </div>
              </div>
            </div>

            {/* Job 2 summary */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                <IconBriefcase size={15} className="text-primary shrink-0" />
                <span className="font-semibold text-sm">Job 2</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {job2ForDate.length} Einträge
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x">
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stunden</p>
                  <p className="text-2xl font-bold">{formatHours(job2TotalHours)}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Verdienst</p>
                  <p className="text-2xl font-bold">{formatCurrency(job2TotalEarnings)}</p>
                </div>
              </div>
            </div>

            {/* Combined total */}
            <div className="rounded-2xl border-2 border-primary bg-primary/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/20 flex items-center gap-2">
                <IconCurrencyEuro size={15} className="text-primary shrink-0" />
                <span className="font-bold text-sm text-primary">Tagesgesamt</span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-primary/20">
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Gesamtstunden</p>
                  <p className="text-2xl font-bold text-primary">{formatHours(combinedHours)}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Gesamtverdienst</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(combinedEarnings)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRestart}
              >
                <IconRefresh size={16} className="mr-2" />
                Neuen Tag erfassen
              </Button>
              <Button asChild className="flex-1">
                <a href="#/">Zum Dashboard</a>
              </Button>
            </div>
          </div>
        )}
      </IntentWizardShell>

      {/* Job 1 Dialog */}
      <Job1StundeneintragDialog
        open={job1DialogOpen}
        onClose={() => {
          setJob1DialogOpen(false);
          setEditJob1(null);
        }}
        onSubmit={async (fields) => {
          if (editJob1) {
            await LivingAppsService.updateJob1StundeneintragEntry(editJob1.record_id, fields);
          } else {
            await LivingAppsService.createJob1StundeneintragEntry({
              ...fields,
              job1_datum: selectedDate,
            });
          }
          await fetchAll();
        }}
        defaultValues={
          editJob1
            ? editJob1.fields
            : selectedDate
            ? { job1_datum: selectedDate }
            : undefined
        }
        enablePhotoScan={AI_PHOTO_SCAN['Job1Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job1Stundeneintrag']}
      />

      {/* Job 2 Dialog */}
      <Job2StundeneintragDialog
        open={job2DialogOpen}
        onClose={() => {
          setJob2DialogOpen(false);
          setEditJob2(null);
        }}
        onSubmit={async (fields) => {
          if (editJob2) {
            await LivingAppsService.updateJob2StundeneintragEntry(editJob2.record_id, fields);
          } else {
            await LivingAppsService.createJob2StundeneintragEntry({
              ...fields,
              job2_datum: selectedDate,
            });
          }
          await fetchAll();
        }}
        defaultValues={
          editJob2
            ? editJob2.fields
            : selectedDate
            ? { job2_datum: selectedDate }
            : undefined
        }
        enablePhotoScan={AI_PHOTO_SCAN['Job2Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job2Stundeneintrag']}
      />

      {/* Delete confirmations */}
      <ConfirmDialog
        open={!!deleteJob1Target}
        title="Job-1-Eintrag löschen"
        description="Möchtest du diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDeleteJob1}
        onClose={() => setDeleteJob1Target(null)}
      />
      <ConfirmDialog
        open={!!deleteJob2Target}
        title="Job-2-Eintrag löschen"
        description="Möchtest du diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDeleteJob2}
        onClose={() => setDeleteJob2Target(null)}
      />
    </>
  );
}
