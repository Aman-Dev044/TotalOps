'use client';

import Link from 'next/link';
import { CalendarClock, CheckCircle2, ExternalLink, LogIn, MapPin, Pencil, Phone, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh } from '@/lib/hooks';
import { fmtDate, fmtTime, minutesBetween, money, vehicleLabel } from '@/lib/format';
import type { ScheduleItem } from '@/lib/types';
import { ApptStatusBadge, SegmentBadge, ShopStatusBadge, StageBadge } from '@/components/badges';
import { Avatar, Badge, Button, Drawer, useConfirm } from '@/components/ui';
import { apptTypeLabel } from './appointment-modal';
import { useState } from 'react';

export async function runVisitAction(item: Pick<ScheduleItem, 'projectId' | '_id'>, action: 'appointment.checkin' | 'appointment.complete' | 'appointment.dispatch' | 'appointment.remove', label: string) {
  try {
    await api.action(item.projectId, action, { appointmentId: item._id });
    toast.success(label);
    refresh('/schedule', '/projects', '/dashboard');
    return true;
  } catch (err) {
    toast.error(errorMessage(err));
    return false;
  }
}

export function VisitDrawer({ item, onClose, onEdit }: { item: ScheduleItem | null; onClose: () => void; onEdit: (item: ScheduleItem) => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState('');
  const act = async (action: Parameters<typeof runVisitAction>[1], label: string) => {
    if (!item) return;
    if (action === 'appointment.remove') {
      const ok = await confirm({ title: 'Remove this booking?', description: 'Only the appointment is removed. The customer, project and invoice remain saved.', confirmLabel: 'Remove booking', danger: true });
      if (!ok) return;
    }
    setBusy(action);
    const ok = await runVisitAction(item, action, label);
    setBusy('');
    if (ok) onClose();
  };
  const i = item;
  return (
    <Drawer open={!!i} onClose={onClose} width={480} title={i ? `${apptTypeLabel(i.type)} · ${i.projectNumber}` : ''} subtitle={i ? `${fmtDate(i.date)} · ${fmtTime(i.start)}–${fmtTime(i.end)}` : ''}
      footer={
        i ? (
          <>
            <Button variant="ghost" icon={Trash2} className="mr-auto text-danger" loading={busy === 'appointment.remove'} onClick={() => act('appointment.remove', 'Booking removed')}>
              Remove
            </Button>
            <Button variant="outline" icon={Pencil} onClick={() => onEdit(i)}>
              Reschedule
            </Button>
            <Link href={`/projects/${i.projectId}`}>
              <Button icon={ExternalLink}>Open project</Button>
            </Link>
          </>
        ) : null
      }
    >
      {i ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <ApptStatusBadge status={i.status} />
            <StageBadge stage={i.stage} />
            <SegmentBadge segment={i.segment} />
            {i.segment === 'automotive' ? <ShopStatusBadge status={i.shopStatus} /> : null}
          </div>
          <div className="card p-4">
            <p className="font-display text-base font-bold">{i.projectTitle}</p>
            <p className="mt-1 text-sm text-muted-fg">{i.contact?.name}{i.contact?.company ? ` · ${i.contact.company}` : ''}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {i.contact?.phone ? (
                <a href={`tel:${i.contact.phone}`}>
                  <Button size="sm" variant="outline" icon={Phone}>{i.contact.phone}</Button>
                </a>
              ) : null}
              {i.address ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address)}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" icon={MapPin}>Map</Button>
                </a>
              ) : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Time">{fmtTime(i.start)}–{fmtTime(i.end)} ({Math.round(minutesBetween(i.start, i.end) / 6) / 10} h)</Info>
            <Info label="Store & bay">{i.store?.name || '—'}{i.bay ? ` · ${i.bay}` : ''}</Info>
            <Info label="Lead installer">
              {i.installer ? (
                <span className="flex items-center gap-2"><Avatar name={i.installer.name} color={i.installer.color} size={22} />{i.installer.name}</span>
              ) : 'Unassigned'}
            </Info>
            <Info label="Co-installers">{i.coInstallers.length ? i.coInstallers.map((c) => c.name).join(', ') : '—'}</Info>
            <Info label={i.segment === 'automotive' ? 'Vehicle' : 'Property'}>{i.segment === 'automotive' ? vehicleLabel(i.vehicle) || '—' : i.property?.type || i.address || '—'}</Info>
            <Info label="Film">{i.film ? `${i.film.brand} ${i.film.name}${i.filmShade ? ` ${i.filmShade}%` : ''}` : '—'}</Info>
            <Info label="Glass scope">{i.panes} panes</Info>
            <Info label="Project value">{money(i.value)}</Info>
            {i.dealerName ? <Info label="Dealer">{i.dealerName}</Info> : null}
            <Info label="Address">{i.address || '—'}</Info>
          </dl>
          <div>
            <p className="label">Access & handover notes</p>
            <p className="rounded-xl bg-muted/50 p-3 text-sm">{i.notes || 'No access notes yet.'}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" icon={Truck} disabled={i.status !== 'scheduled'} loading={busy === 'appointment.dispatch'} onClick={() => act('appointment.dispatch', 'Installer dispatched')}>
              Dispatch
            </Button>
            <Button variant="secondary" icon={LogIn} disabled={i.status === 'checked_in' || i.status === 'completed'} loading={busy === 'appointment.checkin'} onClick={() => act('appointment.checkin', 'Installer checked in')}>
              Check in
            </Button>
            <Button variant="success" icon={CheckCircle2} disabled={i.status !== 'checked_in'} loading={busy === 'appointment.complete'} onClick={() => act('appointment.complete', 'Visit completed')}>
              Complete
            </Button>
          </div>
          {i.status === 'scheduled' || i.status === 'dispatched' ? (
            <p className="flex items-center gap-2 text-xs text-muted-fg"><CalendarClock className="h-3.5 w-3.5" /> Check in before completing the visit.</p>
          ) : null}
          {i.priority === 'high' ? <Badge tone="danger">High priority</Badge> : null}
        </div>
      ) : null}
    </Drawer>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-fg">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}
