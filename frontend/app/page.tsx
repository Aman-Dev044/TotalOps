import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, BarChart3, Boxes, Building2, CalendarDays, CarFront, CheckCircle2, ClipboardList, CreditCard, FileSignature, Home, KanbanSquare,
  Layers, Megaphone, Mic, Ruler, ScanLine, ShieldCheck, Sparkles, Store, Sun, Wand2, Workflow,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { HeroCar, Reveal } from '@/components/landing/motion';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  keywords: [
    'window tinting CRM', 'tint shop software', 'window film business software', 'automotive window tint CRM', 'residential window film quoting',
    'commercial window film software', '3D tint visualizer', 'car tint simulator', 'legal tint calculator', 'VLT calculator', 'window film roll calculator',
    'tint job scheduling', 'dealer portal tint', 'tint quote software', 'TotalOps',
  ],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: '/', siteName: SITE_NAME, title: SITE_TITLE, description: SITE_DESCRIPTION, locale: 'en_AU' },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
};

const FEATURES = [
  { icon: KanbanSquare, title: 'Projects & pipeline', text: 'Every enquiry moves from lead to paid job on a drag-and-drop board, with stage rules that stop jobs skipping a deposit or a booking.' },
  { icon: Ruler, title: 'Measurement sheets', text: 'Vehicle glass templates for 8 body styles, room-by-room surveys for homes and buildings, and automatic m² totals.' },
  { icon: Mic, title: 'Voice measuring', text: 'Installers say “kitchen window, 48 and a quarter by 72 inches” and the pane is added — hands stay on the tape.' },
  { icon: FileSignature, title: 'Proposals customers approve', text: 'Offer good/better/best alternatives and add-ons. Customers pick options and approve from a private link.' },
  { icon: CreditCard, title: 'Invoices & deposits', text: 'Deposits before the install, part payments after, live balances and overdue tracking across every store.' },
  { icon: CalendarDays, title: 'Calendar & planning', text: 'Month, week and day views, installer capacity, bay clash detection and drag-to-reschedule.' },
  { icon: CarFront, title: 'Auto shop day', text: 'A run sheet for high-volume days with one-tap bay status: arrived, in bay, installing, ready for pickup.' },
  { icon: Store, title: 'Live dealer portal', text: 'Dealerships watch their vehicles move through your bays in real time — no more “is it ready yet?” calls.' },
  { icon: Boxes, title: 'Film inventory', text: 'Track every roll by width, shade and batch. Allocate film to jobs and get reorder alerts before you run out.' },
  { icon: Workflow, title: 'Automations', text: 'Appointment reminders, proposal follow-ups, deposit thank-yous and review requests fire on their own.' },
  { icon: Megaphone, title: 'Lead forms', text: 'Publish quote forms for your website. Every submission becomes a contact and a project instantly.' },
  { icon: BarChart3, title: 'Reports & exports', text: 'Revenue, pipeline, conversion, film usage and installer performance — exportable to CSV any time.' },
];

const AI = [
  { icon: Wand2, title: '3D Tint Visualizer', text: 'Show customers their exact car with every window tinted — choose film and shade per window, switch day or night, even sit inside the cabin.' },
  { icon: ScanLine, title: 'Photo → 3D', text: 'Upload a photo of the customer’s car. TotalOps reads the body style and paint colour and rebuilds it in 3D, then previews the tint on the photo itself.' },
  { icon: Sparkles, title: 'Smart Film Advisor', text: 'Ranks every film for heat, privacy, glare, UV, security and budget, picks the darkest legal shade per window and warns about thermal-stress risk on home glass.' },
  { icon: Layers, title: 'Roll & cut calculator', text: 'Chooses the right roll width for each pane, plans the cuts, and reports linear metres, waste, material cost and margin before you quote.' },
];

const STEPS = [
  { n: '01', title: 'Capture the lead', text: 'From your website form, a phone call or a dealer booking.' },
  { n: '02', title: 'Measure & recommend', text: 'Templates or voice measuring, then the Advisor picks film and roll sizes.' },
  { n: '03', title: 'Quote & approve', text: 'Send options; the customer approves online and pays a deposit.' },
  { n: '04', title: 'Install & get paid', text: 'Book the bay, check in, mark ready, invoice and collect — then ask for a review.' },
];

