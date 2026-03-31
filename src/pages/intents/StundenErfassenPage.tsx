import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { LivingAppsService } from '@/services/livingAppsService';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconBriefcase, IconClock, IconCurrencyEuro, IconCheck, IconPlus } from '@tabler/icons-react';

const steps = [
  { label: 'Job auswählen' },
  { label: 'Stunden eintragen' },
  { label: 'Tagesabschluss' },
];

function calcHours(
  start: string | undefined,
  end: string | undefined,
  pause: number | undefined,
  directHours: number | undefined
): number {
  if (directHours != null) return directHours;
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm) - (pause ?? 0);
  return Math.max(0, mins / 60);
}

function calcEarnings(hours: number, stundenlohn: number | undefined): number {
  return hours * (stundenlohn ?? 0);
}

function formatHours(h: number): string {
  return h.toFixed(2) + ' h';
}

function formatEuro(amount: number): string {
  return '€ ' + amount.toFixed(2);
}

export default function StundenErfassenPage() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedJob, setSelectedJob] = useState<'job1' | 'job2' | null>(null);
  const [job1Entries, setJob1Entries] = useState<Job1Stundeneintrag[]>([]);
  const [job2Entries, setJob2Entries] = useState<Job2Stundeneintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchEntries = async () => {
    try {
      const [j1, j2] = await Promise.all([
        LivingAppsService.getJob1Stundeneintrag(),
        LivingAppsService.getJob2Stundeneintrag(),
      ]);
      setJob1Entries(j1);
      setJob2Entries(j2);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Einträge'));
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchEntries().finally(() => setLoading(false));
  }, []);

  // Today's entries per job
  const todayJob1 = job1Entries.filter(e => e.fields.job1_datum === today);
  const todayJob2 = job2Entries.filter(e => e.fields.job2_datum === today);

  // Hours and earnings per job today
  const job1TodayHours = todayJob1.reduce((sum, e) => {
    return sum + calcHours(e.fields.job1_startzeit, e.fields.job1_endzeit, e.fields.job1_pause, e.fields.job1_arbeitsstunden);
  }, 0);
  const job1TodayEarnings = todayJob1.reduce((sum, e) => {
    const h = calcHours(e.fields.job1_startzeit, e.fields.job1_endzeit, e.fields.job1_pause, e.fields.job1_arbeitsstunden);
    return sum + calcEarnings(h, e.fields.job1_stundenlohn);
  }, 0);

  const job2TodayHours = todayJob2.reduce((sum, e) => {
    return sum + calcHours(e.fields.job2_startzeit, e.fields.job2_endzeit, e.fields.job2_pause, e.fields.job2_arbeitsstunden);
  }, 0);
  const job2TodayEarnings = todayJob2.reduce((sum, e) => {
    const h = calcHours(e.fields.job2_startzeit, e.fields.job2_endzeit, e.fields.job2_pause, e.fields.job2_arbeitsstunden);
    return sum + calcEarnings(h, e.fields.job2_stundenlohn);
  }, 0);

  // Derive job names from entries
  const job1Name = job1Entries.find(e => e.fields.job1_arbeitgeber)?.fields.job1_arbeitgeber ?? 'Job 1';
  const job2Name = job2Entries.find(e => e.fields.job2_arbeitgeber)?.fields.job2_arbeitgeber ?? 'Job 2';

  // Current job's today entries (for step 2 display)
  const currentTodayEntries = selectedJob === 'job1' ? todayJob1 : todayJob2;
  const currentTodayHours = selectedJob === 'job1' ? job1TodayHours : job2TodayHours;
  const currentTodayEarnings = selectedJob === 'job1' ? job1TodayEarnings : job2TodayEarnings;

  function handleJobSelect(id: string) {
    setSelectedJob(id as 'job1' | 'job2');
    setCurrentStep(2);
  }

  function handleRestart() {
    setSelectedJob(null);
    setCurrentStep(1);
  }

  return (
    <IntentWizardShell
      title="Schicht erfassen"
      subtitle="Arbeitszeit für heute schnell eintragen"
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={() => {
        setLoading(true);
        fetchEntries().finally(() => setLoading(false));
      }}
    >
      {/* Step 1: Job auswählen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Für welchen Job möchtest du heute Stunden eintragen?
          </p>
          <EntitySelectStep
            items={[
              {
                id: 'job1',
                title: job1Name,
                subtitle: 'Job 1',
                icon: <IconBriefcase size={18} className="text-primary" />,
                stats: [
                  { label: 'Heute', value: formatHours(job1TodayHours) },
                  { label: 'Verdienst', value: formatEuro(job1TodayEarnings) },
                ],
              },
              {
                id: 'job2',
                title: job2Name,
                subtitle: 'Job 2',
                icon: <IconBriefcase size={18} className="text-primary" />,
                stats: [
                  { label: 'Heute', value: formatHours(job2TodayHours) },
                  { label: 'Verdienst', value: formatEuro(job2TodayEarnings) },
                ],
              },
            ]}
            onSelect={handleJobSelect}
            searchPlaceholder="Job suchen..."
            emptyIcon={<IconBriefcase size={32} />}
            emptyText="Kein Job gefunden."
          />
        </div>
      )}

      {/* Step 2: Stunden eintragen */}
      {currentStep === 2 && selectedJob !== null && (
        <div className="space-y-4">
          {/* Live total card */}
          <div className="rounded-xl border bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-primary">
              <IconClock size={20} />
              <span className="font-semibold text-sm">Heute gearbeitet</span>
            </div>
            <div className="flex gap-4 sm:ml-auto">
              <div className="flex items-center gap-1.5">
                <IconClock size={15} className="text-muted-foreground" />
                <span className="font-semibold text-sm">{formatHours(currentTodayHours)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconCurrencyEuro size={15} className="text-muted-foreground" />
                <span className="font-semibold text-sm">{formatEuro(currentTodayEarnings)}</span>
              </div>
            </div>
          </div>

          {/* Today's existing entries list */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Heutige Einträge für {selectedJob === 'job1' ? job1Name : job2Name}
            </h3>
            {currentTodayEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/30 py-8 text-center">
                <IconClock size={28} className="mx-auto text-muted-foreground opacity-40 mb-2" />
                <p className="text-sm text-muted-foreground">Noch keine Einträge für heute.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedJob === 'job1'
                  ? todayJob1.map(entry => {
                      const h = calcHours(
                        entry.fields.job1_startzeit,
                        entry.fields.job1_endzeit,
                        entry.fields.job1_pause,
                        entry.fields.job1_arbeitsstunden
                      );
                      const earnings = calcEarnings(h, entry.fields.job1_stundenlohn);
                      return (
                        <div
                          key={entry.record_id}
                          className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-3 overflow-hidden"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <IconClock size={16} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {entry.fields.job1_startzeit && entry.fields.job1_endzeit
                                ? `${entry.fields.job1_startzeit} – ${entry.fields.job1_endzeit}`
                                : 'Keine Zeitangabe'}
                            </div>
                            {entry.fields.job1_pause != null && entry.fields.job1_pause > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Pause: {entry.fields.job1_pause} min
                              </div>
                            )}
                          </div>
                          <div className="flex gap-3 text-xs shrink-0">
                            <span className="font-medium">{formatHours(h)}</span>
                            {earnings > 0 && (
                              <span className="text-muted-foreground">{formatEuro(earnings)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  : todayJob2.map(entry => {
                      const h = calcHours(
                        entry.fields.job2_startzeit,
                        entry.fields.job2_endzeit,
                        entry.fields.job2_pause,
                        entry.fields.job2_arbeitsstunden
                      );
                      const earnings = calcEarnings(h, entry.fields.job2_stundenlohn);
                      return (
                        <div
                          key={entry.record_id}
                          className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-3 overflow-hidden"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <IconClock size={16} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {entry.fields.job2_startzeit && entry.fields.job2_endzeit
                                ? `${entry.fields.job2_startzeit} – ${entry.fields.job2_endzeit}`
                                : 'Keine Zeitangabe'}
                            </div>
                            {entry.fields.job2_pause != null && entry.fields.job2_pause > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Pause: {entry.fields.job2_pause} min
                              </div>
                            )}
                          </div>
                          <div className="flex gap-3 text-xs shrink-0">
                            <span className="font-medium">{formatHours(h)}</span>
                            {earnings > 0 && (
                              <span className="text-muted-foreground">{formatEuro(earnings)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
              </div>
            )}
          </div>

          {/* Add entry button */}
          <Button
            className="w-full gap-2"
            onClick={() => setDialogOpen(true)}
          >
            <IconPlus size={16} />
            Neuen Eintrag hinzufügen
          </Button>

          {/* Dialogs */}
          {selectedJob === 'job1' && (
            <Job1StundeneintragDialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.createJob1StundeneintragEntry(fields);
                await fetchEntries();
              }}
              defaultValues={undefined}
              enablePhotoScan={false}
              enablePhotoLocation={false}
            />
          )}
          {selectedJob === 'job2' && (
            <Job2StundeneintragDialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.createJob2StundeneintragEntry(fields);
                await fetchEntries();
              }}
              defaultValues={undefined}
              enablePhotoScan={false}
              enablePhotoLocation={false}
            />
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="flex-1"
            >
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(3)}
              className="flex-1"
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Tagesabschluss */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Success message */}
          <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
              <IconCheck size={20} className="text-green-600 dark:text-green-400" stroke={2.5} />
            </div>
            <div>
              <p className="font-semibold text-sm text-green-800 dark:text-green-300">
                Schicht erfolgreich erfasst!
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                Deine Arbeitszeit wurde für heute gespeichert.
              </p>
            </div>
          </div>

          {/* Daily summary card */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">Tagesübersicht — {format(new Date(), 'dd.MM.yyyy')}</h3>
            </div>
            <div className="divide-y">
              {/* Job 1 row */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IconBriefcase size={15} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job1Name}</p>
                  <p className="text-xs text-muted-foreground">Job 1</p>
                </div>
                <div className="flex gap-4 text-sm shrink-0">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <IconClock size={13} />
                    <span className="font-medium text-foreground">{formatHours(job1TodayHours)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <IconCurrencyEuro size={13} />
                    <span className="font-medium text-foreground">{formatEuro(job1TodayEarnings)}</span>
                  </div>
                </div>
              </div>

              {/* Job 2 row */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IconBriefcase size={15} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job2Name}</p>
                  <p className="text-xs text-muted-foreground">Job 2</p>
                </div>
                <div className="flex gap-4 text-sm shrink-0">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <IconClock size={13} />
                    <span className="font-medium text-foreground">{formatHours(job2TodayHours)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <IconCurrencyEuro size={13} />
                    <span className="font-medium text-foreground">{formatEuro(job2TodayEarnings)}</span>
                  </div>
                </div>
              </div>

              {/* Total row */}
              <div className="px-4 py-3 flex items-center gap-3 bg-primary/5">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <IconCurrencyEuro size={15} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Gesamt heute</p>
                </div>
                <div className="flex gap-4 text-sm shrink-0">
                  <div className="flex items-center gap-1.5">
                    <IconClock size={13} className="text-muted-foreground" />
                    <span className="font-bold">{formatHours(job1TodayHours + job2TodayHours)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconCurrencyEuro size={13} className="text-muted-foreground" />
                    <span className="font-bold">{formatEuro(job1TodayEarnings + job2TodayEarnings)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleRestart}
              className="flex-1"
            >
              Weitere Schicht erfassen
            </Button>
            <Button asChild className="flex-1">
              <a href="#/">Fertig</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
