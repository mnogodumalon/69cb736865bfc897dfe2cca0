import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import {
  IconPlus,
  IconTrash,
  IconCalendar,
  IconCheck,
  IconBriefcase,
  IconClock,
  IconCurrencyEuro,
} from '@tabler/icons-react';

// ─── helpers ────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function parseTimeToMinutes(t: string | undefined): number {
  if (!t) return 0;
  const parts = t.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function computeJob1Hours(fields: Job1Stundeneintrag['fields']): number {
  if (fields.job1_arbeitsstunden != null) return fields.job1_arbeitsstunden;
  if (fields.job1_startzeit && fields.job1_endzeit) {
    const start = parseTimeToMinutes(fields.job1_startzeit);
    const end = parseTimeToMinutes(fields.job1_endzeit);
    const pause = fields.job1_pause ?? 0;
    const total = end - start - pause;
    return total > 0 ? Math.round((total / 60) * 100) / 100 : 0;
  }
  return 0;
}

function computeJob2Hours(fields: Job2Stundeneintrag['fields']): number {
  if (fields.job2_arbeitsstunden != null) return fields.job2_arbeitsstunden;
  if (fields.job2_startzeit && fields.job2_endzeit) {
    const start = parseTimeToMinutes(fields.job2_startzeit);
    const end = parseTimeToMinutes(fields.job2_endzeit);
    const pause = fields.job2_pause ?? 0;
    const total = end - start - pause;
    return total > 0 ? Math.round((total / 60) * 100) / 100 : 0;
  }
  return 0;
}

function computeJob1Earnings(fields: Job1Stundeneintrag['fields'], hours: number): number {
  if (fields.job1_stundenlohn != null) return Math.round(hours * fields.job1_stundenlohn * 100) / 100;
  return 0;
}

function computeJob2Earnings(fields: Job2Stundeneintrag['fields'], hours: number): number {
  if (fields.job2_stundenlohn != null) return Math.round(hours * fields.job2_stundenlohn * 100) / 100;
  return 0;
}

// ─── types ───────────────────────────────────────────────────────────────────

interface Job1Entry {
  id: string;
  fields: Job1Stundeneintrag['fields'];
  hours: number;
  earnings: number;
}

interface Job2Entry {
  id: string;
  fields: Job2Stundeneintrag['fields'];
  hours: number;
  earnings: number;
}

// ─── wizard steps ────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Zeitraum & Jobs' },
  { label: 'Einträge erfassen' },
  { label: 'Abschluss & Bericht' },
];

// ─── component ───────────────────────────────────────────────────────────────

