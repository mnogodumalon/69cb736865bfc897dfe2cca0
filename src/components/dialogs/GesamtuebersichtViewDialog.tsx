import type { Gesamtuebersicht, Job1Stundeneintrag, Job2Stundeneintrag } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface GesamtuebersichtViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Gesamtuebersicht | null;
  onEdit: (record: Gesamtuebersicht) => void;
  job_1_stundeneintragList: Job1Stundeneintrag[];
  job_2_stundeneintragList: Job2Stundeneintrag[];
}

export function GesamtuebersichtViewDialog({ open, onClose, record, onEdit, job_1_stundeneintragList, job_2_stundeneintragList }: GesamtuebersichtViewDialogProps) {
  function getJob1StundeneintragDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return job_1_stundeneintragList.find(r => r.record_id === id)?.fields.job1_arbeitgeber ?? '—';
  }

  function getJob2StundeneintragDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return job_2_stundeneintragList.find(r => r.record_id === id)?.fields.job2_arbeitgeber ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gesamtübersicht anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gesamtstunden (manuell)</Label>
            <p className="text-sm">{record.fields.gesamt_stunden ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gesamtverdienst (€, manuell)</Label>
            <p className="text-sm">{record.fields.gesamt_verdienst ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notizen zur Auswertung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.auswertung_notizen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auswertungszeitraum von</Label>
            <p className="text-sm">{formatDate(record.fields.auswertung_von)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auswertungszeitraum bis</Label>
            <p className="text-sm">{formatDate(record.fields.auswertung_bis)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Einträge Job 1</Label>
            <p className="text-sm">{getJob1StundeneintragDisplayName(record.fields.job1_eintraege)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Einträge Job 2</Label>
            <p className="text-sm">{getJob2StundeneintragDisplayName(record.fields.job2_eintraege)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}