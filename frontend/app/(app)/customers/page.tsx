'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Briefcase, Contact as ContactIcon, Download, FileUp, Mail, MapPin, MoreHorizontal, Pencil, Phone, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, downloadFrom, errorMessage } from '@/lib/api';
import { refresh, useApi, useDebounced, useMeta, useStores } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { money, timeAgo } from '@/lib/format';
import type { Contact, Project } from '@/lib/types';
import { SegmentBadge, StageBadge } from '@/components/badges';
import { Avatar, Badge, Button, Card, Drawer, EmptyState, ErrorState, Menu, MenuItem, Modal, PageHeader, PageLoader, SearchInput, Select, Skeleton, StatCard, useConfirm } from '@/components/ui';
import { ContactModal } from '@/components/customers/contact-modal';
import { csvToObjects } from '@/components/customers/csv';

const STATUS_TONE = { prospect: 'info', active: 'success', inactive: 'neutral' } as const;
const STATUS_LABEL: Record<string, string> = { prospect: 'Prospect', active: 'Active customer', inactive: 'Inactive' };

export default function CustomersPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CustomersInner />
    </Suspense>
  );
}

function CustomersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { storeId } = useStoreScope();
  const { data: stores } = useStores();
  const { data: meta } = useMeta();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [status, setStatus] = useState('');
  const [segment, setSegment] = useState('');
  const [source, setSource] = useState('');
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);
  const [importRows, setImportRows] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const qs = new URLSearchParams();
  if (dq.trim()) qs.set('q', dq.trim());
  if (status) qs.set('status', status);
  if (segment) qs.set('segment', segment);
  if (source) qs.set('source', source);
  if (storeId) qs.set('storeId', storeId);
  const { data, error, isLoading, mutate } = useApi<Contact[]>(`/contacts?${qs.toString()}`);
  const { data: projects } = useApi<Project[]>('/projects?archived=all&limit=1000');

  const byContact = useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects || []) if (p.contactId) m.set(String(p.contactId), [...(m.get(String(p.contactId)) || []), p]);
    return m;
  }, [projects]);

  const openId = params.get('contact');
  const selected = useMemo(() => (data || []).find((c) => c._id === openId) || null, [data, openId]);
  const { data: fetched } = useApi<Contact>(openId && !selected ? `/contacts/${openId}` : null);
  const drawerContact = selected || fetched || null;

  useEffect(() => {
    if (params.get('new') === '1') setEditing(null);
  }, [params]);

  const setParam = (k: string, v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
  };

  const remove = async (c: Contact) => {
    const ok = await confirm({ title: `Delete ${c.name}?`, description: 'Contacts with linked projects cannot be deleted — archive the projects instead.', confirmLabel: 'Delete contact', danger: true });
    if (!ok) return;
    try {
      await api.del(`/contacts/${c._id}`);
      toast.success('Contact deleted');
      if (openId === c._id) setParam('contact', null);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('CSV files must be under 5 MB');
    const text = await file.text();
    const { records } = csvToObjects(text);
    if (!records.length) return toast.error('No rows found. The first row must contain column headers (Name, Email, Phone…).');
    setImportResult(null);
    setImportRows(records);
  };

  const runImport = async () => {
    if (!importRows) return;
    setImporting(true);
    try {
      const res = await api.post<{ created: number; skipped: number; errors: string[] }>('/import/contacts', { rows: importRows });
      setImportResult(res);
      toast.success(`${res.created} contacts imported`);
      refresh('/contacts');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const list = data || [];
  const counts = {
    total: list.length,
    active: list.filter((c) => c.status === 'active').length,
    prospects: list.filter((c) => c.status === 'prospect').length,
    value: list.reduce((t, c) => t + (byContact.get(c._id) || []).reduce((s, p) => s + (p.value || 0), 0), 0),
  };

  return (
    <div>
      <PageHeader
        icon={Users}
        eyebrow="Relationship workspace"
        title="Customers"
        subtitle="Contacts, history and linked project context."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <Button variant="outline" icon={FileUp} onClick={() => fileRef.current?.click()}>Import CSV</Button>
            <Button variant="outline" icon={Download} onClick={() => downloadFrom('/export/contacts', 'contacts.csv').catch((e) => toast.error(errorMessage(e)))}>Export</Button>
            <Button icon={UserPlus} onClick={() => setEditing(null)}>New contact</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Contacts" value={counts.total} icon={ContactIcon} />
        <StatCard index={1} label="Active customers" value={counts.active} icon={Users} tone="success" />
        <StatCard index={2} label="Prospects" value={counts.prospects} icon={UserPlus} tone="info" />
        <StatCard index={3} label="Linked project value" value={counts.value} format={(n) => money(n, { cents: false })} icon={Briefcase} tone="accent" />
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <SearchInput className="w-full sm:w-80" value={q} onChange={setQ} placeholder="Search name, company, phone, email…" />
        <Select className="h-10 w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Relationship status">
          <option value="">All statuses</option>
          <option value="prospect">Prospect</option>
          <option value="active">Active customer</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Select className="h-10 w-40" value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Segment">
          <option value="">All segments</option>
          <option value="automotive">Automotive</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
        </Select>
        <Select className="h-10 w-40" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {(meta?.sources || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3, 4, 5].map((k) => <Skeleton key={k} className="h-12" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState icon={Users} title="No customers in this view" description="Change the filters or add a new contact." action={<Button icon={Plus} onClick={() => setEditing(null)}>New contact</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[960px]">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Contact details</th>
                  <th>Segment</th>
                  <th>Relationship</th>
                  <th>Linked projects</th>
                  <th>Source</th>
                  <th>Last activity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c, k) => {
                  const ps = byContact.get(c._id) || [];
                  const last = ps.reduce((m, p) => (p.updatedAt > m ? p.updatedAt : m), c.updatedAt);
                  return (
                    <motion.tr key={c._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(k, 20) * 0.015 }} className="cursor-pointer" onClick={() => setParam('contact', c._id)}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={c.name} size={34} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{c.name}</p>
                            <p className="truncate text-xs text-muted-fg">{c.company || stores?.find((s) => s._id === c.storeId)?.name || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-sm">{c.phone || <span className="text-muted-fg">No phone</span>}</p>
                        <p className="truncate text-xs text-muted-fg">{c.email || 'No email'}</p>
                      </td>
                      <td><SegmentBadge segment={c.segment} /></td>
                      <td><Badge tone={STATUS_TONE[c.status as keyof typeof STATUS_TONE] || 'neutral'}>{STATUS_LABEL[c.status] || c.status}</Badge></td>
                      <td>{ps.length ? <span className="font-semibold">{ps.length} <span className="font-normal text-muted-fg">· {money(ps.reduce((t, p) => t + p.value, 0), { cents: false })}</span></span> : <span className="text-muted-fg">No projects</span>}</td>
                      <td className="text-sm">{c.source || '—'}</td>
                      <td className="text-sm text-muted-fg">{timeAgo(last)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Menu trigger={() => <button type="button" aria-label="Contact actions" className="rounded-lg p-1.5 text-muted-fg hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>}>
                          {(close) => (
                            <>
                              <MenuItem icon={Pencil} onClick={() => { close(); setEditing(c); }}>Edit contact</MenuItem>
                              <MenuItem icon={Plus} onClick={() => { close(); router.push(`/projects?new=1&contactId=${c._id}`); }}>New project</MenuItem>
                              <MenuItem icon={Trash2} danger onClick={() => { close(); remove(c); }}>Delete</MenuItem>
                            </>
                          )}
                        </Menu>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ContactDrawer contact={drawerContact} projects={drawerContact ? byContact.get(drawerContact._id) || [] : []} onClose={() => setParam('contact', null)} onEdit={(c) => setEditing(c)} onDelete={remove} />

      <ContactModal
        open={editing !== undefined}
        contact={editing}
        onClose={() => { setEditing(undefined); if (params.get('new')) setParam('new', null); }}
        onSaved={() => mutate()}
      />

      <Modal
        open={!!importRows}
        onClose={() => { setImportRows(null); setImportResult(null); }}
        icon={FileUp}
        title="Import contacts from CSV"
        description="Columns recognised: Name, Company, Email, Phone, Address, Segment, Source, Status, Store, Tags. Duplicates (same email or phone) are skipped."
        size="lg"
        footer={
          importResult ? (
            <Button onClick={() => { setImportRows(null); setImportResult(null); }}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setImportRows(null)}>Cancel</Button>
              <Button icon={FileUp} loading={importing} onClick={runImport}>Import {importRows?.length} rows</Button>
            </>
          )
        }
      >
        {importResult ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-success/10 p-3"><p className="text-2xl font-bold text-success">{importResult.created}</p><p className="text-xs text-muted-fg">Created</p></div>
              <div className="rounded-xl bg-muted p-3"><p className="text-2xl font-bold">{importResult.skipped}</p><p className="text-xs text-muted-fg">Duplicates skipped</p></div>
              <div className="rounded-xl bg-danger/10 p-3"><p className="text-2xl font-bold text-danger">{importResult.errors.length}</p><p className="text-xs text-muted-fg">Errors</p></div>
            </div>
            {importResult.errors.length ? <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-danger">{importResult.errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
          </div>
        ) : importRows ? (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="table-base">
              <thead><tr>{Object.keys(importRows[0] || {}).slice(0, 8).map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {importRows.slice(0, 6).map((r, k) => <tr key={k}>{Object.keys(importRows[0] || {}).slice(0, 8).map((h) => <td key={h} className="max-w-[180px] truncate text-xs">{r[h]}</td>)}</tr>)}
              </tbody>
            </table>
            {importRows.length > 6 ? <p className="px-3 py-2 text-xs text-muted-fg">…and {importRows.length - 6} more rows</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function ContactDrawer({ contact, projects, onClose, onEdit, onDelete }: { contact: Contact | null; projects: Project[]; onClose: () => void; onEdit: (c: Contact) => void; onDelete: (c: Contact) => void }) {
  const router = useRouter();
  const c = contact;
  const total = projects.reduce((t, p) => t + (p.value || 0), 0);
  const paid = projects.reduce((t, p) => t + (p.totals?.paid || 0), 0);
  return (
    <Drawer
      open={!!c}
      onClose={onClose}
      width={520}
      title={c?.name}
      subtitle={c?.company || STATUS_LABEL[c?.status || ''] || ''}
      footer={
        c ? (
          <>
            <Button variant="ghost" icon={Trash2} className="mr-auto text-danger" onClick={() => onDelete(c)}>Delete</Button>
            <Button variant="outline" icon={Pencil} onClick={() => onEdit(c)}>Edit</Button>
            <Button icon={Plus} onClick={() => router.push(`/projects?new=1&contactId=${c._id}`)}>New project</Button>
          </>
        ) : null
      }
    >
      {c ? (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar name={c.name} size={56} />
            <div className="flex flex-wrap gap-1.5">
              <SegmentBadge segment={c.segment} />
              <Badge tone={STATUS_TONE[c.status as keyof typeof STATUS_TONE] || 'neutral'}>{STATUS_LABEL[c.status] || c.status}</Badge>
              {c.tags?.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}
            </div>
          </div>
          <div className="grid gap-2">
            {c.phone ? <a href={`tel:${c.phone}`} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm hover:bg-muted"><Phone className="h-4 w-4 text-primary" />{c.phone}</a> : null}
            {c.email ? <a href={`mailto:${c.email}`} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm hover:bg-muted"><Mail className="h-4 w-4 text-primary" />{c.email}</a> : null}
            {c.address ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm hover:bg-muted"><MapPin className="h-4 w-4 text-primary" />{c.address}</a> : null}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted/60 p-3"><p className="text-lg font-bold">{projects.length}</p><p className="text-[11px] text-muted-fg">Projects</p></div>
            <div className="rounded-xl bg-muted/60 p-3"><p className="text-lg font-bold">{money(total, { cents: false })}</p><p className="text-[11px] text-muted-fg">Lifetime value</p></div>
            <div className="rounded-xl bg-muted/60 p-3"><p className="text-lg font-bold">{money(paid, { cents: false })}</p><p className="text-[11px] text-muted-fg">Paid</p></div>
          </div>
          <div>
            <p className="label">Linked projects</p>
            {projects.length === 0 ? <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-fg">No projects yet.</p> : null}
            <div className="space-y-2">
              {projects.map((p) => (
                <Link key={p._id} href={`/projects/${p._id}`} className="block rounded-xl border border-line p-3 transition hover:border-primary/40 hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <span className="text-sm font-semibold">{money(p.value, { cents: false })}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-fg">
                    <span>{p.number}</span>
                    <StageBadge stage={p.stage} />
                    {p.archived ? <Badge>Archived</Badge> : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          {c.notes ? (
            <div>
              <p className="label">Notes</p>
              <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">{c.notes}</p>
            </div>
          ) : null}
          <p className="text-xs text-muted-fg">Source: {c.source || '—'} · Added {timeAgo(c.createdAt)}</p>
        </div>
      ) : null}
    </Drawer>
  );
}
