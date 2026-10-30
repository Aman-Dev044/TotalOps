'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { NAV } from './nav';
import { Logo } from '../logo';
import { Avatar, cn } from '../ui';
import { useAuth } from '../providers';

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { admin, logout } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center border-b border-line', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo collapsed={collapsed} />
        </Link>
        {onToggle && !collapsed ? (
          <button type="button" onClick={onToggle} aria-label="Collapse navigation" className="rounded-lg p-1.5 text-muted-fg hover:bg-muted hover:text-fg">
            <ChevronsLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {NAV.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed ? <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-fg/80">{group.label}</p> : <div className="mx-3 my-2 h-px bg-line" />}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn('group relative mb-0.5 flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors', active ? 'text-primary' : 'text-muted-fg hover:bg-muted hover:text-fg', collapsed && 'justify-center')}
                >
                  {active ? <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-primary/20" transition={{ type: 'spring', stiffness: 500, damping: 40 }} /> : null}
                  <Icon className={cn('relative h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110', active && 'text-primary')} />
                  {!collapsed ? <span className="relative flex-1 truncate">{item.label}</span> : null}
                  {!collapsed && item.badge ? <span className="relative rounded-md bg-gradient-to-r from-primary to-fuchsia-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{item.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-2.5">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            {onToggle ? (
              <button type="button" onClick={onToggle} aria-label="Expand navigation" className="rounded-lg p-2 text-muted-fg hover:bg-muted">
                <ChevronsRight className="h-4 w-4" />
              </button>
            ) : null}
            <button type="button" onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-muted-fg hover:bg-muted hover:text-danger">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-muted">
            <Avatar name={admin?.name} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{admin?.name || 'Administrator'}</p>
              <p className="truncate text-xs text-muted-fg">Workspace administrator</p>
            </div>
            <button type="button" onClick={logout} aria-label="Sign out" title="Sign out" className="rounded-lg p-1.5 text-muted-fg hover:bg-card hover:text-danger">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
