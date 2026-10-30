'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, ImagePlus, Save, Scale, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, mediaUrl, uploadFile } from '@/lib/api';
import { refresh, useMeta, useSettings } from '@/lib/hooks';
import type { Settings } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Field, Input, PageLoader, Select, Textarea } from '@/components/ui';
import { CURRENCIES, TabIntro } from './shared';

export function BusinessTab() {
  const { data: settings, isLoading } = useSettings();
  const { data: meta } = useMeta();
  const [biz, setBiz] = useState<Settings['business'] | null>(null);
  const [defaults, setDefaults] = useState<Settings['defaults']>({});
  const [region, setRegion] = useState('AU-WA');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setBiz({ ...settings.business });
      setDefaults({ ...settings.defaults });
      setRegion(settings.region || 'AU-WA');
    }
  }, [settings]);

  if (isLoading || !biz) return <PageLoader />;
  const rule = meta?.legalRules.find((r) => r.code === region);
  const setB = (k: keyof Settings['business'], v: any) => setBiz((b) => (b ? { ...b, [k]: v } : b));
  const setD = (k: keyof Settings['defaults'], v: any) => setDefaults((d) => ({ ...d, [k]: v }));
  const numOrUndef = (v: string) => (v === '' ? undefined : Number(v));

  const save = async () => {
    if (!biz.name?.trim()) return toast.error('Business name is required');
    const tax = Number(biz.taxRate);
    if (!(tax >= 0 && tax <= 100)) return toast.error('Tax must be between 0 and 100%');
    setSaving(true);
    try {
      await api.patch('/settings', { business: { ...biz, taxRate: tax }, defaults, region });
      await refresh('/settings');
      toast.success('Business profile saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file');
    setUploading(true);
    try {
      const up = await uploadFile(file, { category: 'brand' });
      setB('logoUrl', up._id);
      toast.success('Logo uploaded — save to apply');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };
  const logoId = biz.logoUrl ? biz.logoUrl.replace(/^\/api\/media\//, '') : '';

  return (
    <div>
      <TabIntro
        title="Business profile"
        text="Your identity and defaults on customer-facing proposals, invoices and receipts. Changing defaults never rewrites issued invoices."
        actions={
          <Button icon={Save} loading={saving} onClick={save}>
            Save changes
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader icon={Building2} title="Business details" subtitle="Shown in proposals, invoices and receipts." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Business name" required>
                <Input value={biz.name || ''} onChange={(e) => setB('name', e.target.value)} />
              </Field>
              <Field label="Business email">
                <Input type="email" value={biz.email || ''} onChange={(e) => setB('email', e.target.value)} />
              </Field>
              <Field label="Contact phone">
                <Input value={biz.phone || ''} onChange={(e) => setB('phone', e.target.value)} />
              </Field>
              <Field label="Website">
                <Input value={biz.website || ''} onChange={(e) => setB('website', e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Business address" className="sm:col-span-2">
                <Input value={biz.address || ''} onChange={(e) => setB('address', e.target.value)} />
              </Field>
              <Field label="ABN / GST / tax ID">
                <Input value={biz.abn || ''} onChange={(e) => setB('abn', e.target.value)} />
              </Field>
              <Field label="Currency">
                <Select value={biz.currency || 'AUD'} onChange={(e) => setB('currency', e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Default tax (%)">
                <Input type="number" min={0} max={100} step="0.1" value={biz.taxRate ?? ''} onChange={(e) => setB('taxRate', e.target.value)} />
              </Field>
              <Field label="Tax label">
                <Input value={biz.taxLabel || ''} onChange={(e) => setB('taxLabel', e.target.value)} placeholder="GST" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Pricing & job defaults" subtitle="Used by the Smart Advisor, proposals and invoices." />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Labour cost ($/h)" hint="What an installer hour costs you">
                <Input type="number" min={0} value={defaults.labourRate ?? ''} onChange={(e) => setD('labourRate', numOrUndef(e.target.value))} />
              </Field>
              <Field label="Charge-out ($/h)" hint="What you bill per labour hour">
                <Input type="number" min={0} value={defaults.chargeOutRate ?? ''} onChange={(e) => setD('chargeOutRate', numOrUndef(e.target.value))} />
              </Field>
              <Field label="Electricity ($/kWh)" hint="For energy-saving estimates">
                <Input type="number" min={0} step="0.01" value={defaults.electricityRate ?? ''} onChange={(e) => setD('electricityRate', numOrUndef(e.target.value))} />
              </Field>
              <Field label="Cut trim (mm/edge)">
                <Input type="number" min={0} max={100} value={defaults.trimMm ?? ''} onChange={(e) => setD('trimMm', numOrUndef(e.target.value))} />
              </Field>
              <Field label="Proposal validity (days)">
                <Input type="number" min={1} value={defaults.validDays ?? ''} onChange={(e) => setD('validDays', numOrUndef(e.target.value))} />
              </Field>
              <Field label="Default deposit (%)">
                <Input type="number" min={0} max={100} value={defaults.depositPercent ?? ''} onChange={(e) => setD('depositPercent', numOrUndef(e.target.value))} />
              </Field>
              <Field label="Invoice due (days)">
                <Input type="number" min={0} value={defaults.invoiceDueDays ?? ''} onChange={(e) => setD('invoiceDueDays', numOrUndef(e.target.value))} />
              </Field>
              <Field label="Default terms" className="sm:col-span-2 lg:col-span-4">
                <Textarea rows={3} value={defaults.terms || ''} onChange={(e) => setD('terms', e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={ImagePlus} title="Brand mark" subtitle="Appears on customer review pages and documents." />
            <div className="p-5">
              <div className="grid h-36 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-muted/40">
                {logoId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(logoId)} alt="Business logo" className="max-h-28 max-w-[80%] object-contain" />
                ) : (
                  <p className="text-sm text-muted-fg">No logo uploaded</p>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" icon={ImagePlus} loading={uploading} onClick={() => fileRef.current?.click()}>
                  Upload logo
                </Button>
                {logoId ? (
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setB('logoUrl', '')}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader icon={Scale} title="Legal tint region" subtitle="Drives VLT compliance in the Visualizer and Advisor." />
            <div className="space-y-3 p-5">
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                {(meta?.legalRules || []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
              {rule ? (
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Front sides', rule.frontSideMin],
                      ['Rear sides', rule.rearSideMin],
                      ['Rear screen', rule.rearWindscreenMin],
                    ].map(([l, v]) => (
                      <div key={l as string} className="rounded-lg bg-card p-2">
                        <p className="font-display text-lg font-extrabold">{v as number}%</p>
                        <p className="text-[11px] text-muted-fg">{l as string} min VLT</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-fg">
                    <Badge tone="info">Windscreen</Badge> {rule.windscreen}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-fg">
                    Tolerance ±{rule.tolerance}% · {rule.notes}
                  </p>
                </div>
              ) : null}
              <p className="text-[11px] text-muted-fg">Guidance only — always confirm current limits with your local road authority.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
