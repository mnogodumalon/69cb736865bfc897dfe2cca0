import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { GesamtuebersichtDialog } from '@/components/dialogs/GesamtuebersichtDialog';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  IconCalendar,
  IconBriefcase,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconPlus,
  IconClock,
  IconCurrencyEuro,
} from '@tabler/icons-react';

const today = new Date();
const defaultVon = format(startOfMonth(today), 'yyyy-MM-dd');
const defaultBis = format(endOfMonth(today), 'yyyy-MM-dd');

const STEPS = [
  { label: 'Zeitraum' },
  { label: 'Job 1' },
  { label: 'Job 2' },
  { label: 'Abrechnung' },
];

export default function PeriodenabrechnungPage() {
  const [searchParams] = useSearchParams();
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    if (s >= 1 && s <= 4) return s;
    return 1;
  })();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [vonDate, setVonDate] = useState(defaultVon);
  const [bisDate, setBisDate] = useState(defaultBis);

  const [selectedJob1, setSelectedJob1] = useState<Job1Stundeneintrag | null>(null);
  const [selectedJob2, setSelectedJob2] = useState<Job2Stundeneintrag | null>(null);

  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [gesamtDialogOpen, setGesamtDialogOpen] = useState(false);

  const { job1Stundeneintrag, job2Stundeneintrag, loading, error, fetchAll } = useDashboardData();

  // Period-filtered entries
  const periodEntries1 = useMemo(() =>
    job1Stundeneintrag.filter(e => {
      if (!e.fields.job1_datum) return false;
      const d = e.fields.job1_datum.substring(0, 10);
      return d >= vonDate && d <= bisDate;
    }),
    [job1Stundeneintrag, vonDate, bisDate]
  );

  const periodEntries2 = useMemo(() =>
    job2Stundeneintrag.filter(e => {
      if (!e.fields.job2_datum) return false;
      const d = e.fields.job2_datum.substring(0, 10);
      return d >= vonDate && d <= bisDate;
    }),
    [job2Stundeneintrag, vonDate, bisDate]
  );

  // Totals
  const totalHours1 = useMemo(() =>
    periodEntries1.reduce((sum, e) => sum + (e.fields.job1_arbeitsstunden ?? 0), 0),
    [periodEntries1]
  );
  const totalHours2 = useMemo(() =>
    periodEntries2.reduce((sum, e) => sum + (e.fields.job2_arbeitsstunden ?? 0), 0),
    [periodEntries2]
  );
  const totalEarnings1 = useMemo(() =>
    periodEntries1.reduce((sum, e) => sum + (e.fields.job1_arbeitsstunden ?? 0) * (e.fields.job1_stundenlohn ?? 0), 0),
    [periodEntries1]
  );
  const totalEarnings2 = useMemo(() =>
    periodEntries2.reduce((sum, e) => sum + (e.fields.job2_arbeitsstunden ?? 0) * (e.fields.job2_stundenlohn ?? 0), 0),
    [periodEntries2]
  );
  const totalHours = totalHours1 + totalHours2;
  const totalEarnings = totalEarnings1 + totalEarnings2;

  // Items for EntitySelectStep
  const job1Items = useMemo(() =>
    periodEntries1.map(e => ({
      id: e.record_id,
      title: [e.fields.job1_datum ? formatDate(e.fields.job1_datum) : null, e.fields.job1_arbeitgeber].filter(Boolean).join(' – ') || e.record_id,
      subtitle: e.fields.job1_startzeit && e.fields.job1_endzeit
        ? `${e.fields.job1_startzeit} – ${e.fields.job1_endzeit} Uhr`
        : undefined,
      stats: [
        { label: 'Stunden', value: `${e.fields.job1_arbeitsstunden ?? 0} h` },
        { label: 'Verdienst', value: formatCurrency((e.fields.job1_arbeitsstunden ?? 0) * (e.fields.job1_stundenlohn ?? 0)) },
      ],
    })),
    [periodEntries1]
  );

  const job2Items = useMemo(() =>
    periodEntries2.map(e => ({
      id: e.record_id,
      title: [e.fields.job2_datum ? formatDate(e.fields.job2_datum) : null, e.fields.job2_arbeitgeber].filter(Boolean).join(' – ') || e.record_id,
      subtitle: e.fields.job2_startzeit && e.fields.job2_endzeit
        ? `${e.fields.job2_startzeit} – ${e.fields.job2_endzeit} Uhr`
        : undefined,
      stats: [
        { label: 'Stunden', value: `${e.fields.job2_arbeitsstunden ?? 0} h` },
        { label: 'Verdienst', value: formatCurrency((e.fields.job2_arbeitsstunden ?? 0) * (e.fields.job2_stundenlohn ?? 0)) },
      ],
    })),
    [periodEntries2]
  );

  const handleSelectJob1 = (id: string) => {
    const found = job1Stundeneintrag.find(e => e.record_id === id) ?? null;
    setSelectedJob1(found);
  };

  const handleSelectJob2 = (id: string) => {
    const found = job2Stundeneintrag.find(e => e.record_id === id) ?? null;
    setSelectedJob2(found);
  };

  const gesamtDefaultValues = useMemo(() => ({
    auswertung_von: vonDate,
    auswertung_bis: bisDate,
    gesamt_stunden: totalHours,
    gesamt_verdienst: totalEarnings,
    ...(selectedJob1 ? { job1_eintraege: createRecordUrl(APP_IDS.JOB_1_STUNDENEINTRAG, selectedJob1.record_id) } : {}),
    ...(selectedJob2 ? { job2_eintraege: createRecordUrl(APP_IDS.JOB_2_STUNDENEINTRAG, selectedJob2.record_id) } : {}),
  }), [vonDate, bisDate, totalHours, totalEarnings, selectedJob1, selectedJob2]);

  return (
    <IntentWizardShell
      title="Periodenabrechnung"
      subtitle="Erstelle eine Gesamtübersicht für einen Abrechnungszeitraum"
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Zeitraum wählen */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <IconCalendar size={16} className="text-primary" />
              </div>
              <h2 className="font-semibold text-base">Abrechnungszeitraum festlegen</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="von-date">Von</Label>
                <Input
                  id="von-date"
                  type="date"
                  value={vonDate}
                  onChange={e => setVonDate(e.target.value)}
                  max={bisDate}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bis-date">Bis</Label>
                <Input
                  id="bis-date"
                  type="date"
                  value={bisDate}
                  onChange={e => setBisDate(e.target.value)}
                  min={vonDate}
                />
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-xl bg-muted/50 border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vorschau für diesen Zeitraum</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{periodEntries1.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Job 1 Einträge</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{periodEntries2.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Job 2 Einträge</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{totalHours.toFixed(1)} h</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Gesamtstunden</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalEarnings)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Gesamtverdienst</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <IconClock size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Job 1:</span>
                  <span className="font-medium">{totalHours1.toFixed(1)} h</span>
                  <span className="text-muted-foreground text-xs">({formatCurrency(totalEarnings1)})</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <IconClock size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Job 2:</span>
                  <span className="font-medium">{totalHours2.toFixed(1)} h</span>
                  <span className="text-muted-foreground text-xs">({formatCurrency(totalEarnings2)})</span>
                </div>
              </div>
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
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                <IconBriefcase size={16} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-base">Job 1 – Repräsentativen Eintrag auswählen</h2>
                <p className="text-xs text-muted-foreground">
                  {formatDate(vonDate)} – {formatDate(bisDate)} &middot; {periodEntries1.length} Einträge &middot; {totalHours1.toFixed(1)} h gesamt
                </p>
              </div>
            </div>

            {selectedJob1 && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <IconCheck size={13} stroke={2.5} className="text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {selectedJob1.fields.job1_datum ? formatDate(selectedJob1.fields.job1_datum) : '—'}
                    {selectedJob1.fields.job1_arbeitgeber ? ` – ${selectedJob1.fields.job1_arbeitgeber}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedJob1.fields.job1_arbeitsstunden ?? 0} h &middot; {formatCurrency((selectedJob1.fields.job1_arbeitsstunden ?? 0) * (selectedJob1.fields.job1_stundenlohn ?? 0))}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob1(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Ändern
                </button>
              </div>
            )}

            <EntitySelectStep
              items={job1Items}
              onSelect={handleSelectJob1}
              searchPlaceholder="Job 1 Eintrag suchen..."
              emptyText="Keine Job 1 Einträge in diesem Zeitraum gefunden."
              emptyIcon={<IconBriefcase size={32} />}
              createLabel="Neuen Eintrag erstellen"
              onCreateNew={() => setJob1DialogOpen(true)}
              createDialog={
                <Job1StundeneintragDialog
                  open={job1DialogOpen}
                  onClose={() => setJob1DialogOpen(false)}
                  onSubmit={async (fields) => {
                    await LivingAppsService.createJob1StundeneintragEntry(fields);
                    await fetchAll();
                    setJob1DialogOpen(false);
                  }}
                  defaultValues={{ job1_datum: vonDate }}
                  enablePhotoScan={AI_PHOTO_SCAN['Job1Stundeneintrag']}
                  enablePhotoLocation={AI_PHOTO_LOCATION['Job1Stundeneintrag']}
                />
              }
            />

            <div className="rounded-xl bg-muted/40 border p-3 flex items-center gap-2">
              <IconClock size={14} className="text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Alle Job 1 Einträge in diesem Zeitraum:
                <span className="font-semibold text-foreground ml-1">{totalHours1.toFixed(1)} Stunden</span>
                <span className="ml-1 text-xs">({formatCurrency(totalEarnings1)})</span>
              </p>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
              <IconChevronLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(3)}
              disabled={!selectedJob1}
              className="gap-2"
            >
              Weiter
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Job 2 Eintrag auswählen */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                <IconBriefcase size={16} className="text-purple-600" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-base">Job 2 – Repräsentativen Eintrag auswählen</h2>
                <p className="text-xs text-muted-foreground">
                  {formatDate(vonDate)} – {formatDate(bisDate)} &middot; {periodEntries2.length} Einträge &middot; {totalHours2.toFixed(1)} h gesamt
                </p>
              </div>
            </div>

            {selectedJob2 && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <IconCheck size={13} stroke={2.5} className="text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {selectedJob2.fields.job2_datum ? formatDate(selectedJob2.fields.job2_datum) : '—'}
                    {selectedJob2.fields.job2_arbeitgeber ? ` – ${selectedJob2.fields.job2_arbeitgeber}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedJob2.fields.job2_arbeitsstunden ?? 0} h &middot; {formatCurrency((selectedJob2.fields.job2_arbeitsstunden ?? 0) * (selectedJob2.fields.job2_stundenlohn ?? 0))}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob2(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Ändern
                </button>
              </div>
            )}

            <EntitySelectStep
              items={job2Items}
              onSelect={handleSelectJob2}
              searchPlaceholder="Job 2 Eintrag suchen..."
              emptyText="Keine Job 2 Einträge in diesem Zeitraum gefunden."
              emptyIcon={<IconBriefcase size={32} />}
              createLabel="Neuen Eintrag erstellen"
              onCreateNew={() => setJob2DialogOpen(true)}
              createDialog={
                <Job2StundeneintragDialog
                  open={job2DialogOpen}
                  onClose={() => setJob2DialogOpen(false)}
                  onSubmit={async (fields) => {
                    await LivingAppsService.createJob2StundeneintragEntry(fields);
                    await fetchAll();
                    setJob2DialogOpen(false);
                  }}
                  defaultValues={{ job2_datum: vonDate }}
                  enablePhotoScan={AI_PHOTO_SCAN['Job2Stundeneintrag']}
                  enablePhotoLocation={AI_PHOTO_LOCATION['Job2Stundeneintrag']}
                />
              }
            />

            <div className="rounded-xl bg-muted/40 border p-3 flex items-center gap-2">
              <IconClock size={14} className="text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Alle Job 2 Einträge in diesem Zeitraum:
                <span className="font-semibold text-foreground ml-1">{totalHours2.toFixed(1)} Stunden</span>
                <span className="ml-1 text-xs">({formatCurrency(totalEarnings2)})</span>
              </p>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
              <IconChevronLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(4)}
              disabled={!selectedJob2}
              className="gap-2"
            >
              Weiter
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Abrechnung erstellen */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                <IconCurrencyEuro size={16} className="text-green-600" />
              </div>
              <h2 className="font-semibold text-base">Zusammenfassung</h2>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 text-sm">
              <IconCalendar size={14} className="text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Zeitraum:</span>
              <span className="font-medium">{formatDate(vonDate)} – {formatDate(bisDate)}</span>
            </div>

            {/* Job 1 card */}
            {selectedJob1 && (
              <div className="rounded-xl border bg-blue-50/50 p-4 space-y-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <IconBriefcase size={14} className="text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Job 1</span>
                </div>
                <p className="font-medium text-sm">
                  {selectedJob1.fields.job1_arbeitgeber ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedJob1.fields.job1_datum ? formatDate(selectedJob1.fields.job1_datum) : '—'}
                </p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-muted-foreground">Stunden: <span className="font-semibold text-foreground">{selectedJob1.fields.job1_arbeitsstunden ?? 0} h</span></span>
                  <span className="text-muted-foreground">Verdienst: <span className="font-semibold text-foreground">{formatCurrency((selectedJob1.fields.job1_arbeitsstunden ?? 0) * (selectedJob1.fields.job1_stundenlohn ?? 0))}</span></span>
                </div>
              </div>
            )}

            {/* Job 2 card */}
            {selectedJob2 && (
              <div className="rounded-xl border bg-purple-50/50 p-4 space-y-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <IconBriefcase size={14} className="text-purple-600 shrink-0" />
                  <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Job 2</span>
                </div>
                <p className="font-medium text-sm">
                  {selectedJob2.fields.job2_arbeitgeber ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedJob2.fields.job2_datum ? formatDate(selectedJob2.fields.job2_datum) : '—'}
                </p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-muted-foreground">Stunden: <span className="font-semibold text-foreground">{selectedJob2.fields.job2_arbeitsstunden ?? 0} h</span></span>
                  <span className="text-muted-foreground">Verdienst: <span className="font-semibold text-foreground">{formatCurrency((selectedJob2.fields.job2_arbeitsstunden ?? 0) * (selectedJob2.fields.job2_stundenlohn ?? 0))}</span></span>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="rounded-xl bg-muted/40 border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Gesamte Periode (alle Einträge)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Job 1 Stunden</p>
                  <p className="font-bold text-lg">{totalHours1.toFixed(1)} h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Job 2 Stunden</p>
                  <p className="font-bold text-lg">{totalHours2.toFixed(1)} h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gesamtstunden</p>
                  <p className="font-bold text-lg text-primary">{totalHours.toFixed(1)} h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gesamtverdienst</p>
                  <p className="font-bold text-lg text-primary">{formatCurrency(totalEarnings)}</p>
                </div>
              </div>
            </div>

            {/* Hours distribution */}
            {totalHours > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stundenverteilung</p>
                <BudgetTracker
                  budget={totalHours}
                  booked={totalHours1}
                  label="Job 1 Anteil"
                  showRemaining={false}
                />
              </div>
            )}
          </div>

          {/* Create button */}
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Alle Angaben korrekt? Erstelle jetzt die Gesamtübersicht mit den berechneten Werten.
            </p>
            <Button
              onClick={() => setGesamtDialogOpen(true)}
              className="w-full gap-2"
              size="lg"
            >
              <IconPlus size={18} />
              Gesamtübersicht erstellen
            </Button>
          </div>

          <GesamtuebersichtDialog
            open={gesamtDialogOpen}
            onClose={() => setGesamtDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createGesamtuebersichtEntry(fields);
              await fetchAll();
              setGesamtDialogOpen(false);
            }}
            defaultValues={gesamtDefaultValues}
            job_1_stundeneintragList={job1Stundeneintrag}
            job_2_stundeneintragList={job2Stundeneintrag}
            enablePhotoScan={AI_PHOTO_SCAN['Gesamtuebersicht']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Gesamtuebersicht']}
          />

          <div className="flex justify-start">
            <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-2">
              <IconChevronLeft size={16} />
              Zurück
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
