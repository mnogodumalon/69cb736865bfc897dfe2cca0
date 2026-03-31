import { useState, useMemo } from 'react';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Job1StundeneintragDialog } from '@/components/dialogs/Job1StundeneintragDialog';
import { Job2StundeneintragDialog } from '@/components/dialogs/Job2StundeneintragDialog';
import { LivingAppsService } from '@/services/livingAppsService';
import type { Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import {
  IconCalendar,
  IconBriefcase,
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconPlus,
  IconCurrencyEuro,
} from '@tabler/icons-react';

function todayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

function formatEuro(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function ArbeitstageErfassenPage() {
  const [selectedDate, setSelectedDate] = useState<string>(todayString());
  const [job1Selected, setJob1Selected] = useState<boolean>(false);
  const [job2Selected, setJob2Selected] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [job1DialogOpen, setJob1DialogOpen] = useState<boolean>(false);
  const [job2DialogOpen, setJob2DialogOpen] = useState<boolean>(false);

  const [createdJob1Fields, setCreatedJob1Fields] = useState<Job1Stundeneintrag['fields'] | null>(null);
  const [createdJob2Fields, setCreatedJob2Fields] = useState<Job2Stundeneintrag['fields'] | null>(null);

  const steps = useMemo(() => {
    const s: { id: string; label: string }[] = [{ id: 'auswahl', label: 'Tag & Jobs' }];
    if (job1Selected) s.push({ id: 'job1', label: 'Job 1' });
    if (job2Selected) s.push({ id: 'job2', label: 'Job 2' });
    s.push({ id: 'zusammenfassung', label: 'Zusammenfassung' });
    return s;
  }, [job1Selected, job2Selected]);

  const totalSteps = steps.length;

  // Step index in the steps array (1-based for IntentWizardShell)
  // currentStep is 1-based

  const currentStepId = steps[currentStep - 1]?.id;

  const canProceedFromStep1 = job1Selected || job2Selected;

  function goNext() {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  }

  function goBack() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }

  function resetWizard() {
    setSelectedDate(todayString());
    setJob1Selected(false);
    setJob2Selected(false);
    setCurrentStep(1);
    setCreatedJob1Fields(null);
    setCreatedJob2Fields(null);
  }

  const job1Verdienst = (createdJob1Fields?.job1_arbeitsstunden ?? 0) * (createdJob1Fields?.job1_stundenlohn ?? 0);
  const job2Verdienst = (createdJob2Fields?.job2_arbeitsstunden ?? 0) * (createdJob2Fields?.job2_stundenlohn ?? 0);
  const totalStunden = (createdJob1Fields?.job1_arbeitsstunden ?? 0) + (createdJob2Fields?.job2_arbeitsstunden ?? 0);
  const totalVerdienst = job1Verdienst + job2Verdienst;

  return (
    <>
      <IntentWizardShell
        title="Arbeitstag erfassen"
        subtitle="Erfasse deine Arbeitsstunden schnell und einfach für einen Tag."
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        loading={false}
        error={null}
      >
        {/* Step 1: Tag & Jobs auswählen */}
        {currentStepId === 'auswahl' && (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="datum" className="flex items-center gap-2 text-sm font-medium">
                    <IconCalendar size={16} className="text-muted-foreground" />
                    Datum
                  </Label>
                  <Input
                    id="datum"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="max-w-xs"
                  />
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <IconBriefcase size={16} className="text-muted-foreground" />
                    Welche Jobs hast du heute gearbeitet?
                  </p>

                  <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/30">
                    <Checkbox
                      id="job1"
                      checked={job1Selected}
                      onCheckedChange={(checked) => {
                        setJob1Selected(checked === true);
                        if (!checked) setCreatedJob1Fields(null);
                      }}
                    />
                    <Label htmlFor="job1" className="text-sm font-medium cursor-pointer">
                      Job 1 heute gearbeitet
                    </Label>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/30">
                    <Checkbox
                      id="job2"
                      checked={job2Selected}
                      onCheckedChange={(checked) => {
                        setJob2Selected(checked === true);
                        if (!checked) setCreatedJob2Fields(null);
                      }}
                    />
                    <Label htmlFor="job2" className="text-sm font-medium cursor-pointer">
                      Job 2 heute gearbeitet
                    </Label>
                  </div>

                  {!canProceedFromStep1 && (
                    <p className="text-xs text-muted-foreground pl-1">
                      Wähle mindestens einen Job aus, um fortzufahren.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={goNext}
                disabled={!canProceedFromStep1}
                className="gap-2"
              >
                Weiter
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Job 1 erfassen */}
        {currentStepId === 'job1' && (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconCalendar size={15} />
                  <span>Datum: <span className="font-medium text-foreground">{formatDate(selectedDate)}</span></span>
                </div>

                <div className="border-t pt-4">
                  {createdJob1Fields ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <IconCheck size={12} className="text-white" stroke={3} />
                        </div>
                        Job 1 Eintrag erstellt
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {createdJob1Fields.job1_arbeitgeber && (
                          <div>
                            <p className="text-muted-foreground text-xs">Arbeitgeber</p>
                            <p className="font-medium truncate">{createdJob1Fields.job1_arbeitgeber}</p>
                          </div>
                        )}
                        {createdJob1Fields.job1_datum && (
                          <div>
                            <p className="text-muted-foreground text-xs">Datum</p>
                            <p className="font-medium">{formatDate(createdJob1Fields.job1_datum)}</p>
                          </div>
                        )}
                        {createdJob1Fields.job1_arbeitsstunden !== undefined && (
                          <div>
                            <p className="text-muted-foreground text-xs">Stunden</p>
                            <p className="font-medium">{createdJob1Fields.job1_arbeitsstunden} h</p>
                          </div>
                        )}
                        {createdJob1Fields.job1_stundenlohn !== undefined && (
                          <div>
                            <p className="text-muted-foreground text-xs">Stundenlohn</p>
                            <p className="font-medium">{formatEuro(createdJob1Fields.job1_stundenlohn)}</p>
                          </div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-green-200 flex items-center gap-2">
                        <IconCurrencyEuro size={15} className="text-green-700" />
                        <span className="text-sm font-semibold text-green-700">
                          Verdienst: {formatEuro(job1Verdienst)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <p className="text-sm text-muted-foreground text-center">
                        Erstelle deinen Job 1 Eintrag für diesen Tag.
                      </p>
                      <Button onClick={() => setJob1DialogOpen(true)} className="gap-2">
                        <IconPlus size={16} />
                        Job 1 Eintrag erstellen
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={goBack} className="gap-2">
                <IconChevronLeft size={16} />
                Zurück
              </Button>
              <Button onClick={goNext} disabled={!createdJob1Fields} className="gap-2">
                Weiter
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Job 2 erfassen */}
        {currentStepId === 'job2' && (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconCalendar size={15} />
                  <span>Datum: <span className="font-medium text-foreground">{formatDate(selectedDate)}</span></span>
                </div>

                <div className="border-t pt-4">
                  {createdJob2Fields ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <IconCheck size={12} className="text-white" stroke={3} />
                        </div>
                        Job 2 Eintrag erstellt
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {createdJob2Fields.job2_arbeitgeber && (
                          <div>
                            <p className="text-muted-foreground text-xs">Arbeitgeber</p>
                            <p className="font-medium truncate">{createdJob2Fields.job2_arbeitgeber}</p>
                          </div>
                        )}
                        {createdJob2Fields.job2_datum && (
                          <div>
                            <p className="text-muted-foreground text-xs">Datum</p>
                            <p className="font-medium">{formatDate(createdJob2Fields.job2_datum)}</p>
                          </div>
                        )}
                        {createdJob2Fields.job2_arbeitsstunden !== undefined && (
                          <div>
                            <p className="text-muted-foreground text-xs">Stunden</p>
                            <p className="font-medium">{createdJob2Fields.job2_arbeitsstunden} h</p>
                          </div>
                        )}
                        {createdJob2Fields.job2_stundenlohn !== undefined && (
                          <div>
                            <p className="text-muted-foreground text-xs">Stundenlohn</p>
                            <p className="font-medium">{formatEuro(createdJob2Fields.job2_stundenlohn)}</p>
                          </div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-green-200 flex items-center gap-2">
                        <IconCurrencyEuro size={15} className="text-green-700" />
                        <span className="text-sm font-semibold text-green-700">
                          Verdienst: {formatEuro(job2Verdienst)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <p className="text-sm text-muted-foreground text-center">
                        Erstelle deinen Job 2 Eintrag für diesen Tag.
                      </p>
                      <Button onClick={() => setJob2DialogOpen(true)} className="gap-2">
                        <IconPlus size={16} />
                        Job 2 Eintrag erstellen
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={goBack} className="gap-2">
                <IconChevronLeft size={16} />
                Zurück
              </Button>
              <Button onClick={goNext} disabled={!createdJob2Fields} className="gap-2">
                Weiter
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Zusammenfassung */}
        {currentStepId === 'zusammenfassung' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                <IconCheck size={20} className="text-white" stroke={3} />
              </div>
              <div>
                <p className="font-bold text-green-800 text-lg">Arbeitstag erfolgreich erfasst!</p>
                <p className="text-green-700 text-sm">{formatDate(selectedDate)}</p>
              </div>
            </div>

            <Card className="overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold text-base">Tagesübersicht</h2>

                {createdJob1Fields && (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job 1</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {createdJob1Fields.job1_arbeitgeber && (
                        <div>
                          <p className="text-muted-foreground text-xs">Arbeitgeber</p>
                          <p className="font-medium truncate">{createdJob1Fields.job1_arbeitgeber}</p>
                        </div>
                      )}
                      {createdJob1Fields.job1_arbeitsstunden !== undefined && (
                        <div>
                          <p className="text-muted-foreground text-xs">Stunden</p>
                          <p className="font-medium">{createdJob1Fields.job1_arbeitsstunden} h</p>
                        </div>
                      )}
                      {createdJob1Fields.job1_stundenlohn !== undefined && (
                        <div>
                          <p className="text-muted-foreground text-xs">Stundenlohn</p>
                          <p className="font-medium">{formatEuro(createdJob1Fields.job1_stundenlohn)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground text-xs">Verdienst</p>
                        <p className="font-semibold text-green-700">{formatEuro(job1Verdienst)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {createdJob2Fields && (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job 2</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {createdJob2Fields.job2_arbeitgeber && (
                        <div>
                          <p className="text-muted-foreground text-xs">Arbeitgeber</p>
                          <p className="font-medium truncate">{createdJob2Fields.job2_arbeitgeber}</p>
                        </div>
                      )}
                      {createdJob2Fields.job2_arbeitsstunden !== undefined && (
                        <div>
                          <p className="text-muted-foreground text-xs">Stunden</p>
                          <p className="font-medium">{createdJob2Fields.job2_arbeitsstunden} h</p>
                        </div>
                      )}
                      {createdJob2Fields.job2_stundenlohn !== undefined && (
                        <div>
                          <p className="text-muted-foreground text-xs">Stundenlohn</p>
                          <p className="font-medium">{formatEuro(createdJob2Fields.job2_stundenlohn)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground text-xs">Verdienst</p>
                        <p className="font-semibold text-green-700">{formatEuro(job2Verdienst)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-primary/10 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Gesamtstunden</p>
                    <p className="text-2xl font-bold text-primary">{totalStunden} h</p>
                  </div>
                  <div className="rounded-lg bg-green-100 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                      <IconCurrencyEuro size={12} />
                      Gesamtverdienst
                    </p>
                    <p className="text-2xl font-bold text-green-700">{formatEuro(totalVerdienst)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={resetWizard} variant="outline" className="flex-1">
                Weiteren Tag erfassen
              </Button>
              <Button asChild className="flex-1">
                <a href="#/">Zum Dashboard</a>
              </Button>
            </div>
          </div>
        )}
      </IntentWizardShell>

      <Job1StundeneintragDialog
        open={job1DialogOpen}
        onClose={() => setJob1DialogOpen(false)}
        onSubmit={async (fields: Job1Stundeneintrag['fields']) => {
          await LivingAppsService.createJob1StundeneintragEntry(fields);
          setCreatedJob1Fields(fields);
          setJob1DialogOpen(false);
        }}
        defaultValues={selectedDate ? { job1_datum: selectedDate } : undefined}
      />

      <Job2StundeneintragDialog
        open={job2DialogOpen}
        onClose={() => setJob2DialogOpen(false)}
        onSubmit={async (fields: Job2Stundeneintrag['fields']) => {
          await LivingAppsService.createJob2StundeneintragEntry(fields);
          setCreatedJob2Fields(fields);
          setJob2DialogOpen(false);
        }}
        defaultValues={selectedDate ? { job2_datum: selectedDate } : undefined}
      />
    </>
  );
}
