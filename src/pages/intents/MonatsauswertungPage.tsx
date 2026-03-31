import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import {
  IconCalendar,
  IconPlus,
  IconArrowRight,
  IconArrowLeft,
  IconClock,
  IconCurrencyEuro,
  IconCircleCheck,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Zeitraum' },
  { label: 'Job 1' },
  { label: 'Job 2' },
  { label: 'Zusammenfassung' },
];

function getMonthRange(offset = 0): { von: string; bis: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    von: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`,
    bis: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  };
}

function getCurrentWeekRange(): { von: string; bis: string } {
  const now = new Date();
  const day = now.getDay();
  const diffMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { von: fmt(mon), bis: fmt(sun) };
}

function parseTimeToMinutes(t: string | undefined): number {
  if (!t) return 0;
  const parts = t.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function computeJob1Hours(entry: Job1Stundeneintrag): number {
  if (entry.fields.job1_arbeitsstunden != null) return entry.fields.job1_arbeitsstunden;
  const start = parseTimeToMinutes(entry.fields.job1_startzeit);
  const end = parseTimeToMinutes(entry.fields.job1_endzeit);
  const pause = entry.fields.job1_pause ?? 0;
  const diff = end - start - pause;
  return diff > 0 ? diff / 60 : 0;
}

function computeJob2Hours(entry: Job2Stundeneintrag): number {
  if (entry.fields.job2_arbeitsstunden != null) return entry.fields.job2_arbeitsstunden;
  const start = parseTimeToMinutes(entry.fields.job2_startzeit);
  const end = parseTimeToMinutes(entry.fields.job2_endzeit);
  const pause = entry.fields.job2_pause ?? 0;
  const diff = end - start - pause;
  return diff > 0 ? diff / 60 : 0;
}

function isInRange(dateStr: string | undefined, von: string, bis: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= von && d <= bis;
}

export default function MonatsauswertungPage() {
  const [searchParams] = useSearchParams();
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 4 ? s : 1;
  })();

  const [step, setStep] = useState(initialStep);
  const [von, setVon] = useState(() => getMonthRange(0).von);
  const [bis, setBis] = useState(() => getMonthRange(0).bis);
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [notizen, setNotizen] = useState('');
  const [manualStunden, setManualStunden] = useState('');
  const [manualVerdienst, setManualVerdienst] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { job1Stundeneintrag, job2Stundeneintrag, loading, error, fetchAll } = useDashboardData();

  const job1Filtered = useMemo(
    () => job1Stundeneintrag.filter(e => isInRange(e.fields.job1_datum, von, bis)),
    [job1Stundeneintrag, von, bis]
  );

  const job2Filtered = useMemo(
    () => job2Stundeneintrag.filter(e => isInRange(e.fields.job2_datum, von, bis)),
    [job2Stundeneintrag, von, bis]
  );

  const job1TotalHours = useMemo(
    () => job1Filtered.reduce((sum, e) => sum + computeJob1Hours(e), 0),
    [job1Filtered]
  );

  const job1TotalEarnings = useMemo(
    () => job1Filtered.reduce((sum, e) => sum + computeJob1Hours(e) * (e.fields.job1_stundenlohn ?? 0), 0),
    [job1Filtered]
  );

  const job2TotalHours = useMemo(
    () => job2Filtered.reduce((sum, e) => sum + computeJob2Hours(e), 0),
    [job2Filtered]
  );

  const job2TotalEarnings = useMemo(
    () => job2Filtered.reduce((sum, e) => sum + computeJob2Hours(e) * (e.fields.job2_stundenlohn ?? 0), 0),
    [job2Filtered]
  );

  const combinedHours = job1TotalHours + job2TotalHours;
  const combinedEarnings = job1TotalEarnings + job2TotalEarnings;

  function applyMonthRange(offset: number) {
    const r = getMonthRange(offset);
    setVon(r.von);
    setBis(r.bis);
  }

  function applyWeekRange() {
    const r = getCurrentWeekRange();
    setVon(r.von);
    setBis(r.bis);
  }

  function goToStep4() {
    setManualStunden(combinedHours.toFixed(2));
    setManualVerdienst(combinedEarnings.toFixed(2));
    setStep(4);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await LivingAppsService.createGesamtuebersichtEntry({
        auswertung_von: von,
        auswertung_bis: bis,
        gesamt_stunden: parseFloat(manualStunden) || 0,
        gesamt_verdienst: parseFloat(manualVerdienst) || 0,
        auswertung_notizen: notizen || undefined,
      });
      await fetchAll();
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  function resetWizard() {
    const r = getMonthRange(0);
    setVon(r.von);
    setBis(r.bis);
    setNotizen('');
    setManualStunden('');
    setManualVerdienst('');
    setSaveError(null);
    setSaved(false);
    setStep(1);
  }

  return (
    <IntentWizardShell
      title="Monatsauswertung"
      subtitle="Arbeitszeiten zusammenfassen und Bericht erstellen"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Zeitraum festlegen */}
      {step === 1 && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconCalendar size={18} className="text-primary" />
                Zeitraum festlegen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={applyWeekRange}>
                  Aktuelle Woche
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyMonthRange(0)}>
                  Aktueller Monat
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyMonthRange(-1)}>
                  Letzter Monat
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="von">Von</Label>
                  <Input
                    id="von"
                    type="date"
                    value={von}
                    onChange={e => setVon(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bis">Bis</Label>
                  <Input
                    id="bis"
                    type="date"
                    value={bis}
                    onChange={e => setBis(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="pt-1 text-sm text-muted-foreground">
                Ausgewählter Zeitraum: <span className="font-medium text-foreground">{formatDate(von)}</span> bis <span className="font-medium text-foreground">{formatDate(bis)}</span>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!von || !bis}>
              Weiter
              <IconArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Job 1 Einträge */}
      {step === 2 && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconClock size={18} className="text-primary" />
                Job 1 — Einträge im Zeitraum
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatDate(von)} bis {formatDate(bis)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {job1Filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Keine Einträge in diesem Zeitraum gefunden.
                </div>
              ) : (
                <div className="space-y-2">
                  {job1Filtered.map(entry => {
                    const hours = computeJob1Hours(entry);
                    const earnings = hours * (entry.fields.job1_stundenlohn ?? 0);
                    return (
                      <div
                        key={entry.record_id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-secondary/40 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {formatDate(entry.fields.job1_datum)}
                            {entry.fields.job1_arbeitgeber && (
                              <span className="ml-2 text-muted-foreground font-normal">{entry.fields.job1_arbeitgeber}</span>
                            )}
                          </div>
                          {(entry.fields.job1_startzeit || entry.fields.job1_endzeit) && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {entry.fields.job1_startzeit ?? '—'} – {entry.fields.job1_endzeit ?? '—'}
                              {entry.fields.job1_pause ? ` · Pause: ${entry.fields.job1_pause} Min.` : ''}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm shrink-0">
                          <span className="font-medium">{hours.toFixed(2)} h</span>
                          {entry.fields.job1_stundenlohn != null && (
                            <span className="text-primary font-semibold">{formatCurrency(earnings)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Live total */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
                <span className="text-muted-foreground">{job1Filtered.length} {job1Filtered.length === 1 ? 'Eintrag' : 'Einträge'}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold">{job1TotalHours.toFixed(2)} Stunden</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-primary">{formatCurrency(job1TotalEarnings)}</span>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setJob1DialogOpen(true)}>
                <IconPlus size={16} className="mr-2" />
                Neuen Eintrag hinzufügen
              </Button>
            </CardContent>
          </Card>

          <Job1StundeneintragDialog
            open={job1DialogOpen}
            onClose={() => setJob1DialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createJob1StundeneintragEntry(fields);
              await fetchAll();
              setJob1DialogOpen(false);
            }}
            enablePhotoScan={false}
            enablePhotoLocation={false}
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <IconArrowLeft size={16} className="mr-2" />
              Zurück
            </Button>
            <Button onClick={() => setStep(3)}>
              Weiter
              <IconArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Job 2 Einträge */}
      {step === 3 && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconClock size={18} className="text-primary" />
                Job 2 — Einträge im Zeitraum
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatDate(von)} bis {formatDate(bis)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {job2Filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Keine Einträge in diesem Zeitraum gefunden.
                </div>
              ) : (
                <div className="space-y-2">
                  {job2Filtered.map(entry => {
                    const hours = computeJob2Hours(entry);
                    const earnings = hours * (entry.fields.job2_stundenlohn ?? 0);
                    return (
                      <div
                        key={entry.record_id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-secondary/40 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {formatDate(entry.fields.job2_datum)}
                            {entry.fields.job2_arbeitgeber && (
                              <span className="ml-2 text-muted-foreground font-normal">{entry.fields.job2_arbeitgeber}</span>
                            )}
                          </div>
                          {(entry.fields.job2_startzeit || entry.fields.job2_endzeit) && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {entry.fields.job2_startzeit ?? '—'} – {entry.fields.job2_endzeit ?? '—'}
                              {entry.fields.job2_pause ? ` · Pause: ${entry.fields.job2_pause} Min.` : ''}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm shrink-0">
                          <span className="font-medium">{hours.toFixed(2)} h</span>
                          {entry.fields.job2_stundenlohn != null && (
                            <span className="text-primary font-semibold">{formatCurrency(earnings)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Live total */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
                <span className="text-muted-foreground">{job2Filtered.length} {job2Filtered.length === 1 ? 'Eintrag' : 'Einträge'}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold">{job2TotalHours.toFixed(2)} Stunden</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-primary">{formatCurrency(job2TotalEarnings)}</span>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setJob2DialogOpen(true)}>
                <IconPlus size={16} className="mr-2" />
                Neuen Eintrag hinzufügen
              </Button>
            </CardContent>
          </Card>

          <Job2StundeneintragDialog
            open={job2DialogOpen}
            onClose={() => setJob2DialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createJob2StundeneintragEntry(fields);
              await fetchAll();
              setJob2DialogOpen(false);
            }}
            enablePhotoScan={false}
            enablePhotoLocation={false}
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <IconArrowLeft size={16} className="mr-2" />
              Zurück
            </Button>
            <Button onClick={goToStep4}>
              Weiter
              <IconArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Zusammenfassung & Speichern */}
      {step === 4 && !saved && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Job 1</div>
                <div className="font-semibold text-lg">{job1TotalHours.toFixed(2)} h</div>
                <div className="text-sm text-primary font-medium">{formatCurrency(job1TotalEarnings)}</div>
                <div className="text-xs text-muted-foreground mt-1">{job1Filtered.length} {job1Filtered.length === 1 ? 'Eintrag' : 'Einträge'}</div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Job 2</div>
                <div className="font-semibold text-lg">{job2TotalHours.toFixed(2)} h</div>
                <div className="text-sm text-primary font-medium">{formatCurrency(job2TotalEarnings)}</div>
                <div className="text-xs text-muted-foreground mt-1">{job2Filtered.length} {job2Filtered.length === 1 ? 'Eintrag' : 'Einträge'}</div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden bg-primary/5 border-primary/20">
              <CardContent className="pt-5 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Gesamt</div>
                <div className="font-bold text-lg">{combinedHours.toFixed(2)} h</div>
                <div className="text-sm text-primary font-bold">{formatCurrency(combinedEarnings)}</div>
                <div className="text-xs text-muted-foreground mt-1">{job1Filtered.length + job2Filtered.length} Einträge</div>
              </CardContent>
            </Card>
          </div>

          {/* Editable fields */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconCurrencyEuro size={18} className="text-primary" />
                Bericht erstellen
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Zeitraum: {formatDate(von)} bis {formatDate(bis)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gesamt-stunden">Gesamtstunden (manuell anpassbar)</Label>
                  <Input
                    id="gesamt-stunden"
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualStunden}
                    onChange={e => setManualStunden(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gesamt-verdienst">Gesamtverdienst in € (manuell anpassbar)</Label>
                  <Input
                    id="gesamt-verdienst"
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualVerdienst}
                    onChange={e => setManualVerdienst(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notizen">Notizen zur Auswertung</Label>
                <Textarea
                  id="notizen"
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder="Optionale Anmerkungen zum Berichtszeitraum..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              <IconArrowLeft size={16} className="mr-2" />
              Zurück
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Wird gespeichert…' : 'Bericht erstellen'}
              {!saving && <IconCircleCheck size={16} className="ml-2" />}
            </Button>
          </div>
        </div>
      )}

      {/* Success state */}
      {step === 4 && saved && (
        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCircleCheck size={32} className="text-green-600" stroke={1.5} />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-foreground">Bericht gespeichert!</h2>
            <p className="text-sm text-muted-foreground">
              Der Auswertungsbericht für {formatDate(von)} bis {formatDate(bis)} wurde erfolgreich erstellt.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={resetWizard} variant="outline">
              <IconRefresh size={16} className="mr-2" />
              Neuen Bericht erstellen
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
