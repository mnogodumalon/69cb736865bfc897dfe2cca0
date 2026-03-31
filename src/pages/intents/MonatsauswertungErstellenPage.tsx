import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import type { Job1Stundeneintrag, Job2Stundeneintrag, CreateGesamtuebersicht } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import {
  IconCalendar,
  IconChartBar,
  IconPlus,
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconCurrencyEuro,
  IconClockHour4,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Zeitraum' },
  { label: 'Job 1' },
  { label: 'Job 2' },
  { label: 'Erstellen' },
];

const formatDate = (d: Date): string => d.toISOString().split('T')[0];

const formatDisplayDate = (dateStr: string): string => {
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy', { locale: de });
  } catch {
    return dateStr;
  }
};

export default function MonatsauswertungErstellenPage() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [currentStep, setCurrentStep] = useState(1);
  const [vonDate, setVonDate] = useState<string>(() => formatDate(firstOfMonth));
  const [bisDate, setBisDate] = useState<string>(() => formatDate(today));
  const [notizen, setNotizen] = useState('');
  const [job1Entries, setJob1Entries] = useState<Job1Stundeneintrag[]>([]);
  const [job2Entries, setJob2Entries] = useState<Job2Stundeneintrag[]>([]);
  const [selectedJob1Id, setSelectedJob1Id] = useState<string | null>(null);
  const [selectedJob2Id, setSelectedJob2Id] = useState<string | null>(null);
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      LivingAppsService.getJob1Stundeneintrag(),
      LivingAppsService.getJob2Stundeneintrag(),
    ])
      .then(([j1, j2]) => {
        setJob1Entries(j1);
        setJob2Entries(j2);
      })
      .catch((e: unknown) => setFetchError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, []);

  const filteredJob1 = job1Entries.filter(entry => {
    if (!entry.fields.job1_datum) return true;
    return entry.fields.job1_datum >= vonDate && entry.fields.job1_datum <= bisDate;
  });

  const filteredJob2 = job2Entries.filter(entry => {
    if (!entry.fields.job2_datum) return true;
    return entry.fields.job2_datum >= vonDate && entry.fields.job2_datum <= bisDate;
  });

  const selectedJob1Entry = job1Entries.find(e => e.record_id === selectedJob1Id) ?? null;
  const selectedJob2Entry = job2Entries.find(e => e.record_id === selectedJob2Id) ?? null;

  const job1Verdienst = selectedJob1Entry
    ? (selectedJob1Entry.fields.job1_arbeitsstunden ?? 0) * (selectedJob1Entry.fields.job1_stundenlohn ?? 0)
    : 0;
  const job2Verdienst = selectedJob2Entry
    ? (selectedJob2Entry.fields.job2_arbeitsstunden ?? 0) * (selectedJob2Entry.fields.job2_stundenlohn ?? 0)
    : 0;
  const totalStunden =
    (selectedJob1Entry?.fields.job1_arbeitsstunden ?? 0) +
    (selectedJob2Entry?.fields.job2_arbeitsstunden ?? 0);
  const totalVerdienst = job1Verdienst + job2Verdienst;

  const job1Items = filteredJob1.map(entry => ({
    id: entry.record_id,
    title: entry.fields.job1_arbeitgeber ?? 'Unbekannt',
    subtitle: entry.fields.job1_datum ? formatDisplayDate(entry.fields.job1_datum) : '',
    stats: [
      { label: 'Stunden', value: String(entry.fields.job1_arbeitsstunden ?? 0) },
      {
        label: 'Verdienst',
        value: `${((entry.fields.job1_arbeitsstunden ?? 0) * (entry.fields.job1_stundenlohn ?? 0)).toFixed(2)} €`,
      },
      { label: 'Stundenlohn', value: `${entry.fields.job1_stundenlohn ?? 0} €` },
    ],
  }));

  const job2Items = filteredJob2.map(entry => ({
    id: entry.record_id,
    title: entry.fields.job2_arbeitgeber ?? 'Unbekannt',
    subtitle: entry.fields.job2_datum ? formatDisplayDate(entry.fields.job2_datum) : '',
    stats: [
      { label: 'Stunden', value: String(entry.fields.job2_arbeitsstunden ?? 0) },
      {
        label: 'Verdienst',
        value: `${((entry.fields.job2_arbeitsstunden ?? 0) * (entry.fields.job2_stundenlohn ?? 0)).toFixed(2)} €`,
      },
      { label: 'Stundenlohn', value: `${entry.fields.job2_stundenlohn ?? 0} €` },
    ],
  }));

  const handleCreateGesamtuebersicht = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const gesamtFields: CreateGesamtuebersicht = {
        auswertung_von: vonDate,
        auswertung_bis: bisDate,
        auswertung_notizen: notizen || undefined,
        gesamt_stunden: totalStunden,
        gesamt_verdienst: totalVerdienst,
        job1_eintraege: selectedJob1Id
          ? createRecordUrl(APP_IDS.JOB_1_STUNDENEINTRAG, selectedJob1Id)
          : undefined,
        job2_eintraege: selectedJob2Id
          ? createRecordUrl(APP_IDS.JOB_2_STUNDENEINTRAG, selectedJob2Id)
          : undefined,
      };
      await LivingAppsService.createGesamtuebersichtEntry(gesamtFields);
      setCreated(true);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    const newToday = new Date();
    const newFirstOfMonth = new Date(newToday.getFullYear(), newToday.getMonth(), 1);
    setCurrentStep(1);
    setVonDate(formatDate(newFirstOfMonth));
    setBisDate(formatDate(newToday));
    setNotizen('');
    setSelectedJob1Id(null);
    setSelectedJob2Id(null);
    setCreated(false);
    setSubmitError(null);
  };

  const retry = () => {
    setFetchError(null);
    setLoading(true);
    Promise.all([
      LivingAppsService.getJob1Stundeneintrag(),
      LivingAppsService.getJob2Stundeneintrag(),
    ])
      .then(([j1, j2]) => {
        setJob1Entries(j1);
        setJob2Entries(j2);
      })
      .catch((e: unknown) => setFetchError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };

  return (
    <IntentWizardShell
      title="Monatsauswertung erstellen"
      subtitle="Erstelle eine Gesamtübersicht für einen Zeitraum deiner Wahl"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={fetchError}
      onRetry={retry}
    >
      {/* Step 1: Zeitraum festlegen */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconCalendar size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Zeitraum festlegen</h2>
                <p className="text-sm text-muted-foreground">Wähle den Auswertungszeitraum</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="von-date">Von</Label>
                <Input
                  id="von-date"
                  type="date"
                  value={vonDate}
                  onChange={e => setVonDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bis-date">Bis</Label>
                <Input
                  id="bis-date"
                  type="date"
                  value={bisDate}
                  onChange={e => setBisDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notizen">Notizen zur Auswertung <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="notizen"
                placeholder="Optionale Anmerkungen zum Auswertungszeitraum..."
                value={notizen}
                onChange={e => setNotizen(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setCurrentStep(2)}
              disabled={!vonDate || !bisDate}
              className="gap-2"
            >
              Weiter
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Job 1 Eintrag auswählen */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconClockHour4 size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Job 1 Eintrag auswählen</h2>
                <p className="text-sm text-muted-foreground">
                  Einträge vom {formatDisplayDate(vonDate)} bis {formatDisplayDate(bisDate)}
                </p>
              </div>
            </div>

            {selectedJob1Id && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                <IconCheck size={15} stroke={2.5} />
                Eintrag ausgewählt
              </div>
            )}

            <EntitySelectStep
              items={job1Items}
              onSelect={id => setSelectedJob1Id(id === selectedJob1Id ? null : id)}
              searchPlaceholder="Arbeitgeber suchen..."
              emptyIcon={<IconClockHour4 size={32} />}
              emptyText="Keine Job 1 Einträge im gewählten Zeitraum gefunden."
              createLabel="Neuen Job 1 Eintrag erstellen"
              onCreateNew={() => setJob1DialogOpen(true)}
              createDialog={
                <Job1StundeneintragDialog
                  open={job1DialogOpen}
                  onClose={() => setJob1DialogOpen(false)}
                  onSubmit={async (fields: Job1Stundeneintrag['fields']) => {
                    await LivingAppsService.createJob1StundeneintragEntry(fields);
                    const updated = await LivingAppsService.getJob1Stundeneintrag();
                    setJob1Entries(updated);
                    if (updated.length > 0) {
                      setSelectedJob1Id(updated[updated.length - 1].record_id);
                    }
                    setJob1DialogOpen(false);
                  }}
                />
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
              <IconChevronLeft size={16} />
              Zurück
            </Button>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedJob1Id(null);
                  setCurrentStep(3);
                }}
              >
                Ohne Job 1 überspringen
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                disabled={!selectedJob1Id}
                className="gap-2"
              >
                Weiter
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Job 2 Eintrag auswählen */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconClockHour4 size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Job 2 Eintrag auswählen</h2>
                <p className="text-sm text-muted-foreground">
                  Einträge vom {formatDisplayDate(vonDate)} bis {formatDisplayDate(bisDate)}
                </p>
              </div>
            </div>

            {selectedJob2Id && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                <IconCheck size={15} stroke={2.5} />
                Eintrag ausgewählt
              </div>
            )}

            <EntitySelectStep
              items={job2Items}
              onSelect={id => setSelectedJob2Id(id === selectedJob2Id ? null : id)}
              searchPlaceholder="Arbeitgeber suchen..."
              emptyIcon={<IconClockHour4 size={32} />}
              emptyText="Keine Job 2 Einträge im gewählten Zeitraum gefunden."
              createLabel="Neuen Job 2 Eintrag erstellen"
              onCreateNew={() => setJob2DialogOpen(true)}
              createDialog={
                <Job2StundeneintragDialog
                  open={job2DialogOpen}
                  onClose={() => setJob2DialogOpen(false)}
                  onSubmit={async (fields: Job2Stundeneintrag['fields']) => {
                    await LivingAppsService.createJob2StundeneintragEntry(fields);
                    const updated = await LivingAppsService.getJob2Stundeneintrag();
                    setJob2Entries(updated);
                    if (updated.length > 0) {
                      setSelectedJob2Id(updated[updated.length - 1].record_id);
                    }
                    setJob2DialogOpen(false);
                  }}
                />
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
              <IconChevronLeft size={16} />
              Zurück
            </Button>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedJob2Id(null);
                  setCurrentStep(4);
                }}
              >
                Ohne Job 2 überspringen
              </Button>
              <Button
                onClick={() => setCurrentStep(4)}
                disabled={!selectedJob2Id}
                className="gap-2"
              >
                Weiter
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Auswertung erstellen */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {created ? (
            <div className="rounded-2xl border bg-card p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <IconCheck size={32} className="text-green-600" stroke={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Auswertung erstellt!</h2>
                <p className="text-sm text-muted-foreground">
                  Die Gesamtübersicht wurde erfolgreich erstellt.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center mt-2">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <IconPlus size={16} />
                  Weitere Auswertung erstellen
                </Button>
                <Button asChild>
                  <a href="#/">Zum Dashboard</a>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-card p-6 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <IconChartBar size={20} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base">Auswertung prüfen</h2>
                    <p className="text-sm text-muted-foreground">Überprüfe die Zusammenfassung vor der Erstellung</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Zeitraum */}
                  <div className="flex items-start justify-between py-3 border-b gap-4">
                    <span className="text-sm text-muted-foreground shrink-0">Zeitraum</span>
                    <span className="text-sm font-medium text-right">
                      {formatDisplayDate(vonDate)} – {formatDisplayDate(bisDate)}
                    </span>
                  </div>

                  {/* Job 1 */}
                  <div className="flex items-start justify-between py-3 border-b gap-4">
                    <span className="text-sm text-muted-foreground shrink-0">Job 1 Eintrag</span>
                    {selectedJob1Entry ? (
                      <div className="text-right">
                        <p className="text-sm font-medium">{selectedJob1Entry.fields.job1_arbeitgeber ?? 'Unbekannt'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedJob1Entry.fields.job1_arbeitsstunden ?? 0} Std. &middot; {job1Verdienst.toFixed(2)} €
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Keiner ausgewählt</span>
                    )}
                  </div>

                  {/* Job 2 */}
                  <div className="flex items-start justify-between py-3 border-b gap-4">
                    <span className="text-sm text-muted-foreground shrink-0">Job 2 Eintrag</span>
                    {selectedJob2Entry ? (
                      <div className="text-right">
                        <p className="text-sm font-medium">{selectedJob2Entry.fields.job2_arbeitgeber ?? 'Unbekannt'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedJob2Entry.fields.job2_arbeitsstunden ?? 0} Std. &middot; {job2Verdienst.toFixed(2)} €
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Keiner ausgewählt</span>
                    )}
                  </div>

                  {/* Gesamtstunden */}
                  <div className="flex items-center justify-between py-3 border-b gap-4">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <IconClockHour4 size={14} />
                      Gesamtstunden
                    </span>
                    <span className="text-sm font-semibold">{totalStunden} Std.</span>
                  </div>

                  {/* Gesamtverdienst */}
                  <div className="flex items-center justify-between py-3 border-b gap-4">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <IconCurrencyEuro size={14} />
                      Gesamtverdienst
                    </span>
                    <span className="text-base font-bold text-primary">{totalVerdienst.toFixed(2)} €</span>
                  </div>

                  {/* Notizen */}
                  {notizen && (
                    <div className="flex items-start justify-between py-3 gap-4">
                      <span className="text-sm text-muted-foreground shrink-0">Notizen</span>
                      <span className="text-sm text-right max-w-xs line-clamp-3">{notizen}</span>
                    </div>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  Fehler beim Erstellen: {submitError}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-2">
                  <IconChevronLeft size={16} />
                  Zurück
                </Button>
                <Button
                  onClick={handleCreateGesamtuebersicht}
                  disabled={submitting}
                  className="gap-2"
                >
                  {submitting ? (
                    <>Erstelle Auswertung...</>
                  ) : (
                    <>
                      <IconChartBar size={16} />
                      Auswertung erstellen
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
