'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import type { OfferOption, Project } from '@/lib/types';
import { Badge, Button, Field, Input, Modal, cn } from '@/components/ui';

export function optionTotal(o: OfferOption, taxRate = 0) {
  const subtotal = (o.lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const discount = Math.min(subtotal, Math.max(0, Number(o.discount) || 0));
  return (subtotal - discount) * (1 + (Number(taxRate) || 0) / 100);
}

/** Records a simulated customer approval from inside the CRM (proposal.approve). */
export function ApprovalModal({ project, open, onClose, onDone }: { project: Project | null; open: boolean; onClose: () => void; onDone?: (p: Project) => void }) {
  const options = project?.proposal?.options || [];
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setName(project.contact?.name || '');
    setSelected(project.totals?.proposal?.selected || []);
  }, [open, project]);

  const groups = useMemo(() => {
    const map = new Map<string, OfferOption[]>();
    for (const o of options) {
      const g = (o.group || '').trim();
      map.set(g, [...(map.get(g) || []), o]);
    }
    return Array.from(map.entries());
  }, [options]);

  const total = options.filter((o) => selected.includes(o.id)).reduce((s, o) => s + optionTotal(o, project?.proposal?.taxRate), 0);

  const toggle = (o: OfferOption) => {
    const g = (o.group || '').trim();
    setSelected((cur) => {
      if (!g) return cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id];
      const others = options.filter((x) => (x.group || '').trim() === g).map((x) => x.id);
      return [...cur.filter((x) => !others.includes(x)), o.id];
    });
  };

  const submit = async () => {
    if (!project) return;
    if (!name.trim()) return toast.error('Confirm the customer’s typed name before moving this proposal to Approved.');
    if (!selected.length) return toast.error('Choose at least one offer option.');
    setBusy(true);
    try {
      const p = await api.action<Project>(project._id, 'proposal.approve', { name: name.trim(), optionIds: selected });
      toast.success('Simulated approval recorded');
      onDone?.(p);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={PenLine}
      title="Record simulated approval"
      description={project ? `${project.number} · ${project.title}` : undefined}
      footer={
        <>
          <span className="mr-auto text-sm text-muted-fg">
            Total <span className="font-display text-base font-bold text-fg">{money(total)}</span>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="success" icon={CheckCircle2} loading={busy} onClick={submit}>
            Record approval
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Customer signature name" hint="The contact name is supplied as a convenience and may be edited." required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer full name" />
        </Field>
        <div>
          <p className="label">Customer choices</p>
          <div className="space-y-3">
            {groups.map(([g, list]) => (
              <div key={g || '_additive'} className="rounded-xl border border-line p-3">
                <p className="mb-2 text-xs font-semibold text-muted-fg">{g ? `Pick one · ${g}` : 'Independent options'}</p>
                <div className="space-y-2">
                  {list.map((o) => {
                    const on = selected.includes(o.id);
                    return (
                      <button
                        type="button"
                        key={o.id}
                        onClick={() => toggle(o)}
                        className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition', on ? 'border-primary/50 bg-primary/5' : 'border-line hover:bg-muted')}
                      >
                        {g ? (
                          <span className={cn('grid h-4 w-4 place-items-center rounded-full border-2', on ? 'border-primary' : 'border-muted-fg/40')}>{on ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}</span>
                        ) : (
                          <span className={cn('grid h-4 w-4 place-items-center rounded border-2 text-[10px] font-bold text-white', on ? 'border-primary bg-primary' : 'border-muted-fg/40')}>{on ? '✓' : null}</span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{o.title}</span>
                          {o.filmLabel ? <span className="text-xs text-muted-fg">{o.filmLabel}</span> : null}
                        </span>
                        {o.recommended ? <Badge tone="primary">Recommended</Badge> : null}
                        <span className="text-sm font-semibold">{money(optionTotal(o, project?.proposal?.taxRate))}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-fg">This records the customer’s choices only. No legal signature, charge or booking is submitted.</p>
      </div>
    </Modal>
  );
}
