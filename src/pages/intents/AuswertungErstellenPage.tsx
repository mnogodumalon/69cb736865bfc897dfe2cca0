import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  IconCalendar,
  IconPlus,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconCircleCheck,
  IconBriefcase,
  IconCoin,
  IconClock,
  IconFileText,
} from '@tabler/icons-react';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';

const WIZARD_STEPS = [
  { label: 'Zeitraum' },
  { label: 'Job 1' },
  { label: 'Job 2' },
  { label: 'Speichern' },
];

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy');
  } catch {
    return dateStr;
  }
}

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export default function AuswertungErstellenPage() {
  const [searchParams] = useSearchParams();

  // Step state — initialize from URL
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 4 ? s : 1;
  })();
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Step 1 state
  const today = new Date();
  const [vonDate, setVonDate] = useState(toDateInputValue(startOfMonth(today)));
  const [bisDate, setBisDate] = useState(toDateInputValue(endOfMonth(today)));
  const [notizen, setNotizen] = useState('');

  // Step 2 state
  const [job1Entries, setJob1Entries] = useState<Job1Stundeneintrag[]>([]);
  const [selectedJob1Ids, setSelectedJob1Ids] = useState<Set<string>>(new Set());
  const [job1Loading, setJob1Loading] = useState(false);
  const [job1Error, setJob1Error] = useState<string | null>(null);
  const [job1DialogOpen, setJob1DialogOpen] = useState(false);

  // Step 3 state
  const [job2Entries, setJob2Entries] = useState<Job2Stundeneintrag[]>([]);
  const [selectedJob2Ids, setSelectedJob2Ids] = useState<Set<string>>(new Set());
  const [job2Loading, setJob2Loading] = useState(false);
  const [job2Error, setJob2Error] = useState<string | null>(null);
  const [job2DialogOpen, setJob2DialogOpen] = useState(false);

  // Step 4 state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  const fetchJob1 = useCallback(async () => {
    setJob1Loading(true);
    setJob1Error(null);
    try {
      const data = await LivingAppsService.getJob1Stundeneintrag();
      setJob1Entries(data);
      // Auto-select entries within date range
      const filtered = data.filter((e) => {
        const d = e.fields.job1_datum;
        if (!d) return false;
        const dateStr = d.slice(0, 10);
        return dateStr >= vonDate && dateStr <= bisDate;
      });
      setSelectedJob1Ids(new Set(filtered.map((e) => e.record_id)));
    } catch (err: unknown) {
      setJob1Error(err instanceof Error ? err.message : 'Fehler beim Laden der Job-1-Einträge');
    } finally {
      setJob1Loading(false);
    }
  }, [vonDate, bisDate]);

  const fetchJob2 = useCallback(async () => {
    setJob2Loading(true);
    setJob2Error(null);
    try {
      const data = await LivingAppsService.getJob2Stundeneintrag();
      setJob2Entries(data);
      const filtered = data.filter((e) => {
        const d = e.fields.job2_datum;
        if (!d) return false;
        const dateStr = d.slice(0, 10);
        return dateStr >= vonDate && dateStr <= bisDate;
      });
      setSelectedJob2Ids(new Set(filtered.map((e) => e.record_id)));
    } catch (err: unknown) {
      setJob2Error(err instanceof Error ? err.message : 'Fehler beim Laden der Job-2-Einträge');
    } finally {
      setJob2Loading(false);
    }
  }, [vonDate, bisDate]);

  // Fetch data when reaching steps 2 or 3
  useEffect(() => {
    if (currentStep === 2) {
      fetchJob1();
    } else if (currentStep === 3) {
      fetchJob2();
    }
  }, [currentStep, fetchJob1, fetchJob2]);

  // Filtered entries within date range
  const filteredJob1 = job1Entries.filter((e) => {
    const d = e.fields.job1_datum;
    if (!d) return false;
    const dateStr = d.slice(0, 10);
    return dateStr >= vonDate && dateStr <= bisDate;
  });

  const filteredJob2 = job2Entries.filter((e) => {
    const d = e.fields.job2_datum;
    if (!d) return false;
    const dateStr = d.slice(0, 10);
    return dateStr >= vonDate && dateStr <= bisDate;
  });

  // Totals
  const selectedJob1 = filteredJob1.filter((e) => selectedJob1Ids.has(e.record_id));
  const job1TotalHours = selectedJob1.reduce((sum, e) => sum + (e.fields.job1_arbeitsstunden ?? 0), 0);
  const job1TotalVerdienst = selectedJob1.reduce(
    (sum, e) => sum + (e.fields.job1_arbeitsstunden ?? 0) * (e.fields.job1_stundenlohn ?? 0),
    0
  );

  const selectedJob2 = filteredJob2.filter((e) => selectedJob2Ids.has(e.record_id));
  const job2TotalHours = selectedJob2.reduce((sum, e) => sum + (e.fields.job2_arbeitsstunden ?? 0), 0);
  const job2TotalVerdienst = selectedJob2.reduce(
    (sum, e) => sum + (e.fields.job2_arbeitsstunden ?? 0) * (e.fields.job2_stundenlohn ?? 0),
    0
  );

  const gesamtStunden = job1TotalHours + job2TotalHours;
  const gesamtVerdienst = job1TotalVerdienst + job2TotalVerdienst;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const job1Arr = selectedJob1;
      const job2Arr = selectedJob2;

      const fields: Record<string, unknown> = {
        gesamt_stunden: gesamtStunden,
        gesamt_verdienst: gesamtVerdienst,
        auswertung_von: vonDate,
        auswertung_bis: bisDate,
      };
      if (notizen.trim()) {
        fields.auswertung_notizen = notizen.trim();
      }
      if (job1Arr.length > 0) {
        fields.job1_eintraege = createRecordUrl(APP_IDS.JOB_1_STUNDENEINTRAG, job1Arr[0].record_id);
      }
      if (job2Arr.length > 0) {
        fields.job2_eintraege = createRecordUrl(APP_IDS.JOB_2_STUNDENEINTRAG, job2Arr[0].record_id);
      }

      const result = await LivingAppsService.createGesamtuebersichtEntry(fields as Parameters<typeof LivingAppsService.createGesamtuebersichtEntry>[0]);
      const newId = result?.record_id ?? result?.id ?? 'neu';
      setSavedRecordId(newId);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Speichern der Auswertung');
    } finally {
      setSaving(false);
    }
  };

  const isStep1Valid = vonDate && bisDate && vonDate <= bisDate;

  return (
    <IntentWizardShell
      title="Auswertung erstellen"
      subtitle="Erstelle eine neue Gesamtübersicht für einen Zeitraum"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
    >
      {/* Step 1: Zeitraum festlegen */}
      {currentStep === 1 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <IconCalendar size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Zeitraum festlegen</h2>
                <p className="text-sm text-muted-foreground">Wähle den Auswertungszeitraum</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
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
            {vonDate && bisDate && vonDate > bisDate && (
              <p className="text-sm text-destructive">Das Startdatum muss vor dem Enddatum liegen.</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="notizen">Notizen (optional)</Label>
              <Textarea
                id="notizen"
                placeholder="Optionale Hinweise zur Auswertung..."
                value={notizen}
                onChange={(e) => setNotizen(e.target.value)}
                rows={3}
                className="w-full"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!isStep1Valid}
              >
                Weiter
                <IconChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Job 1 Einträge auswählen */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <IconBriefcase size={16} className="text-blue-500" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-base">Job 1 Einträge auswählen</h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {formatDate(vonDate)} – {formatDate(bisDate)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2 space-y-3">
              {job1Loading && (
                <div className="py-8 text-center text-sm text-muted-foreground">Einträge werden geladen...</div>
              )}
              {job1Error && (
                <div className="py-4 text-center text-sm text-destructive">{job1Error}</div>
              )}
              {!job1Loading && !job1Error && (
                <>
                  {filteredJob1.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Keine Job-1-Einträge im gewählten Zeitraum gefunden.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 pb-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedJob1Ids(new Set(filteredJob1.map((e) => e.record_id)))}
                        >
                          Alle auswählen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedJob1Ids(new Set())}
                        >
                          Alle abwählen
                        </Button>
                        <Badge variant="secondary" className="ml-auto">
                          {selectedJob1Ids.size} / {filteredJob1.length}
                        </Badge>
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {filteredJob1.map((entry) => {
                          const isSelected = selectedJob1Ids.has(entry.record_id);
                          const verdienst =
                            (entry.fields.job1_arbeitsstunden ?? 0) * (entry.fields.job1_stundenlohn ?? 0);
                          return (
                            <button
                              key={entry.record_id}
                              type="button"
                              onClick={() => {
                                const next = new Set(selectedJob1Ids);
                                if (isSelected) next.delete(entry.record_id);
                                else next.add(entry.record_id);
                                setSelectedJob1Ids(next);
                              }}
                              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border bg-card hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                  isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                                }`}>
                                  {isSelected && <IconCheck size={12} stroke={3} className="text-primary-foreground" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm truncate">
                                      {entry.fields.job1_datum ? formatDate(entry.fields.job1_datum) : '–'}
                                    </span>
                                    {entry.fields.job1_arbeitgeber && (
                                      <span className="text-sm text-muted-foreground truncate">
                                        {entry.fields.job1_arbeitgeber}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                                    {entry.fields.job1_startzeit && entry.fields.job1_endzeit && (
                                      <span>{entry.fields.job1_startzeit} – {entry.fields.job1_endzeit}</span>
                                    )}
                                    {entry.fields.job1_arbeitsstunden != null && (
                                      <span className="flex items-center gap-1">
                                        <IconClock size={11} />
                                        {entry.fields.job1_arbeitsstunden.toFixed(1)} h
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1 font-medium text-foreground">
                                      <IconCoin size={11} />
                                      {verdienst.toFixed(2)} €
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Running totals */}
                  <div className="rounded-lg bg-muted/60 px-4 py-3 flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <IconClock size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Ausgewählte Stunden:</span>
                      <span className="font-semibold">{job1TotalHours.toFixed(1)} h</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconCoin size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Verdienst:</span>
                      <span className="font-semibold">{job1TotalVerdienst.toFixed(2)} €</span>
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setJob1DialogOpen(true)}
          >
            <IconPlus size={16} className="mr-2" />
            Neuen Job-1-Eintrag erstellen
          </Button>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setCurrentStep(1)}>
              <IconChevronLeft size={16} className="mr-1" />
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(3)}>
              Weiter
              <IconChevronRight size={16} className="ml-1" />
            </Button>
          </div>

          <Job1StundeneintragDialog
            open={job1DialogOpen}
            onClose={() => setJob1DialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createJob1StundeneintragEntry(fields);
              await fetchJob1();
              setJob1DialogOpen(false);
            }}
            defaultValues={undefined}
          />
        </div>
      )}

      {/* Step 3: Job 2 Einträge auswählen */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <IconBriefcase size={16} className="text-purple-500" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-base">Job 2 Einträge auswählen</h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {formatDate(vonDate)} – {formatDate(bisDate)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2 space-y-3">
              {job2Loading && (
                <div className="py-8 text-center text-sm text-muted-foreground">Einträge werden geladen...</div>
              )}
              {job2Error && (
                <div className="py-4 text-center text-sm text-destructive">{job2Error}</div>
              )}
              {!job2Loading && !job2Error && (
                <>
                  {filteredJob2.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Keine Job-2-Einträge im gewählten Zeitraum gefunden.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 pb-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedJob2Ids(new Set(filteredJob2.map((e) => e.record_id)))}
                        >
                          Alle auswählen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedJob2Ids(new Set())}
                        >
                          Alle abwählen
                        </Button>
                        <Badge variant="secondary" className="ml-auto">
                          {selectedJob2Ids.size} / {filteredJob2.length}
                        </Badge>
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {filteredJob2.map((entry) => {
                          const isSelected = selectedJob2Ids.has(entry.record_id);
                          const verdienst =
                            (entry.fields.job2_arbeitsstunden ?? 0) * (entry.fields.job2_stundenlohn ?? 0);
                          return (
                            <button
                              key={entry.record_id}
                              type="button"
                              onClick={() => {
                                const next = new Set(selectedJob2Ids);
                                if (isSelected) next.delete(entry.record_id);
                                else next.add(entry.record_id);
                                setSelectedJob2Ids(next);
                              }}
                              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border bg-card hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                  isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                                }`}>
                                  {isSelected && <IconCheck size={12} stroke={3} className="text-primary-foreground" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm truncate">
                                      {entry.fields.job2_datum ? formatDate(entry.fields.job2_datum) : '–'}
                                    </span>
                                    {entry.fields.job2_arbeitgeber && (
                                      <span className="text-sm text-muted-foreground truncate">
                                        {entry.fields.job2_arbeitgeber}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                                    {entry.fields.job2_startzeit && entry.fields.job2_endzeit && (
                                      <span>{entry.fields.job2_startzeit} – {entry.fields.job2_endzeit}</span>
                                    )}
                                    {entry.fields.job2_arbeitsstunden != null && (
                                      <span className="flex items-center gap-1">
                                        <IconClock size={11} />
                                        {entry.fields.job2_arbeitsstunden.toFixed(1)} h
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1 font-medium text-foreground">
                                      <IconCoin size={11} />
                                      {verdienst.toFixed(2)} €
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Running totals */}
                  <div className="rounded-lg bg-muted/60 px-4 py-3 flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <IconClock size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Ausgewählte Stunden:</span>
                      <span className="font-semibold">{job2TotalHours.toFixed(1)} h</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconCoin size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Verdienst:</span>
                      <span className="font-semibold">{job2TotalVerdienst.toFixed(2)} €</span>
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setJob2DialogOpen(true)}
          >
            <IconPlus size={16} className="mr-2" />
            Neuen Job-2-Eintrag erstellen
          </Button>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setCurrentStep(2)}>
              <IconChevronLeft size={16} className="mr-1" />
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(4)}>
              Weiter
              <IconChevronRight size={16} className="ml-1" />
            </Button>
          </div>

          <Job2StundeneintragDialog
            open={job2DialogOpen}
            onClose={() => setJob2DialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createJob2StundeneintragEntry(fields);
              await fetchJob2();
              setJob2DialogOpen(false);
            }}
            defaultValues={undefined}
          />
        </div>
      )}

      {/* Step 4: Auswertung speichern */}
      {currentStep === 4 && (
        <div className="space-y-4">
          {savedRecordId ? (
            <Card className="overflow-hidden">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                    <IconCircleCheck size={28} className="text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Auswertung gespeichert!</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Die Gesamtübersicht wurde erfolgreich angelegt.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSavedRecordId(null);
                        setSaveError(null);
                        setCurrentStep(1);
                        setVonDate(toDateInputValue(startOfMonth(new Date())));
                        setBisDate(toDateInputValue(endOfMonth(new Date())));
                        setNotizen('');
                        setSelectedJob1Ids(new Set());
                        setSelectedJob2Ids(new Set());
                      }}
                    >
                      Neue Auswertung
                    </Button>
                    <Button asChild>
                      <a href="#/gesamtuebersicht">Zur Übersicht</a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <IconFileText size={16} className="text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-base">Auswertung speichern</h2>
                      <p className="text-sm text-muted-foreground">Zusammenfassung prüfen und anlegen</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 space-y-4">
                  {/* Zeitraum */}
                  <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Zeitraum</p>
                    <p className="font-medium text-sm">
                      {formatDate(vonDate)} – {formatDate(bisDate)}
                    </p>
                  </div>

                  {/* Job 1 Summary */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="font-medium text-sm">Job 1</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {selectedJob1.length} Einträge
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Stunden gesamt</p>
                        <p className="font-semibold">{job1TotalHours.toFixed(1)} h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Verdienst</p>
                        <p className="font-semibold">{job1TotalVerdienst.toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>

                  {/* Job 2 Summary */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="font-medium text-sm">Job 2</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {selectedJob2.length} Einträge
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Stunden gesamt</p>
                        <p className="font-semibold">{job2TotalHours.toFixed(1)} h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Verdienst</p>
                        <p className="font-semibold">{job2TotalVerdienst.toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>

                  {/* Gesamtübersicht */}
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 text-center space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">Gesamt</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-3xl font-bold text-foreground">{gesamtStunden.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Stunden</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-foreground">{gesamtVerdienst.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Euro Verdienst</p>
                      </div>
                    </div>
                  </div>

                  {/* Notizen */}
                  {notizen.trim() && (
                    <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notizen</p>
                      <p className="text-sm whitespace-pre-wrap">{notizen}</p>
                    </div>
                  )}

                  {saveError && (
                    <p className="text-sm text-destructive">{saveError}</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setCurrentStep(3)}>
                  <IconChevronLeft size={16} className="mr-1" />
                  Zurück
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    'Wird gespeichert...'
                  ) : (
                    <>
                      <IconCircleCheck size={16} className="mr-2" />
                      Auswertung anlegen
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
