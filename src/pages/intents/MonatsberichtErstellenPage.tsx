import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  IconPlus,
  IconBriefcase,
  IconClock,
  IconCurrencyEuro,
  IconCircleCheck,
  IconArrowLeft,
  IconHome,
  IconRefresh,
} from '@tabler/icons-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function inRange(dateStr: string | undefined, von: string, bis: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= von && d <= bis;
}

function computeStunden(
  stunden?: number,
  start?: string,
  end?: string,
  pause?: number
): number {
  if (stunden != null && stunden > 0) return stunden;
  if (!start || !end) return 0;
  const parseT = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  return Math.max(0, (parseT(end) - parseT(start) - (pause ?? 0)) / 60);
}

function job1Hours(entry: Job1Stundeneintrag): number {
  return computeStunden(
    entry.fields.job1_arbeitsstunden,
    entry.fields.job1_startzeit,
    entry.fields.job1_endzeit,
    entry.fields.job1_pause
  );
}

function job1Earnings(entry: Job1Stundeneintrag): number {
  const h = job1Hours(entry);
  return h * (entry.fields.job1_stundenlohn ?? 0);
}

function job2Hours(entry: Job2Stundeneintrag): number {
  return computeStunden(
    entry.fields.job2_arbeitsstunden,
    entry.fields.job2_startzeit,
    entry.fields.job2_endzeit,
    entry.fields.job2_pause
  );
}

function job2Earnings(entry: Job2Stundeneintrag): number {
  const h = job2Hours(entry);
  return h * (entry.fields.job2_stundenlohn ?? 0);
}