export default function SchnellerfassungPage() {
  const [searchParams] = useSearchParams();
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    if (s >= 1 && s <= 3) return s;
    return 1;
  })();

  const [currentStep, setCurrentStep] = useState(initialStep);

  // Step 1 state
  const [vonDate, setVonDate] = useState(todayStr());
  const [bisDate, setBisDate] = useState(todayStr());
  const [useJob1, setUseJob1] = useState(true);
  const [useJob2, setUseJob2] = useState(true);

  // Step 2 state
  const [job1Entries, setJob1Entries] = useState<Job1Entry[]>([]);
  const [job2Entries, setJob2Entries] = useState<Job2Entry[]>([]);
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 3 state
  const [createBericht, setCreateBericht] = useState(true);
  const [berichtNotizen, setBerichtNotizen] = useState('');
  const [berichtStunden, setBerichtStunden] = useState('');
  const [berichtVerdienst, setBerichtVerdienst] = useState('');
  const [finishSaving, setFinishSaving] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Derived totals
  const job1TotalHours = job1Entries.reduce((s, e) => s + e.hours, 0);
  const job1TotalEarnings = job1Entries.reduce((s, e) => s + e.earnings, 0);
  const job2TotalHours = job2Entries.reduce((s, e) => s + e.hours, 0);
  const job2TotalEarnings = job2Entries.reduce((s, e) => s + e.earnings, 0);
  const grandHours = job1TotalHours + job2TotalHours;
  const grandEarnings = job1TotalEarnings + job2TotalEarnings;

  // ── handlers ──

  function handleQuickSelect(preset: 'heute' | 'woche' | 'monat') {
    const t = todayStr();
    if (preset === 'heute') { setVonDate(t); setBisDate(t); }
    else if (preset === 'woche') { setVonDate(weekStart()); setBisDate(t); }
    else { setVonDate(monthStart()); setBisDate(t); }
  }

  function goToStep2() {
    if (!vonDate || !bisDate) return;
    if (!useJob1 && !useJob2) return;
    setCurrentStep(2);
  }

  const handleJob1Submit = useCallback(async (fields: Job1Stundeneintrag['fields']) => {
    setSaving(true);
    setSaveError(null);
    try {
      await LivingAppsService.createJob1StundeneintragEntry(fields);
      const hours = computeJob1Hours(fields);
      const earnings = computeJob1Earnings(fields, hours);
      const entry: Job1Entry = {
        id: `j1-${Date.now()}-${Math.random()}`,
        fields,
        hours,
        earnings,
      };
      setJob1Entries(prev => [...prev, entry]);
      setJob1DialogOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleJob2Submit = useCallback(async (fields: Job2Stundeneintrag['fields']) => {
    setSaving(true);
    setSaveError(null);
    try {
      await LivingAppsService.createJob2StundeneintragEntry(fields);
      const hours = computeJob2Hours(fields);
      const earnings = computeJob2Earnings(fields, hours);
      const entry: Job2Entry = {
        id: `j2-${Date.now()}-${Math.random()}`,
        fields,
        hours,
        earnings,
      };
      setJob2Entries(prev => [...prev, entry]);
      setJob2DialogOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }, []);

  function removeJob1Entry(id: string) {
    setJob1Entries(prev => prev.filter(e => e.id !== id));
  }

  function removeJob2Entry(id: string) {
    setJob2Entries(prev => prev.filter(e => e.id !== id));
  }

  function goToStep3() {
    const h = String(Math.round(grandHours * 100) / 100);
    const v = String(Math.round(grandEarnings * 100) / 100);
    setBerichtStunden(h);
    setBerichtVerdienst(v);
    setCurrentStep(3);
  }

  async function handleFinish() {
    setFinishSaving(true);
    setFinishError(null);
    try {
      if (createBericht) {
        await LivingAppsService.createGesamtuebersichtEntry({
          auswertung_von: vonDate,
          auswertung_bis: bisDate,
          gesamt_stunden: parseFloat(berichtStunden) || 0,
          gesamt_verdienst: parseFloat(berichtVerdienst) || 0,
          auswertung_notizen: berichtNotizen || undefined,
        });
      }
      setSuccess(true);
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : 'Fehler beim Abschließen');
    } finally {
      setFinishSaving(false);
    }
  }

  function resetWizard() {
    setCurrentStep(1);
    setVonDate(todayStr());
    setBisDate(todayStr());
    setUseJob1(true);
    setUseJob2(true);
    setJob1Entries([]);
    setJob2Entries([]);
    setSaveError(null);
    setCreateBericht(true);
    setBerichtNotizen('');
    setBerichtStunden('');
    setBerichtVerdienst('');
    setFinishError(null);
    setSuccess(false);
  }

  // ── render ──

  return (
    <IntentWizardShell
      title="Schnellerfassung"
      subtitle="Arbeitszeiten für beide Jobs schnell erfassen und auswerten"
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
    >
      {/* ── STEP 1 ── */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <IconCalendar size={18} className="text-primary" />
                Zeitraum wählen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick select */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleQuickSelect('heute')}>
                  Heute
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickSelect('woche')}>
                  Diese Woche
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickSelect('monat')}>
                  Dieser Monat
                </Button>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="von-date">Von</Label>
                  <Input
                    id="von-date"
                    type="date"
                    value={vonDate}
                    onChange={e => setVonDate(e.target.value)}
                    max={bisDate}
                  />
                </div>
                <div className="space-y-1">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <IconBriefcase size={18} className="text-primary" />
                Jobs auswählen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  id="job1-check"
                  checked={useJob1}
                  onCheckedChange={v => setUseJob1(!!v)}
                />
                <Label htmlFor="job1-check" className="cursor-pointer font-medium">
                  Job 1 erfassen
                </Label>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  id="job2-check"
                  checked={useJob2}
                  onCheckedChange={v => setUseJob2(!!v)}
                />
                <Label htmlFor="job2-check" className="cursor-pointer font-medium">
                  Job 2 erfassen
                </Label>
              </div>
              {!useJob1 && !useJob2 && (
                <p className="text-sm text-destructive">Wähle mindestens einen Job aus.</p>
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={goToStep2}
            disabled={!vonDate || !bisDate || (!useJob1 && !useJob2)}
          >
            Weiter
          </Button>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Zeitraum: <span className="font-medium text-foreground">{formatDate(vonDate)}</span>
            {vonDate !== bisDate && (
              <> bis <span className="font-medium text-foreground">{formatDate(bisDate)}</span></>
            )}
          </p>

          {saveError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Job 1 panel */}
            {useJob1 && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <IconBriefcase size={16} className="text-primary shrink-0" />
                      Job 1
                    </span>
                    <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">
                      {Math.round(job1TotalHours * 100) / 100} h · {formatCurrency(job1TotalEarnings)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setJob1DialogOpen(true)}
                    disabled={saving}
                  >
                    <IconPlus size={16} className="mr-2 shrink-0" />
                    Eintrag hinzufügen
                  </Button>

                  {job1Entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Noch keine Einträge
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {job1Entries.map(entry => (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/40 border"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-medium truncate">
                              {formatDate(entry.fields.job1_datum)}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <IconClock size={12} className="shrink-0" />
                              {entry.fields.job1_startzeit ?? '?'}
                              {entry.fields.job1_endzeit ? ` – ${entry.fields.job1_endzeit}` : ''}
                              {entry.fields.job1_pause ? ` (${entry.fields.job1_pause} min Pause)` : ''}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <IconCurrencyEuro size={12} className="shrink-0" />
                              {Math.round(entry.hours * 100) / 100} h · {formatCurrency(entry.earnings)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeJob1Entry(entry.id)}
                          >
                            <IconTrash size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {job1Entries.length > 0 && (
                    <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                      <span>Gesamt</span>
                      <span>{Math.round(job1TotalHours * 100) / 100} h · {formatCurrency(job1TotalEarnings)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Job 2 panel */}
            {useJob2 && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <IconBriefcase size={16} className="text-primary shrink-0" />
                      Job 2
                    </span>
                    <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">
                      {Math.round(job2TotalHours * 100) / 100} h · {formatCurrency(job2TotalEarnings)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setJob2DialogOpen(true)}
                    disabled={saving}
                  >
                    <IconPlus size={16} className="mr-2 shrink-0" />
                    Eintrag hinzufügen
                  </Button>

                  {job2Entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Noch keine Einträge
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {job2Entries.map(entry => (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/40 border"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-medium truncate">
                              {formatDate(entry.fields.job2_datum)}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <IconClock size={12} className="shrink-0" />
                              {entry.fields.job2_startzeit ?? '?'}
                              {entry.fields.job2_endzeit ? ` – ${entry.fields.job2_endzeit}` : ''}
                              {entry.fields.job2_pause ? ` (${entry.fields.job2_pause} min Pause)` : ''}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <IconCurrencyEuro size={12} className="shrink-0" />
                              {Math.round(entry.hours * 100) / 100} h · {formatCurrency(entry.earnings)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeJob2Entry(entry.id)}
                          >
                            <IconTrash size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {job2Entries.length > 0 && (
                    <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                      <span>Gesamt</span>
                      <span>{Math.round(job2TotalHours * 100) / 100} h · {formatCurrency(job2TotalEarnings)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
              Zurück
            </Button>
            <Button
              className="flex-1"
              onClick={goToStep3}
              disabled={job1Entries.length === 0 && job2Entries.length === 0}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {success ? (
            <Card className="overflow-hidden border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center">
                  <IconCheck size={28} className="text-white" stroke={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-700 dark:text-green-400">
                    Einträge erfolgreich gespeichert!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Alle Arbeitszeiten wurden erfasst{createBericht ? ' und ein Bericht erstellt' : ''}.
                  </p>
                </div>
                <Button onClick={resetWizard} variant="outline">
                  Neue Erfassung starten
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base">Zusammenfassung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Zeitraum: {formatDate(vonDate)}{vonDate !== bisDate ? ` – ${formatDate(bisDate)}` : ''}
                  </p>

                  <div className="space-y-2">
                    {useJob1 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                        <div>
                          <p className="text-sm font-medium">Job 1</p>
                          <p className="text-xs text-muted-foreground">{job1Entries.length} Eintrag/Einträge</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{Math.round(job1TotalHours * 100) / 100} h</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(job1TotalEarnings)}</p>
                        </div>
                      </div>
                    )}
                    {useJob2 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                        <div>
                          <p className="text-sm font-medium">Job 2</p>
                          <p className="text-xs text-muted-foreground">{job2Entries.length} Eintrag/Einträge</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{Math.round(job2TotalHours * 100) / 100} h</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(job2TotalEarnings)}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-sm font-bold">Gesamt</p>
                      <div className="text-right">
                        <p className="text-sm font-bold">{Math.round(grandHours * 100) / 100} h</p>
                        <p className="text-xs font-semibold text-primary">{formatCurrency(grandEarnings)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bericht */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base">Gesamtübersicht erstellen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <Checkbox
                      id="bericht-check"
                      checked={createBericht}
                      onCheckedChange={v => setCreateBericht(!!v)}
                    />
                    <Label htmlFor="bericht-check" className="cursor-pointer">
                      Zusammenfassung als Bericht speichern
                    </Label>
                  </div>

                  {createBericht && (
                    <div className="space-y-3 pl-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="bericht-stunden">Gesamtstunden</Label>
                          <Input
                            id="bericht-stunden"
                            type="number"
                            step="0.01"
                            min="0"
                            value={berichtStunden}
                            onChange={e => setBerichtStunden(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="bericht-verdienst">Gesamtverdienst (€)</Label>
                          <Input
                            id="bericht-verdienst"
                            type="number"
                            step="0.01"
                            min="0"
                            value={berichtVerdienst}
                            onChange={e => setBerichtVerdienst(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="bericht-notizen">Notizen</Label>
                        <Textarea
                          id="bericht-notizen"
                          placeholder="Optionale Anmerkungen zum Zeitraum..."
                          value={berichtNotizen}
                          onChange={e => setBerichtNotizen(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  {finishError && (
                    <p className="text-sm text-destructive">{finishError}</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                  Zurück
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleFinish}
                  disabled={finishSaving}
                >
                  {finishSaving ? 'Wird gespeichert…' : 'Abschließen'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Dialogs */}
      <Job1StundeneintragDialog
        open={job1DialogOpen}
        onClose={() => setJob1DialogOpen(false)}
        onSubmit={handleJob1Submit}
        defaultValues={{ job1_datum: vonDate }}
        enablePhotoScan={false}
        enablePhotoLocation={false}
      />

      <Job2StundeneintragDialog
        open={job2DialogOpen}
        onClose={() => setJob2DialogOpen(false)}
        onSubmit={handleJob2Submit}
        defaultValues={{ job2_datum: vonDate }}
        enablePhotoScan={false}
        enablePhotoLocation={false}
      />
    </IntentWizardShell>
  );
}
