'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info, Lock, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useSettings, useStores } from '@/lib/hooks';
import { uid } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, PageLoader, SearchInput, Switch, Textarea, cn, useConfirm } from '@/components/ui';
import { MultiToggle, TabIntro } from './shared';

type Perm = { read: boolean; write: boolean; delete: boolean };
type Role = { key: string; name: string; description?: string; protected?: boolean; permissions: Record<string, Perm> | string; stores?: string[] };

export const FEATURES = [
  { key: 'dashboard', label: 'Dashboard & reports' },
  { key: 'projects', label: 'Projects & pipeline' },
  { key: 'customers', label: 'Customers' },
  { key: 'calendar', label: 'Planning & calendar' },
  { key: 'jobs', label: 'Installer & job execution' },
  { key: 'measurements', label: 'Measurements' },
  { key: 'shop', label: 'Auto shop day & dealers' },
  { key: 'studio', label: '3D visualizer & advisor' },
  { key: 'proposals', label: 'Proposals & service pricing' },
  { key: 'payments', label: 'Invoices & payments' },
  { key: 'inventory', label: 'Film inventory' },
  { key: 'files', label: 'Documents & photos' },
  { key: 'notes', label: 'Notes & tasks' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'leadforms', label: 'Lead forms' },
  { key: 'automations', label: 'Automations' },
  { key: 'settings', label: 'Business, stores & roles' },
];

function expand(p: Role['permissions']): Record<string, Perm> {
  if (p && typeof p === 'object') {
    const saved = p as Record<string, Partial<Perm> | undefined>;
    return Object.fromEntries(FEATURES.map((f) => [f.key, { read: !!saved[f.key]?.read, write: !!saved[f.key]?.write, delete: !!saved[f.key]?.delete }]));
  }
  const all = (read: boolean, write: boolean, del: boolean) => ({ read, write, delete: del });
  return Object.fromEntries(
    FEATURES.map((f) => {
      if (p === 'full') return [f.key, all(true, true, true)];
      if (p === 'standard') return [f.key, f.key === 'settings' ? all(true, false, false) : all(true, true, false)];
      // restricted (installer): no finances
      if (['jobs', 'measurements', 'files', 'notes'].includes(f.key)) return [f.key, all(true, true, false)];
      if (['calendar', 'projects', 'shop', 'studio'].includes(f.key)) return [f.key, all(true, false, false)];
      return [f.key, all(false, false, false)];
    }),
  );
}

