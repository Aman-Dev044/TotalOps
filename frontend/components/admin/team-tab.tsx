'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Star, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useStaff, useStores } from '@/lib/hooks';
import type { Staff } from '@/lib/types';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, SearchInput, Select, Switch, useConfirm } from '@/components/ui';
import { ChipsInput, ColorInput, TabIntro } from './shared';

const ROLES = [
  { key: 'installer', label: 'Installer' },
  { key: 'sales', label: 'Sales consultant' },
  { key: 'manager', label: 'Store manager' },
  { key: 'office', label: 'Office / admin' },
];
const EMPTY: Partial<Staff> = { name: '', role: 'installer', title: '', phone: '', email: '', skills: [], color: '#0ea5e9', hoursPerWeek: 38, rating: 4.8, active: true };

export function TeamTab() {
  const { data: staff, isLoading } = useStaff();
  const { data: stores } = useStores();
  const [q, setQ] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [edit, setEdit] = useState<Partial<Staff> | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (staff || []).filter((t) => (!storeFilter || t.storeId === storeFilter) && (!s || [t.name, t.title, t.role, ...(t.skills || [])].join(' ').toLowerCase().includes(s)));
  }, [staff, q, storeFilter]);

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Name is required');
    if (!edit.storeId) return toast.error('Choose a home store');
    setSaving(true);
    try {
      const body = { ...edit, hoursPerWeek: Number(edit.hoursPerWeek) || 0, rating: Math.min(5, Math.max(0, Number(edit.rating) || 0)) };
      if (edit._id) await api.patch(`/staff/${edit._id}`, body);
      else await api.post('/staff', body);
      await refresh('/staff');
      toast.success('Team member saved');
      setEdit(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Staff) => {
    if (!(await confirm({ title: `Remove ${t.name}?`, description: 'Members with appointments must be marked inactive instead.', danger: true, confirmLabel: 'Remove' }))) return;
    try {
      await api.del(`/staff/${t._id}`);
      await refresh('/staff');
      toast.success('Team member removed');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (isLoading) return <PageLoader />;
  const storeName = (id?: string) => stores?.find((s) => s._id === id)?.name || '—';
  return (
    <div>
      <TabIntro
        title="Team members"
        text="Installers, sales and office staff. They don't sign in — only the administrator does — but they are assigned to jobs, bays and reports."
        actions={
          <Button icon={Plus} onClick={() => setEdit({ ...EMPTY, storeId: stores?.[0]?._id })}>
            Add member
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search team…" className="w-full sm:w-72" />
        <Select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="w-full sm:w-48">
          <option value="">All stores</option>
          {(stores || []).map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <Card className="overflow-x-auto">
        {!list.length ? (
          <EmptyState icon={Users} title="No team members match" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Home store</th>
                <th>Skills</th>
                <th>Hours</th>
                <th>Rating</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t._id} className={t.active ? '' : 'opacity-55'}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={t.name} color={t.color} size={34} />
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-fg">{t.title || t.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={t.role === 'installer' ? 'primary' : t.role === 'manager' ? 'accent' : 'info'}>{ROLES.find((r) => r.key === t.role)?.label || t.role}</Badge>
                    {!t.active ? <Badge className="ml-1">Inactive</Badge> : null}
                  </td>
                  <td>{storeName(t.storeId)}</td>
                  <td>
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {(t.skills || []).slice(0, 3).map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td>{t.hoursPerWeek}h</td>
                  <td>
                    <span className="flex items-center gap-1 font-semibold">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {t.rating?.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-right">
                    <Button size="icon" variant="ghost" aria-label="Edit member" onClick={() => setEdit({ ...t })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Remove member" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?._id ? 'Edit team member' : 'New team member'}
        icon={Users}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save member
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Job title">
              <Input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Senior Automotive Lead" />
            </Field>
            <Field label="Role">
              <Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Home store" required>
              <Select value={edit.storeId || ''} onChange={(e) => setEdit({ ...edit, storeId: e.target.value })}>
                <option value="">Choose…</option>
                {(stores || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Phone">
              <Input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="Hours per week" hint="Capacity used for workload planning">
              <Input type="number" min={0} max={80} value={edit.hoursPerWeek ?? 38} onChange={(e) => setEdit({ ...edit, hoursPerWeek: e.target.value as any })} />
            </Field>
            <Field label="Quality rating (0–5)">
              <Input type="number" min={0} max={5} step="0.1" value={edit.rating ?? 4.8} onChange={(e) => setEdit({ ...edit, rating: e.target.value as any })} />
            </Field>
            <Field label="Calendar colour">
              <ColorInput value={edit.color || '#0ea5e9'} onChange={(v) => setEdit({ ...edit, color: v })} />
            </Field>
            <div className="flex items-end pb-2">
              <Switch checked={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label="Active — available for bookings" />
            </div>
            <Field label="Skills & certifications" className="sm:col-span-2">
              <ChipsInput value={edit.skills || []} onChange={(v) => setEdit({ ...edit, skills: v })} placeholder="Ceramic IR, Boom lift certified…" />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
