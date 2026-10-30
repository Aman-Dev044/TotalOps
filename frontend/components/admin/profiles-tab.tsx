'use client';

import { useEffect, useState } from 'react';
import { Ruler, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useSettings } from '@/lib/hooks';
import type { Settings } from '@/lib/types';
import { SegmentBadge } from '@/components/badges';
import { Button, Card, Checkbox, Field, Input, PageLoader, Select, Switch } from '@/components/ui';
import { TabIntro } from './shared';

type Profile = Settings['measurementProfiles'][string];
const SECTIONS = [
  { key: 'dimensions', label: 'Dimensions & quantity' },
  { key: 'glazing', label: 'Glazing' },
  { key: 'exposure', label: 'Exposure / orientation' },
  { key: 'access', label: 'Access & height' },
  { key: 'film', label: 'Film selection' },
  { key: 'removal', label: 'Removal checklist' },
  { key: 'photos', label: 'Photos & notes' },
  { key: 'cut', label: 'Cut preview' },
];
const DEFAULTS: Record<string, Profile> = {
  automotive: { title: 'Vehicle coverage', groupLabel: 'Area', unit: 'mm', dimensions: true, sections: ['dimensions', 'film', 'removal', 'photos', 'cut'] },
  residential: { title: 'Home glass survey', groupLabel: 'Room', unit: 'mm', dimensions: true, sections: ['dimensions', 'glazing', 'exposure', 'film', 'photos', 'cut'] },
  commercial: { title: 'Building glazing survey', groupLabel: 'Level / zone', unit: 'mm', dimensions: true, sections: ['dimensions', 'glazing', 'exposure', 'access', 'film', 'photos', 'cut'] },
};

export function ProfilesTab() {
  const { data: settings, isLoading } = useSettings();
  const [profiles, setProfiles] = useState<Record<string, Profile>>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.measurementProfiles) setProfiles({ ...DEFAULTS, ...settings.measurementProfiles });
  }, [settings]);

  const set = (seg: string, patch: Partial<Profile>) =>
    setProfiles((p) => {
      const next = { ...p[seg], ...patch };
      if (!next.dimensions) next.sections = next.sections.filter((s) => s !== 'cut');
      return { ...p, [seg]: next };
    });

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/settings', { measurementProfiles: profiles });
      await refresh('/settings');
      toast.success('Changes saved for future measurement sheets.');
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
        title="Measurement profiles"
        text="Choose the sections, units and row templates shown for each type of work. Existing project measurements are never rewritten when a section is hidden."
        actions={
          <Button icon={Save} loading={saving} onClick={save}>
            Save profiles
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        {(['automotive', 'residential', 'commercial'] as const).map((seg) => {
          const p = profiles[seg];
          return (
            <Card key={seg} className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <SegmentBadge segment={seg} />
                <Button size="xs" variant="ghost" icon={RotateCcw} onClick={() => setProfiles((x) => ({ ...x, [seg]: DEFAULTS[seg] }))}>
                  Reset profile
                </Button>
              </div>
              <div className="space-y-3">
                <Field label="Survey title">
                  <Input value={p.title} onChange={(e) => set(seg, { title: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Group field label">
                    <Input value={p.groupLabel} onChange={(e) => set(seg, { groupLabel: e.target.value })} />
                  </Field>
                  <Field label="Default row unit">
                    <Select value={p.unit} onChange={(e) => set(seg, { unit: e.target.value })}>
                      {['mm', 'cm', 'm', 'in', 'ft'].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Switch checked={p.dimensions} onChange={(v) => set(seg, { dimensions: v })} label={p.dimensions ? 'Dimensions on' : 'Dimensions optional'} />
                <div>
                  <p className="label">Visible sections</p>
                  <div className="grid gap-1.5">
                    {SECTIONS.map((s) => {
                      const disabled = s.key === 'cut' && !p.dimensions;
                      return (
                        <div key={s.key} className={disabled ? 'opacity-50' : ''} title={disabled ? 'Cut preview is unavailable until Dimensions & quantity is enabled.' : undefined}>
                          <Checkbox
                            checked={p.sections.includes(s.key)}
                            onChange={(v) => !disabled && set(seg, { sections: v ? [...p.sections, s.key] : p.sections.filter((x) => x !== s.key) })}
                            label={s.label}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-fg">
                  <Ruler className="h-3 w-3" /> Hide a section without deleting its existing values.
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
