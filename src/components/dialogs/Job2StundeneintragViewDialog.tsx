import type { Job2Stundeneintrag } from '@/types/app';
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

interface Job2StundeneintragViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Job2Stundeneintrag | null;
  onEdit: (record: Job2Stundeneintrag) => void;
}

export function Job2StundeneintragViewDialog({ open, onClose, record, onEdit }: Job2StundeneintragViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Job 2 Stundeneintrag anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Arbeitgeber / Jobbezeichnung</Label>
            <p className="text-sm">{record.fields.job2_arbeitgeber ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum</Label>
            <p className="text-sm">{formatDate(record.fields.job2_datum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Startzeit</Label>
            <p className="text-sm">{record.fields.job2_startzeit ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Endzeit</Label>
            <p className="text-sm">{record.fields.job2_endzeit ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Pausendauer (in Minuten)</Label>
            <p className="text-sm">{record.fields.job2_pause ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tatsächliche Arbeitsstunden</Label>
            <p className="text-sm">{record.fields.job2_arbeitsstunden ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Stundenlohn (€)</Label>
            <p className="text-sm">{record.fields.job2_stundenlohn ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notizen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.job2_notizen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}