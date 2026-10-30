'use client';

import { useState } from 'react';
import { Box, Cpu, Database, Download, FileSpreadsheet, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFrom, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Badge, Button, Card, CardHeader, Kbd } from '@/components/ui';
import { TabIntro } from './shared';

const EXPORTS = [
  { kind: 'projects', label: 'Projects' },
  { kind: 'contacts', label: 'Contacts' },
  { kind: 'stock', label: 'Film stock' },
  { kind: 'payments', label: 'Payments' },
  { kind: 'schedule', label: 'Schedule' },
];

export function DataTab() {
  const { data: ai } = useApi<{ vision: boolean; model3d: boolean }>('/ai/vehicle');
  const [busy, setBusy] = useState('');
  const dl = async (kind: string) => {
    setBusy(kind);
    try {
      await downloadFrom(`/export/${kind}`, `totalops-${kind}`);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <TabIntro title="Data & integrations" text="Know what is active in your workspace — and what you can switch on." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Database} title="Backup & exports" subtitle="All data lives in your MongoDB database." />
          <div className="space-y-4 p-5">
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-fuchsia-500/10 p-4">
              <p className="font-semibold">Full workspace backup</p>
              <p className="text-sm text-muted-fg">JSON snapshot of every collection (passwords are never exported).</p>
              <Button className="mt-3" icon={Download} loading={busy === 'backup'} onClick={() => dl('backup')}>
                Export backup
              </Button>
            </div>
            <div>
              <p className="label">CSV exports</p>
              <div className="flex flex-wrap gap-2">
                {EXPORTS.map((e) => (
                  <Button key={e.kind} size="sm" variant="outline" icon={FileSpreadsheet} loading={busy === e.kind} onClick={() => dl(e.kind)}>
                    {e.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <div className="space-y-5">
          <IntegrationCard
            icon={Cpu}
            title="AI photo analysis (Claude vision)"
            enabled={!!ai?.vision}
            text="Detects make, model, body type, paint colour, existing tint and window outlines from a customer photo to auto-build the 3D model."
            envKey="ANTHROPIC_API_KEY"
          />
          <IntegrationCard icon={Box} title="Photo → 3D mesh (Meshy)" enabled={!!ai?.model3d} text="Generates a real textured 3D mesh (GLB) from one photo for the visualizer." envKey="MESHY_API_KEY" />
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-fg">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  Email & SMS <Badge tone="warning">Simulation</Badge>
                </p>
                <p className="mt-1 text-sm text-muted-fg">Reminders, proposals and review requests are rendered and logged on each project, but nothing is sent to customers. Connect an SMS/email provider to go live.</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Security</p>
                <p className="mt-1 text-sm text-muted-fg">Admin-only JWT sessions (7 days), bcrypt-hashed password, login rate limiting, server-side validation on every write, private file links.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({ icon: Icon, title, text, enabled, envKey }: { icon: any; title: string; text: string; enabled: boolean; envKey: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-fg'}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {title} {enabled ? <Badge tone="success" dot>Connected</Badge> : <Badge>Not configured</Badge>}
          </p>
          <p className="mt-1 text-sm text-muted-fg">{text}</p>
          {!enabled ? (
            <p className="mt-2 text-xs text-muted-fg">
              Add <Kbd>{envKey}=…</Kbd> to <span className="font-mono">backend/.env.local</span> and restart the backend.
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