const FAQ = [
  { q: 'What is TotalOps?', a: 'TotalOps is a CRM and operations platform built specifically for window tinting businesses. It covers leads, measuring, quoting, scheduling, installs, invoicing, film inventory and reporting for automotive, residential and commercial work.' },
  { q: 'Does TotalOps check window tint laws?', a: 'Yes. The Smart Film Advisor and the 3D Visualizer calculate combined VLT (film × factory glass) for each window and compare it with the selected region’s limits, including every Australian state, New Zealand, India, the UK, UAE and several US states. Always confirm with your local authority.' },
  { q: 'Can customers see their car before they book?', a: 'Yes. The 3D Tint Visualizer renders the vehicle with the chosen film and shade on every window, and the photo preview applies the tint to a photo of their own car.' },
  { q: 'How does the roll size calculator work?', a: 'For each pane it adds a trim allowance, finds the narrowest roll that fits without a seam, then shelf-packs all pieces to report linear metres, total film area and waste percentage.' },
  { q: 'Can dealerships track their vehicles?', a: 'Yes. Each dealer gets a private live portal link showing today’s vehicles, bay status, film package and measurements, refreshed automatically.' },
  { q: 'Does it work for multiple stores?', a: 'Yes. Stores, bays, team rosters and inventory are managed per location, and every dashboard can be filtered by store.' },
];

const SEGMENTS = [
  { icon: CarFront, title: 'Automotive', text: 'Ceramic and carbon packages, legal shade checks, bay scheduling and dealer fleets.' },
  { icon: Home, title: 'Residential', text: 'Room-by-room surveys, heat and glare goals, energy-savings estimates and glass-safety checks.' },
  { icon: Building2, title: 'Commercial', text: 'Multi-level glazing surveys, phased proposals, access notes and crew allocation.' },
];

