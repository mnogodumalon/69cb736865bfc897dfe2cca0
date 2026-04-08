import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { IconBriefcase, IconClock, IconCheck, IconArrowLeft, IconPlus } from '@tabler/icons-react';

const STEPS = [
  { label: 'Job auswählen' },
  { label: 'Stunden eintragen' },
  { label: 'Bestätigen & Speichern' },
];

function getTodayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function calcArbeitsstunden(start: string, end: string, pauseMin: number): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
  const totalMin = (eh * 60 + em) - (sh * 60 + sm) - (pauseMin || 0);
  if (totalMin <= 0) return null;
  return Math.round((totalMin / 60) * 100) / 100;
}

export default function StundenErfassenPage() {
  const { job1Stundeneintrag, job2Stundeneintrag, loading, error, fetchAll } = useDashboardData();
  const [searchParams] = useSearchParams();

  const initialStep = (() => {
    const p = parseInt(searchParams.get('step') ?? '', 10);
    if (p >= 1 && p <= 3) return p;
    return 1;
  })();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedJob, setSelectedJob] = useState<1 | 2 | null>(null);
  const [datum, setDatum] = useState(getTodayStr());
  const [startzeit, setStartzeit] = useState('');
  const [endzeit, setEndzeit] = useState('');
  const [pause, setPause] = useState(0);
  const [stundenlohn, setStundenlohn] = useState('');
  const [notizen, setNotizen] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Derive employer name from most recent entry
  const job1Arbeitgeber = useMemo(() => {
    if (!job1Stundeneintrag.length) return 'Job 1';
    const sorted = [...job1Stundeneintrag].sort((a, b) =>
      (b.fields.job1_datum ?? '').localeCompare(a.fields.job1_datum ?? '')
    );
    return sorted[0].fields.job1_arbeitgeber || 'Job 1';
  }, [job1Stundeneintrag]);

  const job2Arbeitgeber = useMemo(() => {
    if (!job2Stundeneintrag.length) return 'Job 2';
    const sorted = [...job2Stundeneintrag].sort((a, b) =>
      (b.fields.job2_datum ?? '').localeCompare(a.fields.job2_datum ?? '')
    );
    return sorted[0].fields.job2_arbeitgeber || 'Job 2';
  }, [job2Stundeneintrag]);

  const arbeitsstunden = useMemo(
    () => calcArbeitsstunden(startzeit, endzeit, pause),
    [startzeit, endzeit, pause]
  );

  const verdienst = useMemo(() => {
    const lohn = parseFloat(stundenlohn);
    if (arbeitsstunden === null || isNaN(lohn)) return null;
    return Math.round(arbeitsstunden * lohn * 100) / 100;
  }, [arbeitsstunden, stundenlohn]);

  function handleJobSelect(job: 1 | 2) {
    setSelectedJob(job);
    // Pre-fill stundenlohn from most recent entry of that job
    if (job === 1 && job1Stundeneintrag.length) {
      const sorted = [...job1Stundeneintrag].sort((a, b) =>
        (b.fields.job1_datum ?? '').localeCompare(a.fields.job1_datum ?? '')
      );
      const lohn = sorted[0].fields.job1_stundenlohn;
      if (lohn !== undefined) setStundenlohn(String(lohn));
    } else if (job === 2 && job2Stundeneintrag.length) {
      const sorted = [...job2Stundeneintrag].sort((a, b) =>
        (b.fields.job2_datum ?? '').localeCompare(a.fields.job2_datum ?? '')
      );
      const lohn = sorted[0].fields.job2_stundenlohn;
      if (lohn !== undefined) setStundenlohn(String(lohn));
    }
    setCurrentStep(2);
  }

  function isStep2Valid() {
    return datum && startzeit && endzeit && stundenlohn && arbeitsstunden !== null;
  }

  async function handleSave() {
    if (!selectedJob || arbeitsstunden === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      const lohn = parseFloat(stundenlohn);
      const verd = verdienst ?? 0;
      if (selectedJob === 1) {
        await LivingAppsService.createJob1StundeneintragEntry({
          job1_datum: datum,
          job1_startzeit: startzeit,
          job1_endzeit: endzeit,
          job1_pause: pause,
          job1_arbeitsstunden: arbeitsstunden,
          job1_stundenlohn: lohn,
          job1_notizen: notizen || undefined,
          job1_arbeitgeber: job1Arbeitgeber !== 'Job 1' ? job1Arbeitgeber : undefined,
        });
      } else {
        await LivingAppsService.createJob2StundeneintragEntry({
          job2_datum: datum,
          job2_startzeit: startzeit,
          job2_endzeit: endzeit,
          job2_pause: pause,
          job2_arbeitsstunden: arbeitsstunden,
          job2_stundenlohn: lohn,
          job2_notizen: notizen || undefined,
          job2_arbeitgeber: job2Arbeitgeber !== 'Job 2' ? job2Arbeitgeber : undefined,
        });
      }
      await fetchAll();
      setSaved(true);
      // suppress unused warning
      void verd;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelectedJob(null);
    setDatum(getTodayStr());
    setStartzeit('');
    setEndzeit('');
    setPause(0);
    setStundenlohn('');
    setNotizen('');
    setSaved(false);
    setSaveError(null);
    setCurrentStep(1);
  }

  return (
    <IntentWizardShell
      title="Stunden erfassen"
      subtitle="Trage deine Arbeitsstunden in wenigen Schritten ein."
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Job auswählen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Für welchen Job möchtest du Stunden eintragen?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Job 1 Card */}
            <button
              type="button"
              onClick={() => handleJobSelect(1)}
              className="text-left bg-card border border-border rounded-xl overflow-hidden p-6 hover:border-primary hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IconBriefcase size={20} className="text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job 1</span>
              </div>
              <h3 className="font-semibold text-foreground text-lg truncate">{job1Arbeitgeber}</h3>
              {job1Stundeneintrag.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {job1Stundeneintrag.length} Einträge vorhanden
                </p>
              )}
            </button>

            {/* Job 2 Card */}
            <button
              type="button"
              onClick={() => handleJobSelect(2)}
              className="text-left bg-card border border-border rounded-xl overflow-hidden p-6 hover:border-primary hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IconBriefcase size={20} className="text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job 2</span>
              </div>
              <h3 className="font-semibold text-foreground text-lg truncate">{job2Arbeitgeber}</h3>
              {job2Stundeneintrag.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {job2Stundeneintrag.length} Einträge vorhanden
                </p>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Stunden eintragen */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card className="bg-card border border-border rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <IconClock size={18} className="text-primary" />
                <span className="font-semibold">
                  Stunden eintragen —{' '}
                  <span className="text-muted-foreground font-normal">
                    {selectedJob === 1 ? job1Arbeitgeber : job2Arbeitgeber}
                  </span>
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Datum */}
              <div className="space-y-1.5">
                <Label htmlFor="datum">Datum</Label>
                <Input
                  id="datum"
                  type="date"
                  value={datum}
                  onChange={e => setDatum(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Zeiten */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="startzeit">Startzeit</Label>
                  <Input
                    id="startzeit"
                    type="time"
                    value={startzeit}
                    onChange={e => setStartzeit(e.target.value)}
                    placeholder="09:00"
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endzeit">Endzeit</Label>
                  <Input
                    id="endzeit"
                    type="time"
                    value={endzeit}
                    onChange={e => setEndzeit(e.target.value)}
                    placeholder="17:00"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Pause + Stundenlohn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pause">Pause (Minuten)</Label>
                  <Input
                    id="pause"
                    type="number"
                    min={0}
                    value={pause}
                    onChange={e => setPause(parseInt(e.target.value) || 0)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stundenlohn">Stundenlohn (€)</Label>
                  <Input
                    id="stundenlohn"
                    type="number"
                    min={0}
                    step="0.01"
                    value={stundenlohn}
                    onChange={e => setStundenlohn(e.target.value)}
                    placeholder="15.00"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Live-Vorschau */}
              <div className="flex flex-wrap gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Arbeitsstunden:</span>
                  <Badge variant={arbeitsstunden !== null ? 'default' : 'secondary'}>
                    {arbeitsstunden !== null ? `${arbeitsstunden} Std.` : '—'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Verdienst:</span>
                  <Badge variant={verdienst !== null ? 'default' : 'secondary'}>
                    {verdienst !== null ? `${verdienst.toFixed(2)} €` : '—'}
                  </Badge>
                </div>
              </div>

              {/* Notizen */}
              <div className="space-y-1.5">
                <Label htmlFor="notizen">Notizen (optional)</Label>
                <Textarea
                  id="notizen"
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder="z. B. Überstunden, besondere Aufgaben…"
                  className="w-full resize-none"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dialog-Alternative */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Oder direkt über den Dialog:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              <IconPlus size={15} className="mr-1.5" />
              Über Dialog erstellen
            </Button>
          </div>

          {selectedJob === 1 && (
            <Job1StundeneintragDialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.createJob1StundeneintragEntry(fields);
                await fetchAll();
                setDialogOpen(false);
              }}
            />
          )}
          {selectedJob === 2 && (
            <Job2StundeneintragDialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.createJob2StundeneintragEntry(fields);
                await fetchAll();
                setDialogOpen(false);
              }}
            />
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2"
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(3)}
              disabled={!isStep2Valid()}
              className="flex-1 sm:flex-none"
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Bestätigen & Speichern */}
      {currentStep === 3 && !saved && (
        <div className="space-y-6">
          <Card className="bg-card border border-border rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <IconCheck size={18} className="text-primary" />
                <span className="font-semibold">Zusammenfassung</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="flex justify-between sm:flex-col gap-1">
                  <span className="text-muted-foreground">Job</span>
                  <span className="font-medium">
                    {selectedJob === 1 ? job1Arbeitgeber : job2Arbeitgeber}
                  </span>
                </div>
                <div className="flex justify-between sm:flex-col gap-1">
                  <span className="text-muted-foreground">Datum</span>
                  <span className="font-medium">{datum}</span>
                </div>
                <div className="flex justify-between sm:flex-col gap-1">
                  <span className="text-muted-foreground">Startzeit</span>
                  <span className="font-medium">{startzeit || '—'}</span>
                </div>
                <div className="flex justify-between sm:flex-col gap-1">
                  <span className="text-muted-foreground">Endzeit</span>
                  <span className="font-medium">{endzeit || '—'}</span>
                </div>
                <div className="flex justify-between sm:flex-col gap-1">
                  <span className="text-muted-foreground">Pause</span>
                  <span className="font-medium">{pause} Min.</span>
                </div>
                <div className="flex justify-between sm:flex-col gap-1">
                  <span className="text-muted-foreground">Stundenlohn</span>
                  <span className="font-medium">{stundenlohn ? `${parseFloat(stundenlohn).toFixed(2)} €` : '—'}</span>
                </div>
                {notizen && (
                  <div className="flex justify-between sm:flex-col gap-1 col-span-full">
                    <span className="text-muted-foreground">Notizen</span>
                    <span className="font-medium">{notizen}</span>
                  </div>
                )}
              </div>

              {/* Calculated totals — prominently displayed */}
              <div className="border-t border-border pt-4 flex flex-wrap gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Arbeitsstunden</span>
                  <span className="text-2xl font-bold text-primary">
                    {arbeitsstunden !== null ? `${arbeitsstunden} Std.` : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Verdienst</span>
                  <span className="text-2xl font-bold text-primary">
                    {verdienst !== null ? `${verdienst.toFixed(2)} €` : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-2"
              disabled={saving}
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || arbeitsstunden === null}
              className="flex-1 sm:flex-none"
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
          </div>
        </div>
      )}

      {/* Success state */}
      {currentStep === 3 && saved && (
        <div className="space-y-6">
          <Card className="bg-card border border-border rounded-xl overflow-hidden">
            <CardContent className="flex flex-col items-center text-center py-10 gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <IconCheck size={28} className="text-primary" stroke={2.5} />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">Eintrag gespeichert!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Deine Stunden wurden erfolgreich eingetragen.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2 w-full sm:w-auto">
                <Button
                  onClick={handleReset}
                  className="w-full sm:w-auto"
                >
                  <IconPlus size={16} className="mr-2" />
                  Neuen Eintrag erfassen
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="w-full sm:w-auto"
                >
                  <a href="#/">Zur Übersicht</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </IntentWizardShell>
  );
}
