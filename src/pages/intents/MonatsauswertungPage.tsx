import { useState, useEffect } from 'react';
import { format, startOfMonth } from 'date-fns';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { BudgetTracker } from '@/components/BudgetTracker';
import { GesamtuebersichtDialog } from '@/components/dialogs/GesamtuebersichtDialog';
import { Button } from '@/components/ui/button';
import { IconCalendar, IconClock, IconCurrencyEuro, IconCheck, IconFileText, IconChevronRight } from '@tabler/icons-react';

const steps = [
  { label: 'Zeitraum festlegen' },
  { label: 'Einträge prüfen' },
  { label: 'Auswertung speichern' },
];

function calcHoursGeneric(jobType: 'job1' | 'job2', entry: Job1Stundeneintrag | Job2Stundeneintrag): number {
  if (jobType === 'job1') {
    const e = entry as Job1Stundeneintrag;
    if (e.fields.job1_arbeitsstunden != null) return e.fields.job1_arbeitsstunden;
    if (!e.fields.job1_startzeit || !e.fields.job1_endzeit) return 0;
    const [sh, sm] = e.fields.job1_startzeit.split(':').map(Number);
    const [eh, em] = e.fields.job1_endzeit.split(':').map(Number);
    return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm) - (e.fields.job1_pause ?? 0)) / 60);
  } else {
    const e = entry as Job2Stundeneintrag;
    if (e.fields.job2_arbeitsstunden != null) return e.fields.job2_arbeitsstunden;
    if (!e.fields.job2_startzeit || !e.fields.job2_endzeit) return 0;
    const [sh, sm] = e.fields.job2_startzeit.split(':').map(Number);
    const [eh, em] = e.fields.job2_endzeit.split(':').map(Number);
    return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm) - (e.fields.job2_pause ?? 0)) / 60);
  }
}

function inRange(dateStr: string | undefined, von: string, bis: string): boolean {
  if (!dateStr) return false;
  return dateStr >= von && dateStr <= bis;
}

function formatHours(h: number): string {
  return h.toFixed(2).replace('.', ',') + ' h';
}

function formatEarnings(amount: number): string {
  return '€ ' + amount.toFixed(2).replace('.', ',');
}

