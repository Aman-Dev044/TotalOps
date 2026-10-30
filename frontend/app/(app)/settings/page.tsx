'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, CarFront, Database, FileStack, MessageSquare, Package2, Ruler, Settings as SettingsIcon, ShieldCheck, Store, UserRound, Users } from 'lucide-react';
import { PageHeader, PageLoader, cn } from '@/components/ui';
import { BusinessTab } from '@/components/admin/business-tab';
import { StoresTab } from '@/components/admin/stores-tab';
import { TeamTab } from '@/components/admin/team-tab';
import { ServicesTab } from '@/components/admin/services-tab';
import { PackagesTab } from '@/components/admin/packages-tab';
import { TemplatesTab } from '@/components/admin/templates-tab';
import { DealersTab } from '@/components/admin/dealers-tab';
import { ProfilesTab } from '@/components/admin/profiles-tab';
import { RolesTab } from '@/components/admin/roles-tab';
import { AccountTab } from '@/components/admin/account-tab';
import { DataTab } from '@/components/admin/data-tab';

const TABS = [
  { key: 'business', label: 'Business profile', icon: Building2, group: 'Workspace', C: BusinessTab },
  { key: 'stores', label: 'Stores & bays', icon: Store, group: 'Workspace', C: StoresTab },
  { key: 'team', label: 'Team members', icon: Users, group: 'Workspace', C: TeamTab },
  { key: 'roles', label: 'Roles & access', icon: ShieldCheck, group: 'Workspace', C: RolesTab },
  { key: 'services', label: 'Service catalogue', icon: Package2, group: 'Libraries', C: ServicesTab },
  { key: 'packages', label: 'Proposal packages', icon: FileStack, group: 'Libraries', C: PackagesTab },
  { key: 'templates', label: 'Message templates', icon: MessageSquare, group: 'Libraries', C: TemplatesTab },
  { key: 'profiles', label: 'Measurement profiles', icon: Ruler, group: 'Libraries', C: ProfilesTab },
  { key: 'dealers', label: 'Dealers & fleets', icon: CarFront, group: 'Libraries', C: DealersTab },
  { key: 'account', label: 'Your account', icon: UserRound, group: 'System', C: AccountTab },
  { key: 'data', label: 'Data & integrations', icon: Database, group: 'System', C: DataTab },
] as const;

function SettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = TABS.find((t) => t.key === params.get('tab')) || TABS[0];
  const go = (key: string) => router.replace(`${pathname}?tab=${key}`, { scroll: false });
  const Active = tab.C;

  return (
    <div>
      <PageHeader icon={SettingsIcon} eyebrow="Administration" title="Workspace administration" subtitle="A considered workspace. Consistent defaults. The right access for every team." />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="lg:sticky lg:top-24 lg:h-fit">
          <div className="flex gap-1 overflow-x-auto pb-2 lg:block lg:overflow-visible lg:pb-0">
            {['Workspace', 'Libraries', 'System'].map((g) => (
              <div key={g} className="contents lg:mb-3 lg:block">
                <p className="hidden px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-fg lg:block">{g}</p>
                {TABS.filter((t) => t.group === g).map((t) => {
                  const on = t.key === tab.key;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => go(t.key)}
                      className={cn('relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition lg:w-full', on ? 'text-primary' : 'text-muted-fg hover:bg-muted hover:text-fg')}
                    >
                      {on ? <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-primary/20" transition={{ type: 'spring', stiffness: 500, damping: 40 }} /> : null}
                      <Icon className="relative h-4 w-4" />
                      <span className="relative whitespace-nowrap">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
        <AnimatePresence mode="wait">
          <motion.div key={tab.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="min-w-0">
            <Active />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SettingsInner />
    </Suspense>
  );
}
