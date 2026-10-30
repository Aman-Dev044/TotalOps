'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Banknote, CreditCard, Download, FileText, Plus, Receipt, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFrom, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { fmtDate, money, todayStr } from '@/lib/format';
import type { Project } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, Progress, SearchInput, Segmented, StatCard, Tabs, cn } from '@/components/ui';
import { PaymentStatusBadge, SegmentBadge } from '@/components/badges';
import { RecordPaymentModal } from '@/components/business/payment-modal';

type Filter = 'all' | 'paid' | 'partial' | 'unpaid' | 'overdue' | 'deposit';

const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400_000);

export default function PaymentsPage() {
  const { storeId } = useStoreScope();
  const { data, error, isLoading, mutate } = useApi<Project[]>(`/projects${storeId ? `?storeId=${storeId}` : ''}`);
  const [tab, setTab] = useState<'bills' | 'ledger'>('bills');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [paying, setPaying] = useState<Project | null>(null);
  const [exporting, setExporting] = useState(false);
  const today = todayStr();

  const rows = useMemo(() => (data || []).filter((p) => p.invoice || (p.payments || []).length), [data]);
  const isOverdue = (p: Project) => !!p.invoice && p.totals.balance > 0.009 && p.invoice.dueDate < today;

  const stats = useMemo(() => {
    const invoiced = rows.reduce((s, p) => s + (p.invoice?.total || 0), 0);
    const collected = rows.reduce((s, p) => s + p.totals.paid, 0);
    const outstanding = rows.reduce((s, p) => s + (p.invoice ? p.totals.balance : 0), 0);
    const overdue = rows.filter(isOverdue);
    const avgDays = overdue.length ? overdue.reduce((s, p) => s + daysBetween(p.invoice!.dueDate, today), 0) / overdue.length : 0;
    return { invoiced, collected, outstanding, overdue: overdue.length, avgDays };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, today]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((p) => {
        if (filter === 'overdue') return isOverdue(p);
        if (filter === 'deposit') return !p.invoice;
        if (filter !== 'all') return p.invoice && p.totals.status === filter;
        return true;
      })
      .filter((p) => !s || [p.number, p.title, p.contact?.name, p.invoice?.number].some((x) => (x || '').toLowerCase().includes(s)))
      .sort((a, b) => (b.invoice?.issuedAt || '').localeCompare(a.invoice?.issuedAt || '') || b.updatedAt.localeCompare(a.updatedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, q]);

  const ledger = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .flatMap((p) => (p.payments || []).map((pay) => ({ ...pay, project: p })))
      .filter((x) => !s || [x.project.number, x.project.contact?.name, x.reference, x.method].some((v) => (v || '').toLowerCase().includes(s)))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [rows, q]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFrom('/export/payments', 'payments.csv');
      toast.success('Payments exported');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;

  return (
    <div>
      <PageHeader
        icon={CreditCard}
        eyebrow="Cash collection"
        title="Payments"
        subtitle="Bills, deposits and outstanding balances linked to projects."
        actions={
          <Button variant="outline" icon={Download} loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Invoiced" value={stats.invoiced} format={(n) => money(n, { cents: false })} icon={FileText} tone="primary" sub={`${rows.filter((p) => p.invoice).length} invoices`} />
        <StatCard index={1} label="Collected" value={stats.collected} format={(n) => money(n, { cents: false })} icon={Banknote} tone="success" sub="deposits + payments" />
        <StatCard index={2} label="Outstanding" value={stats.outstanding} format={(n) => money(n, { cents: false })} icon={Wallet} tone="warning" sub="balance due on invoices" />
        <StatCard index={3} label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="danger" sub={stats.overdue ? `avg ${Math.round(stats.avgDays)} days overdue` : 'nothing overdue'} onClick={() => { setTab('bills'); setFilter('overdue'); }} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          layoutId="pay-tabs"
          tabs={[
            { key: 'bills', label: 'Bills & balances', icon: Receipt, count: rows.length },
            { key: 'ledger', label: 'Payments ledger', icon: Banknote, count: ledger.length },
          ]}
          value={tab}
          onChange={setTab}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search customer, invoice, reference…" className="w-full sm:ml-auto sm:w-72" />
      </div>

      {isLoading && !data ? (
        <PageLoader />
      ) : tab === 'bills' ? (
        <>
          <div className="mb-3 overflow-x-auto">
            <Segmented
              size="sm"
              options={[
                { key: 'all', label: 'All' },
                { key: 'unpaid', label: 'Unpaid' },
                { key: 'partial', label: 'Partially paid' },
                { key: 'paid', label: 'Paid in full' },
                { key: 'overdue', label: 'Overdue' },
                { key: 'deposit', label: 'Deposit only' },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>
          {!filtered.length ? (
            <Card>
              <EmptyState icon={Receipt} title="Nothing here" description="Create an invoice from a project to record a deposit or payment." />
            </Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Customer</th>
                    <th>Issued / due</th>
                    <th className="text-right">Total</th>
                    <th className="min-w-[180px]">Paid</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const total = p.invoice ? p.invoice.total : p.totals.proposal?.total || 0;
                    const balance = p.invoice ? p.totals.balance : Math.max(0, total - p.totals.paid);
                    const overdue = isOverdue(p);
                    return (
                      <tr key={p._id}>
                        <td>
                          <Link href={`/projects/${p._id}`} className="font-semibold hover:text-primary">
                            {p.invoice?.number || 'Deposit'}
                          </Link>
                          <p className="text-xs text-muted-fg">{p.number}</p>
                        </td>
                        <td>
                          <p className="font-medium">{p.contact?.name || '—'}</p>
                          <SegmentBadge segment={p.segment} />
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {p.invoice ? (
                            <>
                              <p>{fmtDate(p.invoice.issuedAt)}</p>
                              <p className={cn(overdue ? 'font-semibold text-danger' : 'text-muted-fg')}>
                                Due {fmtDate(p.invoice.dueDate)}
                                {overdue ? ` · ${daysBetween(p.invoice.dueDate, today)}d overdue` : ''}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-fg">Not invoiced</span>
                          )}
                        </td>
                        <td className="text-right font-semibold">{money(total)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Progress value={p.totals.paid} max={total || 1} tone={balance <= 0.009 ? 'success' : overdue ? 'danger' : 'primary'} height={6} />
                            <span className="w-20 text-right text-xs font-semibold">{money(p.totals.paid, { cents: false })}</span>
                          </div>
                        </td>
                        <td className={cn('text-right font-semibold', balance > 0.009 ? 'text-danger' : 'text-success')}>{money(balance)}</td>
                        <td>
                          {overdue ? <Badge tone="danger" dot>Overdue</Badge> : <PaymentStatusBadge status={p.totals.status} />}
                        </td>
                        <td className="text-right">
                          <Button size="xs" icon={Plus} variant={balance > 0.009 ? 'primary' : 'outline'} disabled={!!p.invoice && balance <= 0.009} onClick={() => setPaying(p)}>
                            Record
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : !ledger.length ? (
        <Card>
          <EmptyState icon={Banknote} title="No payments recorded" description="Deposits and payments recorded against projects appear here." />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Customer</th>
                <th>Kind</th>
                <th>Method</th>
                <th>Reference</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((x) => (
                <tr key={x._id}>
                  <td className="whitespace-nowrap">{fmtDate(x.date)}</td>
                  <td>
                    <Link href={`/projects/${x.project._id}`} className="font-semibold hover:text-primary">
                      {x.project.number}
                    </Link>
                    {x.project.invoice ? <p className="text-xs text-muted-fg">{x.project.invoice.number}</p> : null}
                  </td>
                  <td>{x.project.contact?.name || '—'}</td>
                  <td>
                    <Badge tone={x.kind === 'deposit' ? 'info' : 'success'}>{x.kind === 'deposit' ? 'Deposit' : 'Payment'}</Badge>
                  </td>
                  <td className="text-xs">{x.method}</td>
                  <td className="text-xs text-muted-fg">{x.reference || 'No reference'}</td>
                  <td className="text-right font-semibold text-success">{money(x.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="px-3 py-3 text-right text-xs font-semibold uppercase text-muted-fg">
                  Total received
                </td>
                <td className="px-3 py-3 text-right font-display font-bold">{money(ledger.reduce((s, x) => s + x.amount, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <RecordPaymentModal project={paying} open={!!paying} onClose={() => setPaying(null)} onDone={() => mutate()} />
    </div>
  );
}