// ---------------------------------------------------------------------------
// Wizard steps metadata
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Zeitraum' },
  { label: 'Job 1' },
  { label: 'Job 2' },
  { label: 'Abschluss' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  employer,
  date,
  hours,
  earnings,
  label,
}: {
  employer?: string;
  date?: string;
  hours: number;
  earnings: number;
  label: string;
}) {
  return (
    <Card className="overflow-hidden border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {label}
        </p>
        <p className="font-semibold truncate">{employer ?? '—'}</p>
        <p className="text-sm text-muted-foreground">{date ? formatDate(date) : '—'}</p>
        <div className="flex gap-4 mt-3">
          <span className="flex items-center gap-1 text-sm">
            <IconClock size={14} stroke={2} className="text-muted-foreground" />
            {hours.toFixed(2)} h
          </span>
          <span className="flex items-center gap-1 text-sm">
            <IconCurrencyEuro size={14} stroke={2} className="text-muted-foreground" />
            {formatCurrency(earnings)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function MonatsberichtErstellenPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // ---- Step state ----
  const initialStep = Math.min(
    Math.max(0, parseInt(searchParams.get('step') ?? '0', 10)),
    3
  );
  const [currentStep, setCurrentStep] = useState(initialStep);

  // ---- Date range ----
  const [vonDate, setVonDate] = useState(searchParams.get('von') ?? firstOfMonthStr());
  const [bisDate, setBisDate] = useState(searchParams.get('bis') ?? todayStr());

  // ---- Data ----
  const [job1List, setJob1List] = useState<Job1Stundeneintrag[]>([]);
  const [job2List, setJob2List] = useState<Job2Stundeneintrag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ---- Selections ----
  const [selectedJob1Id, setSelectedJob1Id] = useState<string | null>(null);
  const [selectedJob2Id, setSelectedJob2Id] = useState<string | null>(null);

  // ---- Dialogs ----
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);

  // ---- Final step fields ----
  const [gesamtStunden, setGesamtStunden] = useState('');
  const [gesamtVerdienst, setGesamtVerdienst] = useState('');
  const [notizen, setNotizen] = useState('');

  // ---- Success state ----
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---- Fetch data ----
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [j1, j2] = await Promise.all([
        LivingAppsService.getJob1Stundeneintrag(),
        LivingAppsService.getJob2Stundeneintrag(),
      ]);
      setJob1List(j1);
      setJob2List(j2);
    } catch {
      setError(new Error('Fehler beim Laden der Daten. Bitte versuche es erneut.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ---- Sync URL params when step/dates change ----
  useEffect(() => {
    const params: Record<string, string> = {
      step: String(currentStep),
      von: vonDate,
      bis: bisDate,
    };
    setSearchParams(params, { replace: true });
  }, [currentStep, vonDate, bisDate, setSearchParams]);

  // ---- Derived filtered lists ----
  const filteredJob1 = useMemo(
    () => job1List.filter((e) => inRange(e.fields.job1_datum, vonDate, bisDate)),
    [job1List, vonDate, bisDate]
  );

  const filteredJob2 = useMemo(
    () => job2List.filter((e) => inRange(e.fields.job2_datum, vonDate, bisDate)),
    [job2List, vonDate, bisDate]
  );

  // ---- Selected records ----
  const selectedJob1 = useMemo(
    () => job1List.find((e) => e.record_id === selectedJob1Id) ?? null,
    [job1List, selectedJob1Id]
  );

  const selectedJob2 = useMemo(
    () => job2List.find((e) => e.record_id === selectedJob2Id) ?? null,
    [job2List, selectedJob2Id]
  );

  // ---- Auto-fill totals when step 4 is reached ----
  useEffect(() => {
    if (currentStep === 3 && selectedJob1 && selectedJob2) {
      const h1 = job1Hours(selectedJob1);
      const h2 = job2Hours(selectedJob2);
      const e1 = job1Earnings(selectedJob1);
      const e2 = job2Earnings(selectedJob2);
      setGesamtStunden(String(parseFloat((h1 + h2).toFixed(2))));
      setGesamtVerdienst(String(parseFloat((e1 + e2).toFixed(2))));
    }
  }, [currentStep, selectedJob1, selectedJob2]);

  // ---- Navigation ----
  function goToStep(s: number) {
    setCurrentStep(s);
  }

  // ---- Save ----
  async function handleSave() {
    if (!selectedJob1Id || !selectedJob2Id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await LivingAppsService.createGesamtuebersichtEntry({
        auswertung_von: vonDate,
        auswertung_bis: bisDate,
        gesamt_stunden: parseFloat(gesamtStunden) || 0,
        gesamt_verdienst: parseFloat(gesamtVerdienst) || 0,
        auswertung_notizen: notizen || undefined,
        job1_eintraege: createRecordUrl(APP_IDS.JOB_1_STUNDENEINTRAG, selectedJob1Id),
        job2_eintraege: createRecordUrl(APP_IDS.JOB_2_STUNDENEINTRAG, selectedJob2Id),
      });
      setSaved(true);
    } catch {
      setSaveError('Fehler beim Speichern. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setVonDate(firstOfMonthStr());
    setBisDate(todayStr());
    setSelectedJob1Id(null);
    setSelectedJob2Id(null);
    setGesamtStunden('');
    setGesamtVerdienst('');
    setNotizen('');
    setSaved(false);
    setSaveError(null);
    setCurrentStep(0);
  }

  // ---- Success screen ----
  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <IconCircleCheck size={48} stroke={1.5} className="text-green-600" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Bericht gespeichert!</h2>
            <p className="text-muted-foreground">
              Der Gesamtübersicht-Bericht für den Zeitraum{' '}
              <span className="font-medium">{formatDate(vonDate)}</span> –{' '}
              <span className="font-medium">{formatDate(bisDate)}</span> wurde erfolgreich
              erstellt.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
              <IconRefresh size={16} stroke={2} className="mr-2" />
              Neuen Bericht erstellen
            </Button>
            <Button onClick={() => navigate('/')} className="w-full sm:w-auto">
              <IconHome size={16} stroke={2} className="mr-2" />
              Zum Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render steps ----
  return (
    <>
      <IntentWizardShell
        title="Monatsbericht erstellen"
        subtitle="Einträge auswählen & Gesamtübersicht speichern"
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={goToStep}
        loading={loading}
        error={error}
      >
        {/* ================================================================
            Step 0 — Auswertungszeitraum
        ================================================================ */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Auswertungszeitraum festlegen</h2>
              <p className="text-muted-foreground text-sm">
                Wähle den Zeitraum aus, für den du den Bericht erstellen möchtest.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="von-date">Von</Label>
                <Input
                  id="von-date"
                  type="date"
                  value={vonDate}
                  onChange={(e) => setVonDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bis-date">Bis</Label>
                <Input
                  id="bis-date"
                  type="date"
                  value={bisDate}
                  onChange={(e) => setBisDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {vonDate && bisDate && vonDate <= bisDate && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="overflow-hidden">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{filteredJob1.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Job 1 {filteredJob1.length === 1 ? 'Eintrag' : 'Einträge'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{filteredJob2.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Job 2 {filteredJob2.length === 1 ? 'Eintrag' : 'Einträge'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {vonDate && bisDate && vonDate > bisDate && (
              <p className="text-sm text-destructive">
                Das "Von"-Datum darf nicht nach dem "Bis"-Datum liegen.
              </p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => goToStep(1)}
                disabled={!vonDate || !bisDate || vonDate > bisDate}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================
            Step 1 — Job 1 Eintrag auswählen
        ================================================================ */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Job 1 Eintrag für den Bericht auswählen</h2>
              <p className="text-muted-foreground text-sm">
                Einträge im Zeitraum {formatDate(vonDate)} – {formatDate(bisDate)}
              </p>
            </div>

            {selectedJob1 && (
              <SummaryCard
                label="Ausgewählt"
                employer={selectedJob1.fields.job1_arbeitgeber}
                date={selectedJob1.fields.job1_datum}
                hours={job1Hours(selectedJob1)}
                earnings={job1Earnings(selectedJob1)}
              />
            )}

            <EntitySelectStep
              items={filteredJob1.map((e) => ({
                id: e.record_id,
                title: e.fields.job1_datum ? formatDate(e.fields.job1_datum) : '(kein Datum)',
                subtitle: e.fields.job1_arbeitgeber,
                stats: [
                  { label: 'Stunden', value: `${job1Hours(e).toFixed(2)} h` },
                  { label: 'Verdienst', value: formatCurrency(job1Earnings(e)) },
                ],
              }))}
              onSelect={(id: string) => setSelectedJob1Id(id)}
              searchPlaceholder="Job 1 Eintrag suchen…"
              emptyText="Keine Job 1 Einträge im gewählten Zeitraum gefunden."
            />

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setJob1DialogOpen(true)}
            >
              <IconPlus size={16} stroke={2} className="mr-2" />
              Neuer Job 1 Eintrag
            </Button>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => goToStep(0)}>
                <IconArrowLeft size={16} stroke={2} className="mr-2" />
                Zurück
              </Button>
              <Button
                onClick={() => goToStep(2)}
                disabled={!selectedJob1Id}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================
            Step 2 — Job 2 Eintrag auswählen
        ================================================================ */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Job 2 Eintrag für den Bericht auswählen</h2>
              <p className="text-muted-foreground text-sm">
                Einträge im Zeitraum {formatDate(vonDate)} – {formatDate(bisDate)}
              </p>
            </div>

            {selectedJob2 && (
              <SummaryCard
                label="Ausgewählt"
                employer={selectedJob2.fields.job2_arbeitgeber}
                date={selectedJob2.fields.job2_datum}
                hours={job2Hours(selectedJob2)}
                earnings={job2Earnings(selectedJob2)}
              />
            )}

            <EntitySelectStep
              items={filteredJob2.map((e) => ({
                id: e.record_id,
                title: e.fields.job2_datum ? formatDate(e.fields.job2_datum) : '(kein Datum)',
                subtitle: e.fields.job2_arbeitgeber,
                stats: [
                  { label: 'Stunden', value: `${job2Hours(e).toFixed(2)} h` },
                  { label: 'Verdienst', value: formatCurrency(job2Earnings(e)) },
                ],
              }))}
              onSelect={(id: string) => setSelectedJob2Id(id)}
              searchPlaceholder="Job 2 Eintrag suchen…"
              emptyText="Keine Job 2 Einträge im gewählten Zeitraum gefunden."
            />

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setJob2DialogOpen(true)}
            >
              <IconPlus size={16} stroke={2} className="mr-2" />
              Neuer Job 2 Eintrag
            </Button>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => goToStep(1)}>
                <IconArrowLeft size={16} stroke={2} className="mr-2" />
                Zurück
              </Button>
              <Button
                onClick={() => goToStep(3)}
                disabled={!selectedJob2Id}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================
            Step 3 — Bericht finalisieren & speichern
        ================================================================ */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Bericht finalisieren & speichern</h2>
              <p className="text-muted-foreground text-sm">
                Überprüfe die Angaben und passe die Gesamtwerte bei Bedarf an.
              </p>
            </div>

            {/* Selected entries summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedJob1 && (
                <SummaryCard
                  label="Job 1"
                  employer={selectedJob1.fields.job1_arbeitgeber}
                  date={selectedJob1.fields.job1_datum}
                  hours={job1Hours(selectedJob1)}
                  earnings={job1Earnings(selectedJob1)}
                />
              )}
              {selectedJob2 && (
                <SummaryCard
                  label="Job 2"
                  employer={selectedJob2.fields.job2_arbeitgeber}
                  date={selectedJob2.fields.job2_datum}
                  hours={job2Hours(selectedJob2)}
                  earnings={job2Earnings(selectedJob2)}
                />
              )}
            </div>

            {/* Computed totals (editable) */}
            <Card className="overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <IconBriefcase size={16} stroke={2} className="text-muted-foreground" />
                  <span className="font-semibold text-sm">Gesamtwerte</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gesamt-stunden">Gesamt Stunden</Label>
                    <Input
                      id="gesamt-stunden"
                      type="number"
                      step="0.01"
                      min="0"
                      value={gesamtStunden}
                      onChange={(e) => setGesamtStunden(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gesamt-verdienst">Gesamt Verdienst (€)</Label>
                    <Input
                      id="gesamt-verdienst"
                      type="number"
                      step="0.01"
                      min="0"
                      value={gesamtVerdienst}
                      onChange={(e) => setGesamtVerdienst(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notizen">Notizen (optional)</Label>
              <Textarea
                id="notizen"
                placeholder="Weitere Anmerkungen zum Bericht…"
                value={notizen}
                onChange={(e) => setNotizen(e.target.value)}
                rows={3}
                className="w-full resize-none"
              />
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => goToStep(2)}>
                <IconArrowLeft size={16} stroke={2} className="mr-2" />
                Zurück
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !selectedJob1Id || !selectedJob2Id}
              >
                {saving ? 'Speichern…' : 'Bericht speichern'}
              </Button>
            </div>
          </div>
        )}
      </IntentWizardShell>

      {/* ---- Dialogs ---- */}
      <Job1StundeneintragDialog
        open={job1DialogOpen}
        onClose={() => setJob1DialogOpen(false)}
        onSubmit={async (fields: Record<string, unknown>) => {
          const result = await LivingAppsService.createJob1StundeneintragEntry(fields as any);
          await fetchAll();
          // Auto-select the newly created record
          if (result && typeof result === 'object') {
            const entries = Object.entries(result as Record<string, { record_id?: string }>);
            if (entries.length > 0) {
              const newId = entries[0][1]?.record_id ?? entries[0][0];
              setSelectedJob1Id(newId);
            }
          }
          setJob1DialogOpen(false);
        }}
        defaultValues={{ job1_datum: vonDate }}
        enablePhotoScan={AI_PHOTO_SCAN['Job1Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job1Stundeneintrag']}
      />

      <Job2StundeneintragDialog
        open={job2DialogOpen}
        onClose={() => setJob2DialogOpen(false)}
        onSubmit={async (fields: Record<string, unknown>) => {
          const result = await LivingAppsService.createJob2StundeneintragEntry(fields as any);
          await fetchAll();
          // Auto-select the newly created record
          if (result && typeof result === 'object') {
            const entries = Object.entries(result as Record<string, { record_id?: string }>);
            if (entries.length > 0) {
              const newId = entries[0][1]?.record_id ?? entries[0][0];
              setSelectedJob2Id(newId);
            }
          }
          setJob2DialogOpen(false);
        }}
        defaultValues={{ job2_datum: vonDate }}
        enablePhotoScan={AI_PHOTO_SCAN['Job2Stundeneintrag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Job2Stundeneintrag']}
      />
    </>
  );
}
