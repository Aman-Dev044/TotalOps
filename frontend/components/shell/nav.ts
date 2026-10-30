import {
  Bell, Boxes, Briefcase, CalendarDays, CarFront, ClipboardList, Contact, CreditCard, FileText, FolderOpen, Gauge, KanbanSquare, Layers, LayoutDashboard,
  Megaphone, Settings, Sparkles, Star, SunMedium, Users, Wand2, Workflow, type LucideIcon, BarChart3, MapPinned,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string; keywords?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview kpi' },
      { href: '/jobs', label: 'My Day', icon: ClipboardList, keywords: 'jobs installer run sheet today' },
      { href: '/notifications', label: 'Notifications', icon: Bell, keywords: 'activity alerts' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/projects', label: 'Projects', icon: Briefcase, keywords: 'jobs leads deals' },
      { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare, keywords: 'kanban stages board' },
      { href: '/customers', label: 'Customers', icon: Contact, keywords: 'contacts clients' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { href: '/calendar', label: 'Calendar', icon: CalendarDays, keywords: 'schedule appointments bookings' },
      { href: '/planning', label: 'Planning board', icon: MapPinned, keywords: 'capacity dispatch' },
      { href: '/shop-day', label: 'Auto Shop Day', icon: CarFront, keywords: 'dealer bays vehicles' },
      { href: '/team', label: 'My Team', icon: Users, keywords: 'installers staff workload dispatch' },
    ],
  },
  {
    label: 'AI Studio',
    items: [
      { href: '/visualizer', label: '3D Visualizer', icon: Wand2, badge: 'AI', keywords: '3d car tint preview photo' },
      { href: '/advisor', label: 'Smart Advisor', icon: Sparkles, badge: 'AI', keywords: 'film recommendation calculator roll size cut' },
      { href: '/films', label: 'Film Library', icon: Layers, keywords: 'films products vlt' },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/proposals', label: 'Proposals', icon: FileText, keywords: 'quotes offers' },
      { href: '/payments', label: 'Payments', icon: CreditCard, keywords: 'invoices deposits balance' },
      { href: '/inventory', label: 'Inventory', icon: Boxes, keywords: 'film rolls stock' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/notes', label: 'Notes & tasks', icon: Gauge, keywords: 'todo tasks' },
      { href: '/files', label: 'Files & photos', icon: FolderOpen, keywords: 'uploads documents' },
      { href: '/reviews', label: 'Reviews', icon: Star, keywords: 'google feedback' },
      { href: '/lead-forms', label: 'Lead forms', icon: Megaphone, keywords: 'website capture' },
      { href: '/automations', label: 'Automations', icon: Workflow, keywords: 'rules sms reminders' },
      { href: '/reports', label: 'Reports', icon: BarChart3, keywords: 'analytics export csv' },
    ],
  },
  {
    label: 'Administration',
    items: [{ href: '/settings', label: 'Settings', icon: Settings, keywords: 'business stores team catalogue packages templates roles' }],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);
export const SunIcon = SunMedium;