function JsonLd() {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      featureList: [...FEATURES, ...AI].map((f) => f.title).join(', '),
    },
    { '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon.svg` },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <JsonLd />

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0b0b1a]/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main">
          <Link href="/" aria-label="TotalOps home" className="[&_span]:text-white">
            <Logo />
          </Link>
          <ul className="hidden items-center gap-7 text-sm font-medium text-white/70 md:flex">
            <li><a href="#features" className="transition hover:text-white">Features</a></li>
            <li><a href="#ai-studio" className="transition hover:text-white">AI Studio</a></li>
            <li><a href="#how-it-works" className="transition hover:text-white">How it works</a></li>
            <li><a href="#faq" className="transition hover:text-white">FAQ</a></li>
          </ul>
          <Link href="/login" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0b0b1a] transition hover:bg-white/90">
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#0b0b1a] pb-24 pt-32 text-white sm:pt-40" aria-labelledby="hero-title">
          <div className="bg-grid absolute inset-0 opacity-30" />
          <div className="absolute -left-40 top-10 h-[30rem] w-[30rem] rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="absolute -right-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/25 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-indigo-200">
                <Sparkles className="h-3.5 w-3.5" /> The window tinting CRM with a 3D visualizer
              </p>
              <h1 id="hero-title" className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                Run your tint shop from first enquiry to{' '}
                <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">five-star review.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/70">
                TotalOps brings quoting, scheduling, bays, invoices, film stock and dealer updates into one place — and shows every customer exactly how their car will look, legally, before they book.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3.5 font-semibold shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110">
                  Open your workspace <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#features" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 font-semibold text-white/90 transition hover:bg-white/10">
                  Explore features
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
                {['Automotive', 'Residential', 'Commercial', 'Multi-store'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.15}>
              <HeroCar />
            </Reveal>
          </div>
        </section>

        {/* Facts */}
        <section className="border-b border-line bg-card" aria-label="Product facts">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 text-center sm:px-6 md:grid-cols-4">
            {[
              ['8', 'vehicle body styles in 3D'],
              ['16', 'legal tint regions built in'],
              ['3', 'segments: auto, home, commercial'],
              ['25+', 'modules in one workspace'],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-4xl font-extrabold gradient-text">{n}</dd>
                <dd className="mt-1 text-sm text-muted-fg">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6" aria-labelledby="features-title">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Everything a tint business needs</p>
            <h2 id="features-title" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">One workspace for the office, the bay and the road</h2>
            <p className="mt-4 text-muted-fg">Replace spreadsheets, paper job cards and group chats with a system built around how tinting jobs actually run.</p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06}>
                <article className="card group h-full p-6 transition hover:-translate-y-1 hover:shadow-lift">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-110">
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-fg">{f.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* AI Studio */}
        <section id="ai-studio" className="relative scroll-mt-20 overflow-hidden bg-[#0b0b1a] py-24 text-white" aria-labelledby="ai-title">
          <div className="bg-grid absolute inset-0 opacity-25" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-300">AI Studio</p>
              <h2 id="ai-title" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Sell with confidence. Quote with precision.</h2>
              <p className="mt-4 text-white/70">Customers decide faster when they can see the result. Your team quotes faster when the maths is done for them.</p>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {AI.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.08}>
                  <article className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-white/25 hover:bg-white/10">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500">
                      <f.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 font-display text-xl font-bold">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{f.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.1}>
              <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5 text-sm text-emerald-100">
                <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-300" aria-hidden />
                <p>
                  Legal by design: combined VLT is calculated as film × factory glass for each window and checked against the selected region — front sides, rear sides, rear screen and windscreen visor strip.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Segments */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6" aria-labelledby="segments-title">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 id="segments-title" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Built for every kind of tinting work</h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {SEGMENTS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <article className="card h-full p-7 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-glow">
                    <s.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-fg">{s.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-card py-24" aria-labelledby="how-title">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">How it works</p>
              <h2 id="how-title" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">From enquiry to paid in four steps</h2>
            </Reveal>
            <ol className="mt-14 grid gap-6 md:grid-cols-4">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.08}>
                  <li className="relative h-full rounded-2xl border border-line bg-bg p-6">
                    <span className="font-display text-4xl font-extrabold gradient-text">{s.n}</span>
                    <h3 className="mt-3 font-display text-lg font-bold">{s.title}</h3>
                    <p className="mt-2 text-sm text-muted-fg">{s.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
            <Reveal delay={0.1}>
              <ul className="mx-auto mt-12 grid max-w-4xl gap-3 text-sm sm:grid-cols-2">
                {[
                  'Appointment reminders and proposal follow-ups sent automatically',
                  'Installer and bay double-bookings blocked before they happen',
                  'Low film stock flagged before it stops a job',
                  'Every action logged in the project activity timeline',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6" aria-labelledby="faq-title">
          <Reveal className="text-center">
            <h2 id="faq-title" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Frequently asked questions</h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-bold">
                  <h3>{f.q}</h3>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-fg transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-fg">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-24 sm:px-6" aria-labelledby="cta-title">
          <Reveal>
            <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-amber-500 p-10 text-center text-white shadow-lift sm:p-16">
              <div className="bg-grid absolute inset-0 opacity-20" />
              <Sun className="relative mx-auto h-10 w-10 animate-floaty" aria-hidden />
              <h2 id="cta-title" className="relative mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">Ready to run a cooler tint business?</h2>
              <p className="relative mx-auto mt-4 max-w-xl text-white/85">Sign in to your TotalOps workspace and start quoting, booking and visualising today.</p>
              <Link href="/login" className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-semibold text-[#0b0b1a] shadow-lg transition hover:bg-white/90">
                Sign in to TotalOps <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-fg sm:flex-row sm:px-6">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#ai-studio" className="hover:text-fg">AI Studio</a>
            <a href="#faq" className="hover:text-fg">FAQ</a>
            <Link href="/login" className="hover:text-fg">Sign in</Link>
          </nav>
          <p className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" aria-hidden /> © {new Date().getFullYear()} TotalOps · Window tinting CRM
          </p>
        </div>
      </footer>
    </div>
  );
}