export function RolesTab() {
  const { data: settings, isLoading } = useSettings();
  const { data: stores } = useStores();
  const [roles, setRoles] = useState<Role[]>([]);
  const [sel, setSel] = useState('');
  const [q, setQ] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    if (settings?.roles) {
      const list = (settings.roles as Role[]).map((r) => ({ ...r, permissions: expand(r.permissions), stores: r.stores || [] }));
      setRoles(list);
      setSel((s) => s || list[0]?.key || '');
      setDirty(false);
    }
  }, [settings]);

  const role = roles.find((r) => r.key === sel);
  const perms = (role?.permissions || {}) as Record<string, Perm>;
  const update = (patch: Partial<Role>) => {
    setRoles((rs) => rs.map((r) => (r.key === sel ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const setPerm = (feature: string, kind: keyof Perm, v: boolean) => {
    const cur = perms[feature] || { read: false, write: false, delete: false };
    let next: Perm = { ...cur, [kind]: v };
    if (kind === 'read' && !v) next = { read: false, write: false, delete: false };
    if ((kind === 'write' || kind === 'delete') && v) next.read = true;
    update({ permissions: { ...perms, [feature]: next } });
  };
  const features = useMemo(() => FEATURES.filter((f) => !q || f.label.toLowerCase().includes(q.toLowerCase())), [q]);

  const add = async () => {
    if (dirty && !(await confirm({ title: 'Discard unsaved role changes and create another role?', confirmLabel: 'Continue' }))) return;
    const key = `role_${uid().slice(0, 6)}`;
    setRoles((rs) => [...rs, { key, name: 'Untitled role', description: '', permissions: expand('restricted'), stores: [] }]);
    setSel(key);
    setDirty(true);
  };
  const remove = async () => {
    if (!role || role.protected) return;
    if (!(await confirm({ title: `Delete role “${role.name}”?`, danger: true, confirmLabel: 'Delete role' }))) return;
    setRoles((rs) => rs.filter((r) => r.key !== role.key));
    setSel(roles[0]?.key || '');
    setDirty(true);
  };
  const save = async () => {
    for (const r of roles) {
      if (!r.name.trim()) return toast.error('Give this role a name before saving.');
      const p = r.permissions as Record<string, Perm>;
      if (!r.protected && !Object.values(p).some((x) => x.read)) return toast.error(`“${r.name}”: select at least one Read permission.`);
    }
    const names = roles.map((r) => r.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return toast.error('Role names must be unique.');
    setSaving(true);
    try {
      await api.patch('/settings', { roles });
      await refresh('/settings');
      setDirty(false);
      toast.success('Role changes saved.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <PageLoader />;
  return (
    <div>
      <TabIntro
        title="Roles & access"
        text="Shape what each team role is responsible for across your stores. Start with least privilege — Read is the foundation; Write and Delete always include Read."
        actions={
          <>
            {dirty ? <Badge tone="warning" dot>Unsaved changes</Badge> : <Badge tone="success" dot>All changes saved</Badge>}
            <Button variant="outline" icon={Plus} onClick={add}>
              Add role
            </Button>
            <Button icon={Save} loading={saving} disabled={!dirty} onClick={save}>
              Save changes
            </Button>
          </>
        }
      />
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-info/30 bg-info/5 p-3 text-sm text-info">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Only the workspace administrator signs in to TotalOps. Roles document what each team member is allowed to do and are used when assigning responsibilities — they do not create logins.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-2">
          {roles.map((r) => (
            <button key={r.key} type="button" onClick={() => setSel(r.key)} className={cn('mb-1 flex w-full items-start gap-2.5 rounded-xl p-3 text-left transition', sel === r.key ? 'bg-primary/10 ring-1 ring-primary/25' : 'hover:bg-muted')}>
              <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', r.protected ? 'bg-amber-500/15 text-amber-600' : 'bg-primary/10 text-primary')}>
                {r.protected ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{r.name || 'Untitled role'}</span>
                <span className="line-clamp-2 text-xs text-muted-fg">{r.description || 'No description yet'}</span>
              </span>
            </button>
          ))}
        </Card>
        {!role ? (
          <Card>
            <EmptyState icon={ShieldCheck} title="Select a role" />
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-fg">01 / Identity</p>
                {role.protected ? (
                  <Badge tone="accent">
                    <Lock className="h-3 w-3" /> Protected system role
                  </Badge>
                ) : (
                  <Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={remove}>
                    Delete
                  </Button>
                )}
              </div>
              {role.protected ? <p className="mb-3 text-sm text-muted-fg">Protected recovery access. Owner permissions cannot be edited or deleted.</p> : null}
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Role name">
                  <Input value={role.name} disabled={role.protected} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Front desk" />
                </Field>
                <Field label="Description">
                  <Textarea rows={2} value={role.description || ''} disabled={role.protected} onChange={(e) => update({ description: e.target.value })} placeholder="What is this role responsible for?" />
                </Field>
              </div>
            </Card>
            <Card className="p-5">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-fg">02 / Store scope</p>
              <p className="mb-3 text-sm text-muted-fg">Members can only work on records in the stores below. None selected = all stores.</p>
              <MultiToggle options={(stores || []).map((s) => ({ key: s._id, label: s.name }))} value={role.stores || []} onChange={(v) => !role.protected && update({ stores: v })} />
            </Card>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-fg">03 / Feature matrix</p>
                  <p className="text-sm text-muted-fg">Each action is independent. Turning off Read also removes Write and Delete.</p>
                </div>
                <SearchInput value={q} onChange={setQ} placeholder="Search features" className="w-56" />
              </div>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th className="text-center">Read</th>
                      <th className="text-center">Write</th>
                      <th className="text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f) => {
                      const p = perms[f.key] || { read: false, write: false, delete: false };
                      return (
                        <tr key={f.key}>
                          <td className="font-medium">{f.label}</td>
                          {(['read', 'write', 'delete'] as const).map((k) => (
                            <td key={k} className="text-center">
                              <div className="inline-flex">
                                <Switch size="sm" checked={p[k]} disabled={role.protected} onChange={(v) => setPerm(f.key, k, v)} />
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {!features.length ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-sm text-muted-fg">
                          No features match “{q}”. Try another search.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
