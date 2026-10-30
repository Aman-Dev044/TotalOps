'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu as MenuIcon, Moon, Plus, Search, Store, Sun } from 'lucide-react';
import { Sidebar } from './sidebar';
import { CommandPalette } from './command-palette';
import { NotificationBell } from './notification-bell';
import { useAuth, useStoreScope, useTheme } from '../providers';
import { Button, Kbd, cn } from '../ui';
import { LogoMark } from '../logo';
import { useLocalState, useSettings, useStores } from '@/lib/hooks';
import { setCurrency } from '@/lib/format';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { admin, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useLocalState('sidebar.collapsed', false);
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  const { theme, toggle } = useTheme();
  const { storeId, setStoreId } = useStoreScope();
  const { data: stores } = useStores();
  const { data: settings } = useSettings();

  useEffect(() => {
    if (settings?.business?.currency) setCurrency(settings.business.currency);
  }, [settings?.business?.currency]);

  useEffect(() => {
    if (ready && !admin) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, admin, router, pathname]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => setMobile(false), [pathname]);

  if (!ready || !admin) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <LogoMark size={56} className="animate-floaty" />
          <p className="text-sm text-muted-fg">Loading your workspace…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-card/80 backdrop-blur-xl transition-[width] duration-300 lg:block', collapsed ? 'w-[76px]' : 'w-[264px]')}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobile ? (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobile(false)} />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 380, damping: 38 }} className="absolute inset-y-0 left-0 w-[280px] border-r border-line bg-card">
              <Sidebar collapsed={false} onNavigate={() => setMobile(false)} />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className={cn('transition-[padding] duration-300', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]')}>
        <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/75 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
            <button type="button" aria-label="Open navigation" onClick={() => setMobile(true)} className="rounded-xl p-2 text-muted-fg hover:bg-muted lg:hidden">
              <MenuIcon className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setPalette(true)} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-card px-3 text-left text-sm text-muted-fg shadow-sm transition hover:border-primary/40 sm:max-w-md">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Search projects, contacts, rego…</span>
              <span className="ml-auto hidden items-center gap-1 sm:flex">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="relative hidden md:block">
                <Store className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                <select aria-label="Switch store data" value={storeId} onChange={(e) => setStoreId(e.target.value)} className="input h-9 w-44 cursor-pointer pl-8 text-xs font-semibold">
                  <option value="">All stores</option>
                  {(stores || []).map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" aria-label="Toggle theme" onClick={toggle} className="grid h-9 w-9 place-items-center rounded-xl text-muted-fg transition hover:bg-muted hover:text-fg">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                  </motion.span>
                </AnimatePresence>
              </button>
              <NotificationBell />
              <Button size="sm" icon={Plus} onClick={() => router.push('/projects?new=1')} className="hidden sm:inline-flex">
                New lead
              </Button>
            </div>
          </div>
        </header>
        <motion.main key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }} className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </motion.main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