export default function MonatsauswertungPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const firstOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const [currentStep, setCurrentStep] = useState(1);
  const [vonDate, setVonDate] = useState(firstOfMonth);
  const [bisDate, setBisDate] = useState(today);
  const [job1Entries, setJob1Entries] = useState<Job1Stundeneintrag[]>([]);
  const [job2Entries, setJob2Entries] = useState<Job2Stundeneintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedJob1Id, setSelectedJob1Id] = useState<string>('');
  const [selectedJob2Id, setSelectedJob2Id] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      LivingAppsService.getJob1Stundeneintrag(),
      LivingAppsService.getJob2Stundeneintrag(),
    ]).then(([j1, j2]) => {
      setJob1Entries(j1);
      setJob2Entries(j2);
      setLoading(false);
    }).catch((e: Error) => {
      setError(e);
      setLoading(false);
    });
  }, []);

  // Filtered entries in date range
  const filteredJob1 = job1Entries.filter(e => inRange(e.fields.job1_datum, vonDate, bisDate));
  const filteredJob2 = job2Entries.filter(e => inRange(e.fields.job2_datum, vonDate, bisDate));

  // Totals
  const job1Hours = filteredJob1.reduce((sum, e) => sum + calcHoursGeneric('job1', e), 0);
  const job2Hours = filteredJob2.reduce((sum, e) => sum + calcHoursGeneric('job2', e), 0);
  const totalHours = job1Hours + job2Hours;

  const job1Earnings = filteredJob1.reduce((sum, e) => {
    const h = calcHoursGeneric('job1', e);
    return sum + h * (e.fields.job1_stundenlohn ?? 0);
  }, 0);
  const job2Earnings = filteredJob2.reduce((sum, e) => {
    const h = calcHoursGeneric('job2', e);
    return sum + h * (e.fields.job2_stundenlohn ?? 0);
  }, 0);
  const totalEarnings = job1Earnings + job2Earnings;

  return (
    <IntentWizardShell
      title="Monatsauswertung"
      subtitle="Erstelle eine Gesamtübersicht für einen ausgewählten Zeitraum"
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={() => {
        setLoading(true);
        setError(null);
        Promise.all([
          LivingAppsService.getJob1Stundeneintrag(),
          LivingAppsService.getJob2Stundeneintrag(),
        ]).then(([j1, j2]) => {
          setJob1Entries(j1);
          setJob2Entries(j2);
          setLoading(false);
        }).catch((e: Error) => {
          setError(e);
          setLoading(false);
        });
      }}
    >
      {/* Step 1: Zeitraum festlegen */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2 text-base font-semibold">
              <IconCalendar size={20} className="text-primary shrink-0" />
              <span>Zeitraum festlegen</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="von-date">
                  Von
                </label>
                <input
                  id="von-date"
                  type="date"
                  value={vonDate}
                  onChange={e => setVonDate(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="bis-date">
                  Bis
                </label>
                <input
                  id="bis-date"
                  type="date"
                  value={bisDate}
                  onChange={e => setBisDate(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {vonDate && bisDate && (
              <div className="rounded-xl bg-muted/50 border px-4 py-3 text-sm space-y-1">
                <div className="font-medium text-foreground">
                  Einträge im Zeitraum:{' '}
                  <span className="text-primary font-bold">
                    {filteredJob1.length + filteredJob2.length}
                  </span>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Job 1:{' '}
                    <span className="font-semibold text-foreground">{filteredJob1.length}</span>
                  </span>
                  <span>
                    Job 2:{' '}
                    <span className="font-semibold text-foreground">{filteredJob2.length}</span>
                  </span>
                </div>
              </div>
            )}
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

      {/* Step 2: Einträge prüfen */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Job 1 */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-2">
              <IconClock size={18} className="text-primary shrink-0" />
              <span className="font-semibold text-base">Job 1</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {filteredJob1.length} Einträge
              </span>
            </div>
            {filteredJob1.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Keine Einträge im gewählten Zeitraum
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Datum</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Arbeitgeber</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Zeit</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Stunden</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Verdienst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJob1.map(e => {
                      const h = calcHoursGeneric('job1', e);
                      const earnings = h * (e.fields.job1_stundenlohn ?? 0);
                      return (
                        <tr key={e.record_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {e.fields.job1_datum ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 truncate max-w-[140px]">
                            {e.fields.job1_arbeitgeber ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                            {e.fields.job1_startzeit && e.fields.job1_endzeit
                              ? `${e.fields.job1_startzeit}–${e.fields.job1_endzeit}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">
                            {formatHours(h)}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {e.fields.job1_stundenlohn ? formatEarnings(earnings) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold">
                      <td colSpan={3} className="px-4 py-2.5 text-sm">Gesamt Job 1</td>
                      <td className="px-4 py-2.5 text-right text-sm">{formatHours(job1Hours)}</td>
                      <td className="px-4 py-2.5 text-right text-sm">{formatEarnings(job1Earnings)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Job 2 */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-2">
              <IconClock size={18} className="text-primary shrink-0" />
              <span className="font-semibold text-base">Job 2</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {filteredJob2.length} Einträge
              </span>
            </div>
            {filteredJob2.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Keine Einträge im gewählten Zeitraum
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Datum</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Arbeitgeber</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Zeit</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Stunden</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Verdienst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJob2.map(e => {
                      const h = calcHoursGeneric('job2', e);
                      const earnings = h * (e.fields.job2_stundenlohn ?? 0);
                      return (
                        <tr key={e.record_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {e.fields.job2_datum ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 truncate max-w-[140px]">
                            {e.fields.job2_arbeitgeber ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                            {e.fields.job2_startzeit && e.fields.job2_endzeit
                              ? `${e.fields.job2_startzeit}–${e.fields.job2_endzeit}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">
                            {formatHours(h)}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {e.fields.job2_stundenlohn ? formatEarnings(earnings) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold">
                      <td colSpan={3} className="px-4 py-2.5 text-sm">Gesamt Job 2</td>
                      <td className="px-4 py-2.5 text-right text-sm">{formatHours(job2Hours)}</td>
                      <td className="px-4 py-2.5 text-right text-sm">{formatEarnings(job2Earnings)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Gesamtsumme */}
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="font-semibold text-base flex items-center gap-2">
              <IconCurrencyEuro size={18} className="text-primary shrink-0" />
              Gesamtübersicht
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-muted/40 px-4 py-3 space-y-0.5">
                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Job 1</div>
                <div className="font-semibold">{formatHours(job1Hours)}</div>
                <div className="text-muted-foreground">{formatEarnings(job1Earnings)}</div>
              </div>
              <div className="rounded-xl bg-muted/40 px-4 py-3 space-y-0.5">
                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Job 2</div>
                <div className="font-semibold">{formatHours(job2Hours)}</div>
                <div className="text-muted-foreground">{formatEarnings(job2Earnings)}</div>
              </div>
              <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 space-y-0.5">
                <div className="text-primary text-xs font-medium uppercase tracking-wide">Gesamt</div>
                <div className="font-bold text-primary">{formatHours(totalHours)}</div>
                <div className="text-primary font-semibold">{formatEarnings(totalEarnings)}</div>
              </div>
            </div>

            {job1Hours > 0 && job2Hours > 0 && (
              <div className="pt-2">
                <BudgetTracker
                  budget={totalHours}
                  booked={job1Hours}
                  label="Job 1 Anteil"
                  showRemaining={false}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(3)} className="gap-2">
              Weiter
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Auswertung speichern */}
      {currentStep === 3 && !saved && (
        <div className="space-y-6">
          {/* Zusammenfassung */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-base">
              <IconFileText size={20} className="text-primary shrink-0" />
              Zusammenfassung
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Zeitraum</span>
                  <span className="font-medium">{vonDate} – {bisDate}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Gesamtstunden</span>
                  <span className="font-semibold text-primary">{formatHours(totalHours)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Gesamtverdienst</span>
                  <span className="font-semibold text-primary">{formatEarnings(totalEarnings)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Job 1 Stunden</span>
                  <span className="font-medium">{formatHours(job1Hours)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Job 2 Stunden</span>
                  <span className="font-medium">{formatHours(job2Hours)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Einträge gesamt</span>
                  <span className="font-medium">{filteredJob1.length + filteredJob2.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Referenzeinträge (optional) */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="font-semibold text-base">Referenzeintrag wählen</div>
            <p className="text-sm text-muted-foreground">
              Optional: Wähle je einen repräsentativen Eintrag aus Job 1 und Job 2 für die Auswertung.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="ref-job1">
                  Job 1 Referenzeintrag
                </label>
                <select
                  id="ref-job1"
                  value={selectedJob1Id}
                  onChange={e => setSelectedJob1Id(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">— Keinen auswählen —</option>
                  {filteredJob1.map(e => {
                    const h = calcHoursGeneric('job1', e);
                    return (
                      <option key={e.record_id} value={e.record_id}>
                        {e.fields.job1_datum ?? '?'} · {e.fields.job1_arbeitgeber ?? 'Job 1'} · {formatHours(h)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="ref-job2">
                  Job 2 Referenzeintrag
                </label>
                <select
                  id="ref-job2"
                  value={selectedJob2Id}
                  onChange={e => setSelectedJob2Id(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">— Keinen auswählen —</option>
                  {filteredJob2.map(e => {
                    const h = calcHoursGeneric('job2', e);
                    return (
                      <option key={e.record_id} value={e.record_id}>
                        {e.fields.job2_datum ?? '?'} · {e.fields.job2_arbeitgeber ?? 'Job 2'} · {formatHours(h)}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Zurück
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <IconFileText size={16} />
              Auswertung erstellen
            </Button>
          </div>

          <GesamtuebersichtDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createGesamtuebersichtEntry(fields);
              setDialogOpen(false);
              setSaved(true);
            }}
            defaultValues={{
              gesamt_stunden: totalHours,
              gesamt_verdienst: totalEarnings,
              auswertung_von: vonDate,
              auswertung_bis: bisDate,
              job1_eintraege: selectedJob1Id
                ? createRecordUrl(APP_IDS.JOB_1_STUNDENEINTRAG, selectedJob1Id)
                : undefined,
              job2_eintraege: selectedJob2Id
                ? createRecordUrl(APP_IDS.JOB_2_STUNDENEINTRAG, selectedJob2Id)
                : undefined,
            }}
            job_1_stundeneintragList={job1Entries}
            job_2_stundeneintragList={job2Entries}
            enablePhotoScan={false}
            enablePhotoLocation={false}
          />
        </div>
      )}

      {/* Erfolgsmeldung */}
      {currentStep === 3 && saved && (
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCheck size={32} className="text-green-600" stroke={2.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Auswertung erfolgreich gespeichert!</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Die Gesamtübersicht für den Zeitraum {vonDate} – {bisDate} wurde erfolgreich erstellt.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#/">
              <Button variant="outline">Zum Dashboard</Button>
            </a>
            <Button
              onClick={() => {
                setSaved(false);
                setCurrentStep(1);
                setSelectedJob1Id('');
                setSelectedJob2Id('');
              }}
            >
              Neue Auswertung erstellen
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
