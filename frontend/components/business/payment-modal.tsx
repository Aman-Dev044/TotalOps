'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useMeta } from '@/lib/hooks';
import { money, todayStr } from '@/lib/format';
import type { Project } from '@/lib/types';
import { Button, Field, Input, Modal, Segmented, Select } from '@/components/ui';

/** Suggested amount: invoice balance, or the outstanding deposit before invoicing. */
export function suggestedAmount(p: Project) {
  if (p.invoice) return Math.max(0, p.totals.balance);
  const dep = p.totals.proposal?.deposit || 0;
  return Math.max(0, Math.round((dep - p.totals.paid) * 100) / 100);
}

export function RecordPaymentModal({ project, open, onClose, onDone }: { project: Project | null; open: boolean; onClose: () => void; onDone?: (p: Project) => void }) {
  const { data: meta } = useMeta();
  const [kind, setKind] = useState<'payment' | 'deposit'>('payment');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Bank transfer');
  const [date, setDate] = useState(todayStr());
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setKind(project.invoice ? 'payment' : 'deposit');
    setAmount(String(suggestedAmount(project) || ''));
    setMethod('Bank transfer');
    setDate(todayStr());
    setReference('');
  }, [open, project]);

  const submit = async () => {
    if (!project) return;
    const n = Number(amount);
    if (!(n > 0)) return toast.error('Enter an amount greater than zero');
    setBusy(true);
    try {
      const p = await api.action<Project>(project._id, 'payment.add', { kind, amount: n, method, date, reference });
      toast.success(`${kind === 'deposit' ? 'Deposit' : 'Payment'} of ${money(n)} recorded. No money was charged.`);
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
      icon={Wallet}
      size="sm"
      title="Record payment"
      description={project ? `${project.number} · ${project.contact?.name || project.title}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Save payment
          </Button>
        </>
      }
    >
      {project ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3 text-center text-xs">
            <div>
              <p className="text-muted-fg">{project.invoice ? 'Invoice' : 'Quoted'}</p>
              <p className="font-display text-sm font-bold">{money(project.invoice ? project.invoice.total : project.totals.proposal?.total || 0)}</p>
            </div>
            <div>
              <p className="text-muted-fg">Paid</p>
              <p className="font-display text-sm font-bold text-success">{money(project.totals.paid)}</p>
            </div>
            <div>
              <p className="text-muted-fg">Balance</p>
              <p className="font-display text-sm font-bold text-danger">{money(project.invoice ? project.totals.balance : Math.max(0, (project.totals.proposal?.total || 0) - project.totals.paid))}</p>
            </div>
          </div>
          <Segmented
            options={[
              { key: 'payment', label: 'Payment' },
              { key: 'deposit', label: 'Deposit' },
            ]}
            value={kind}
            onChange={setKind}
          />
          {!project.invoice && kind === 'payment' ? <p className="text-xs text-warning">Create an invoice to record a payment. Deposits can be recorded before invoicing.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount" required>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Payment date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Payment method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {(meta?.paymentMethods || ['Bank transfer', 'Card · external terminal', 'Cash', 'Cheque']).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Reference / receipt">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <p className="text-xs text-muted-fg">Records an entry only. No card details or money are processed.</p>
        </div>
      ) : null}
    </Modal>
  );
}
