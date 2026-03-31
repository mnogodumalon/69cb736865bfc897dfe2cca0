import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  IconPlus,
  IconBriefcase,
  IconCalendar,
  IconClock,
  IconCurrencyEuro,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Datum' },
  { label: 'Job 1' },
  { label: 'Job 2' },
  { label: 'Abschluss' },
];

function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function getInitialDateFromUrl(): string {
  try {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return getTodayString();
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    return params.get('date') ?? getTodayString();
  } catch {
    return getTodayString();
  }
}

function getInitialStepFromUrl(): number {
  try {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return 1;
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    const step = parseInt(params.get('step') ?? '', 10);
    if (step >= 1 && step <= 4) return step;
  } catch {
    // ignore
  }
  return 1;
}

export default function TageserfassungPage() {
  const { job1Stundeneintrag, job2Stundeneintrag, loading, error, fetchAll } = useDashboardData();

  const [currentStep, setCurrentStep] = useState<number>(getInitialStepFromUrl);
  const [selectedDate, setSelectedDate] = useState<string>(getInitialDateFromUrl);
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);

  // Filter entries by selected date
  const job1Entries = useMemo<Job1Stundeneintrag[]>(() => {
    if (!job1Stundeneintrag) return [];
    return job1Stundeneintrag.filter(
      (e) => e.fields.job1_datum === selectedDate
    );
  }, [job1Stundeneintrag, selectedDate]);

  const job2Entries = useMemo<Job2Stundeneintrag[]>(() => {
    if (!job2Stundeneintrag) return [];
    return job2Stundeneintrag.filter(
      (e) => e.fields.job2_datum === selectedDate
    );
  }, [job2Stundeneintrag, selectedDate]);

  const job1TotalHours = useMemo(
    () => job1Entries.reduce((sum, e) => sum + (e.fields.job1_arbeitsstunden ?? 0), 0),
    [job1Entries]
  );

  const job2TotalHours = useMemo(
    () => job2Entries.reduce((sum, e) => sum + (e.fields.job2_arbeitsstunden ?? 0), 0),
    [job2Entries]
  );

  const job1TotalEarnings = useMemo(
    () =>
      job1Entries.reduce(
        (sum, e) =>
          sum + (e.fields.job1_arbeitsstunden ?? 0) * (e.fields.job1_stundenlohn ?? 0),
        0
      ),
    [job1Entries]
  );

  const job2TotalEarnings = useMemo(
    () =>
      job2Entries.reduce(
        (sum, e) =>
          sum + (e.fields.job2_arbeitsstunden ?? 0) * (e.fields.job2_stundenlohn ?? 0),
        0
      ),
    [job2Entries]
  );

  const handleJob1Submit = async (fields: Job1Stundeneintrag['fields']) => {
    await LivingAppsService.createJob1StundeneintragEntry(fields);
    await fetchAll();
    setJob1DialogOpen(false);
  };

  const handleJob2Submit = async (fields: Job2Stundeneintrag['fields']) => {
    await LivingAppsService.createJob2StundeneintragEntry(fields);
    await fetchAll();
    setJob2DialogOpen(false);
  };

  const handleReset = () => {
    setSelectedDate(getTodayString());
    setCurrentStep(1);
  };

  const displayDate = useMemo(() => {
    try {
      return format(new Date(selectedDate + 'T00:00:00'), 'EEEE, dd. MMMM yyyy', { locale: de });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Count entries for step 1 summary
  const job1CountForDate = job1Entries.length;
  const job2CountForDate = job2Entries.length;

  return (
    <div className="p-4 sm:p-6">
      <IntentWizardShell
        title="Tageserfassung"
        subtitle="Arbeitszeiten fur einen Tag in beiden Jobs erfassen"
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        loading={loading}
        error={error ?? null}
        onRetry={fetchAll}
      >
        {/* Step 1: Datum wählen */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IconCalendar size={18} className="text-primary" stroke={2} />
                  Welchen Tag möchtest du erfassen?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date-input">Datum</Label>
                  <Input
                    id="date-input"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full max-w-xs"
                  />
                </div>

                {selectedDate && (
                  <div className="rounded-xl bg-muted/50 p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">{displayDate}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                          <IconBriefcase size={16} className="text-blue-600 dark:text-blue-400" stroke={2} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Job 1</p>
                          <p className="text-sm font-semibold truncate">
                            {job1CountForDate === 0
                              ? 'Keine Einträge'
                              : `${job1CountForDate} ${job1CountForDate === 1 ? 'Eintrag' : 'Einträge'}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center shrink-0">
                          <IconBriefcase size={16} className="text-violet-600 dark:text-violet-400" stroke={2} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Job 2</p>
                          <p className="text-sm font-semibold truncate">
                            {job2CountForDate === 0
                              ? 'Keine Einträge'
                              : `${job2CountForDate} ${job2CountForDate === 1 ? 'Eintrag' : 'Einträge'}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!selectedDate}
                className="gap-2"
              >
                Weiter
                <IconArrowRight size={16} stroke={2} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Job 1 erfassen */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                    <IconBriefcase size={14} className="text-blue-600 dark:text-blue-400" stroke={2} />
                  </div>
                  Job 1 — {formatDate(selectedDate)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Live counter */}
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
                  <IconClock size={16} className="text-blue-600 dark:text-blue-400 shrink-0" stroke={2} />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {job1TotalHours.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Stunden für Job 1 heute
                  </span>
                </div>

                {/* Existing entries */}
                {job1Entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <IconClock size={32} className="mx-auto mb-2 opacity-30" stroke={1.5} />
                    <p className="text-sm">Noch keine Einträge für diesen Tag</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {job1Entries.map((entry) => (
                      <div
                        key={entry.record_id}
                        className="flex items-center gap-3 rounded-lg border bg-card p-3 overflow-hidden"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                          <IconBriefcase size={14} className="text-blue-600 dark:text-blue-400" stroke={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {entry.fields.job1_arbeitgeber ?? 'Job 1'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.fields.job1_startzeit && entry.fields.job1_endzeit
                              ? `${entry.fields.job1_startzeit} – ${entry.fields.job1_endzeit}`
                              : 'Zeiten nicht angegeben'}
                            {entry.fields.job1_pause
                              ? ` · ${entry.fields.job1_pause} Min. Pause`
                              : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {entry.fields.job1_arbeitsstunden != null
                              ? `${entry.fields.job1_arbeitsstunden.toLocaleString('de-DE', { maximumFractionDigits: 2 })} h`
                              : '—'}
                          </p>
                          {entry.fields.job1_stundenlohn != null && entry.fields.job1_arbeitsstunden != null && (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(entry.fields.job1_arbeitsstunden * entry.fields.job1_stundenlohn)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add button */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setJob1DialogOpen(true)}
                >
                  <IconPlus size={16} stroke={2} />
                  Neuen Eintrag erfassen
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <IconArrowLeft size={16} stroke={2} />
                Zurück
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="gap-2">
                Weiter
                <IconArrowRight size={16} stroke={2} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Job 2 erfassen */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-950 flex items-center justify-center shrink-0">
                    <IconBriefcase size={14} className="text-violet-600 dark:text-violet-400" stroke={2} />
                  </div>
                  Job 2 — {formatDate(selectedDate)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Live counter */}
                <div className="flex items-center gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 px-4 py-3">
                  <IconClock size={16} className="text-violet-600 dark:text-violet-400 shrink-0" stroke={2} />
                  <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                    {job2TotalHours.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Stunden für Job 2 heute
                  </span>
                </div>

                {/* Existing entries */}
                {job2Entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <IconClock size={32} className="mx-auto mb-2 opacity-30" stroke={1.5} />
                    <p className="text-sm">Noch keine Einträge für diesen Tag</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {job2Entries.map((entry) => (
                      <div
                        key={entry.record_id}
                        className="flex items-center gap-3 rounded-lg border bg-card p-3 overflow-hidden"
                      >
                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center shrink-0">
                          <IconBriefcase size={14} className="text-violet-600 dark:text-violet-400" stroke={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {entry.fields.job2_arbeitgeber ?? 'Job 2'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.fields.job2_startzeit && entry.fields.job2_endzeit
                              ? `${entry.fields.job2_startzeit} – ${entry.fields.job2_endzeit}`
                              : 'Zeiten nicht angegeben'}
                            {entry.fields.job2_pause
                              ? ` · ${entry.fields.job2_pause} Min. Pause`
                              : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {entry.fields.job2_arbeitsstunden != null
                              ? `${entry.fields.job2_arbeitsstunden.toLocaleString('de-DE', { maximumFractionDigits: 2 })} h`
                              : '—'}
                          </p>
                          {entry.fields.job2_stundenlohn != null && entry.fields.job2_arbeitsstunden != null && (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(entry.fields.job2_arbeitsstunden * entry.fields.job2_stundenlohn)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add button */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setJob2DialogOpen(true)}
                >
                  <IconPlus size={16} stroke={2} />
                  Neuen Eintrag erfassen
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
                <IconArrowLeft size={16} stroke={2} />
                Zurück
              </Button>
              <Button onClick={() => setCurrentStep(4)} className="gap-2">
                Weiter
                <IconArrowRight size={16} stroke={2} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Tagesabschluss */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {/* Summary header */}
            <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <IconCheck size={20} className="text-primary" stroke={2.5} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Tagesabschluss</p>
                <p className="text-sm text-muted-foreground truncate">{displayDate}</p>
              </div>
            </div>

            {/* Job 1 summary card */}
            <Card className="overflow-hidden border-blue-200 dark:border-blue-900">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <div className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                    <IconBriefcase size={12} className="text-blue-600 dark:text-blue-400" stroke={2} />
                  </div>
                  Job 1
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <IconClock size={12} stroke={2} />
                      Stunden
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {job1TotalHours.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <IconCurrencyEuro size={12} stroke={2} />
                      Verdienst
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {job1TotalEarnings > 0 ? formatCurrency(job1TotalEarnings) : '—'}
                    </p>
                  </div>
                </div>
                {job1Entries.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Keine Einträge für diesen Tag</p>
                )}
              </CardContent>
            </Card>

            {/* Job 2 summary card */}
            <Card className="overflow-hidden border-violet-200 dark:border-violet-900">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <div className="w-5 h-5 rounded bg-violet-100 dark:bg-violet-950 flex items-center justify-center shrink-0">
                    <IconBriefcase size={12} className="text-violet-600 dark:text-violet-400" stroke={2} />
                  </div>
                  Job 2
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <IconClock size={12} stroke={2} />
                      Stunden
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {job2TotalHours.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <IconCurrencyEuro size={12} stroke={2} />
                      Verdienst
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {job2TotalEarnings > 0 ? formatCurrency(job2TotalEarnings) : '—'}
                    </p>
                  </div>
                </div>
                {job2Entries.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Keine Einträge für diesen Tag</p>
                )}
              </CardContent>
            </Card>

            {/* Combined totals */}
            <Card className="overflow-hidden bg-muted/30">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Gesamt Stunden</p>
                    <p className="text-3xl font-bold">
                      {(job1TotalHours + job2TotalHours).toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Gesamt Verdienst</p>
                    <p className="text-3xl font-bold">
                      {job1TotalEarnings + job2TotalEarnings > 0
                        ? formatCurrency(job1TotalEarnings + job2TotalEarnings)
                        : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="gap-2 flex-1"
              >
                <IconRefresh size={16} stroke={2} />
                Neuen Tag erfassen
              </Button>
              <Button asChild className="gap-2 flex-1">
                <a href="#/">
                  <IconCheck size={16} stroke={2} />
                  Fertig
                </a>
              </Button>
            </div>
          </div>
        )}
      </IntentWizardShell>

      {/* Job 1 Dialog */}
      <Job1StundeneintragDialog
        open={job1DialogOpen}
        onClose={() => setJob1DialogOpen(false)}
        onSubmit={handleJob1Submit}
        defaultValues={{ job1_datum: selectedDate }}
        enablePhotoScan={AI_PHOTO_SCAN['Job1Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job1Stundeneintrag']}
      />

      {/* Job 2 Dialog */}
      <Job2StundeneintragDialog
        open={job2DialogOpen}
        onClose={() => setJob2DialogOpen(false)}
        onSubmit={handleJob2Submit}
        defaultValues={{ job2_datum: selectedDate }}
        enablePhotoScan={AI_PHOTO_SCAN['Job2Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job2Stundeneintrag']}
      />
    </div>
  );
}
