'use client';

import Link from 'next/link';
import { useState } from 'react';
import ParticleDrift from '@/components/ui/particle-drift';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  FileSearch,
  FileText,
  Gauge,
  Library,
  LockKeyhole,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';

const pipeline = [
  {
    icon: Upload,
    title: 'Capture',
    copy: 'Syllabus PDFs, date sheets, blueprints, worksheets, past papers and teacher instructions arrive as academic evidence.',
  },
  {
    icon: FileSearch,
    title: 'Structure',
    copy: 'StudyOS turns those files into subjects, exam dates, chapters, topics, exclusions, marks and reviewable source records.',
  },
  {
    icon: Brain,
    title: 'Prioritize',
    copy: 'Exam urgency, new content, mastery, revision due, mistakes and available time resolve into the next best study action.',
  },
  {
    icon: RefreshCw,
    title: 'Adapt',
    copy: 'When an exam moves, a chapter is completed or a session is missed, the study plan can rebalance from the same source of truth.',
  },
];

const connectedSurfaces = [
  {
    icon: FileSearch,
    kicker: 'Document Intelligence',
    title: 'School PDFs become structured academic context.',
    copy: 'Upload a date sheet, syllabus or blueprint. Extraction stays review-first so uncertain data never silently rewrites your preparation.',
  },
  {
    icon: Sparkles,
    kicker: 'Study Next',
    title: 'One decision replaces twenty planning decisions.',
    copy: 'StudyOS chooses the highest-value next activity from real exam, syllabus, revision and progress evidence instead of asking you to manually rank everything.',
  },
  {
    icon: Gauge,
    kicker: 'Exam Command Center',
    title: 'Every exam gets its own preparation system.',
    copy: 'Track confirmed portions, new versus previously assessed content, remaining revision, available days, blueprint structure and preparation progress.',
  },
  {
    icon: FileText,
    kicker: 'Paper Studio',
    title: 'Practice follows the confirmed syllabus and pattern.',
    copy: 'Practice papers are generated only after syllabus and blueprint confirmation, with mark-total and syllabus-label validation before saving.',
  },
];

const featureGroups = [
  {
    title: 'Academic core',
    icon: BookOpen,
    items: [
      'Subjects, books, chapters and topics',
      'Verified curriculum metadata',
      'Chapter progress and mastery evidence',
      'Daily plans and study sessions',
      'Revision scheduling',
      'Mistake tracking',
      'Resources and notes',
      'Video progress',
      'Doubts and flashcards',
    ],
  },
  {
    title: 'Exam intelligence',
    icon: Target,
    items: [
      'Date-sheet extraction',
      'Syllabus extraction and review',
      'Blueprint extraction',
      'New vs previously assessed content',
      'Exam-aware priority scoring',
      'Gap-day planning',
      'Revision queues',
      'Question Paper Studio',
      'Answer-key and validation records',
    ],
  },
  {
    title: 'Automation',
    icon: WandSparkles,
    items: [
      'Study Next recommendations',
      'Plan rebalancing',
      'Review-first document automation',
      'Focus-session logging',
      'Revision resurfacing',
      'Exam countdown context',
      'Notification preferences',
      'Academic activity history',
      'AI actions with source context',
    ],
  },
  {
    title: 'Privacy & control',
    icon: ShieldCheck,
    items: [
      'Supabase authentication',
      'Per-user Row Level Security',
      'Private document storage',
      'Source provenance',
      'No fake production analytics',
      'Low-confidence review boundaries',
      'Student-scoped records',
      'Auditable AI actions',
      'No secret browser credentials',
    ],
  },
];

function GradientCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        'rounded-[26px] bg-[linear-gradient(135deg,rgba(255,255,255,.11),rgba(255,255,255,.025),rgba(156,140,255,.16))] p-px ' +
        className
      }
    >
      <div className="h-full rounded-[25px] bg-[#09080f]/96">{children}</div>
    </div>
  );
}

function SystemPreview() {
  return (
    <GradientCard className="mx-auto mt-12 w-full max-w-5xl">
      <div className="overflow-hidden p-4 sm:p-5">
        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
          <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
            <Sparkles className="size-4 text-violet-200" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[.18em] text-white/35">
              Live workspace architecture
            </p>
            <p className="mt-1 text-sm font-light text-white/78">
              Evidence enters once. Every academic surface reads from the same system.
            </p>
          </div>
          <span className="ml-auto hidden rounded-full border border-emerald-200/15 bg-emerald-200/[0.035] px-3 py-1 text-[9px] font-medium uppercase tracking-[.14em] text-emerald-100/70 sm:inline-flex">
            Real data only
          </span>
        </div>

        <div className="grid gap-3 pt-4 lg:grid-cols-[.95fr_1.35fr_.8fr]">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
            <p className="text-[9px] font-medium uppercase tracking-[.18em] text-white/25">Academic inbox</p>
            <div className="mt-4 grid gap-2">
              {[
                ['Date sheet', 'Extract → review'],
                ['Syllabus', 'Map → confirm'],
                ['Blueprint', 'Validate → connect'],
                ['Past paper', 'Index → analyze'],
              ].map(([title, state]) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-black/25 px-3 py-3"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-violet-300/[0.08] text-violet-200">
                    <FileText className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-light text-white/72">{title}</p>
                    <p className="mt-1 text-[9px] text-white/28">{state}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-violet-200/10 bg-[radial-gradient(circle_at_50%_0%,rgba(130,106,255,.16),transparent_48%),rgba(255,255,255,.02)] p-5">
            <div className="absolute -right-16 -top-20 size-56 rounded-full bg-violet-400/10 blur-3xl" />
            <p className="relative text-[9px] font-medium uppercase tracking-[.18em] text-violet-200/60">
              StudyOS intelligence
            </p>
            <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['Priority engine', 'Urgency + newness + weakness + revision'],
                ['Study Next', 'Returns one explainable next action'],
                ['Exam mode', 'Rebalances around confirmed dates and scope'],
                ['Revision engine', 'Resurfaces due learning automatically'],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="rounded-xl border border-white/[0.06] bg-black/25 p-4 backdrop-blur-xl"
                >
                  <p className="text-xs font-light text-white/82">{title}</p>
                  <p className="mt-2 text-[10px] font-light leading-5 text-white/32">{copy}</p>
                </div>
              ))}
            </div>
            <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-violet-200/10 bg-violet-200/[0.035] px-4 py-3">
              <Sparkles className="size-4 text-violet-200" />
              <div>
                <p className="text-[9px] uppercase tracking-[.16em] text-white/28">Decision output</p>
                <p className="mt-1 text-sm font-light text-white/80">What should I study next — and why?</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
            <p className="text-[9px] font-medium uppercase tracking-[.18em] text-white/25">Connected outputs</p>
            <div className="mt-4 grid gap-2">
              {[
                [CalendarDays, 'Today plan'],
                [Target, 'Exam roadmap'],
                [RefreshCw, 'Revision queue'],
                [FileText, 'Practice paper'],
                [Gauge, 'Analytics'],
              ].map(([Icon, label]) => {
                const ItemIcon = Icon as typeof CalendarDays;
                return (
                  <div
                    key={label as string}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-black/25 px-3 py-3"
                  >
                    <ItemIcon className="size-4 text-violet-200/70" />
                    <span className="text-xs font-light text-white/55">{label as string}</span>
                    <ArrowRight className="ml-auto size-3.5 text-white/16" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </GradientCard>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-black text-white selection:bg-violet-200 selection:text-black">
      <div
        className="pointer-events-none fixed inset-0 z-[70] opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 2 2' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='1' height='1' fill='%23ffffff'/%3E%3Crect x='1' y='1' width='1' height='1' fill='%23ffffff'/%3E%3C/svg%3E\")",
          backgroundSize: '2px 2px',
        }}
      />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/65 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-5 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <span className="relative grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.05] shadow-[0_0_35px_rgba(156,140,255,.12)]">
              <Sparkles className="size-4.5 text-violet-200" />
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,.85)]" />
            </span>
            <span className="text-sm font-medium tracking-[.02em] text-white">
              StudyOS <span className="font-light text-white/45">AI</span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-7 text-[11px] font-medium uppercase tracking-[.16em] text-white/45 md:flex">
            <a href="#system" className="transition hover:text-white">System</a>
            <a href="#intelligence" className="transition hover:text-white">Intelligence</a>
            <a href="#surfaces" className="transition hover:text-white">Surfaces</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#privacy" className="transition hover:text-white">Privacy</a>
          </nav>

          <div className="ml-5 hidden items-center gap-2 sm:flex">
            <Link
              href="/app"
              className="rounded-full px-4 py-2 text-xs text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-4 py-2 text-xs font-medium text-black transition hover:bg-violet-100"
            >
              Open StudyOS <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <button
            aria-label="Toggle navigation"
            className="ml-auto grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white sm:hidden"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-white/[0.06] bg-black/95 px-5 py-5 backdrop-blur-2xl sm:hidden">
            <div className="grid gap-1 text-sm text-white/58">
              {[
                ['System', '#system'],
                ['Intelligence', '#intelligence'],
                ['Surfaces', '#surfaces'],
                ['Features', '#features'],
                ['Privacy', '#privacy'],
              ].map(([label, href]) => (
                <a key={href} href={href} className="rounded-xl px-3 py-3 hover:bg-white/[0.04] hover:text-white">
                  {label}
                </a>
              ))}
              <Link
                href="/app"
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-medium text-black"
              >
                Open StudyOS <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section className="relative min-h-[920px] overflow-hidden pt-16">
          <div className="absolute inset-0">
            <ParticleDrift
              className="h-full w-full"
              speed={0.72}
              density={1.02}
              opacity={0.82}
            />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,rgba(7,5,16,.2)_36%,rgba(0,0,0,.84)_80%,#000_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.18),rgba(0,0,0,.05)_48%,#000_100%)]" />
          <div className="absolute left-1/2 top-[34%] size-[620px] -translate-x-1/2 rounded-full bg-violet-500/[0.065] blur-[120px]" />

          <div className="relative z-10 mx-auto flex min-h-[850px] max-w-7xl flex-col items-center justify-center px-5 pb-24 pt-24 text-center lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.18em] text-white/55 backdrop-blur-xl">
              <Sparkles className="size-3 text-violet-200" />
              Personal academic operating system
            </div>

            <h1 className="mt-7 max-w-6xl text-balance text-5xl font-extralight uppercase leading-[.93] tracking-[-.058em] text-white sm:text-7xl lg:text-[94px]">
              Every academic signal
              <span className="block text-white/30">converges here.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-balance text-sm font-light leading-7 text-white/50 sm:text-base">
              StudyOS turns curriculum, school syllabus, date sheets, blueprints, progress, revision and
              mistakes into one private system that can decide what deserves your attention next.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                href="/app"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-xs font-medium text-black transition hover:bg-violet-100"
              >
                Initialize workspace <ArrowRight className="size-4" />
              </Link>
              <a
                href="#system"
                className="inline-flex min-h-11 items-center rounded-full border border-white/12 bg-black/30 px-6 text-xs text-white/78 backdrop-blur-xl transition hover:bg-white/[0.06]"
              >
                Explore the system
              </a>
            </div>

            <div className="mt-10 grid w-full max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] text-left sm:grid-cols-4">
              {[
                ['Curriculum', 'Source-aware'],
                ['Plans', 'Evidence-first'],
                ['Exam changes', 'Rebalanced'],
                ['Control', 'Student-scoped'],
              ].map(([label, value]) => (
                <div key={label} className="bg-black/65 px-5 py-4 backdrop-blur-xl">
                  <p className="text-[9px] uppercase tracking-[.18em] text-white/28">{label}</p>
                  <p className="mt-1.5 text-sm font-light text-white/80">{value}</p>
                </div>
              ))}
            </div>

            <SystemPreview />
          </div>
        </section>

        <section id="system" className="relative border-t border-white/[0.06] bg-[#030305] py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[.22em] text-violet-200/75">
                  System architecture
                </p>
                <h2 className="mt-4 text-4xl font-extralight tracking-[-.035em] text-white sm:text-5xl">
                  Capture school reality.
                  <span className="block text-white/30">Resolve it into one study system.</span>
                </h2>
              </div>
              <p className="max-w-2xl text-sm font-light leading-7 text-white/45 lg:ml-auto">
                StudyOS is built around confirmed academic evidence, not generic planners. A syllabus change,
                new exam date, completed chapter or weak assessment should update the same academic graph
                instead of forcing you to rebuild a timetable manually.
              </p>
            </div>

            <div className="mt-12 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {pipeline.map(({ icon: Icon, title, copy }, index) => (
                <GradientCard key={title}>
                  <article className="relative min-h-[230px] p-6">
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-xl border border-white/8 bg-white/[0.035]">
                        <Icon className="size-4 text-violet-200" />
                      </span>
                      <span className="font-mono text-[10px] text-white/20">0{index + 1}</span>
                    </div>
                    <h3 className="mt-8 text-lg font-light tracking-tight">{title}</h3>
                    <p className="mt-3 text-sm font-light leading-6 text-white/38">{copy}</p>
                  </article>
                </GradientCard>
              ))}
            </div>
          </div>
        </section>

        <section id="intelligence" className="border-t border-white/[0.06] bg-black py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.82fr_1.18fr] lg:px-8">
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[.22em] text-violet-200/75">
                  Intelligence layer
                </p>
                <h2 className="mt-4 text-4xl font-extralight tracking-[-.035em] sm:text-5xl">
                  One academic graph becomes a decision engine.
                </h2>
                <p className="mt-5 max-w-xl text-sm font-light leading-7 text-white/42">
                  StudyOS does not need to pretend every subject is equally urgent. It can use confirmed exam
                  timing, content status, revision due, progress and mistake evidence to build a more useful order
                  of work.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-[9px] uppercase tracking-[.18em] text-white/25">Without context</p>
                  <p className="mt-2 text-lg font-light">Task list</p>
                  <p className="mt-1 text-xs text-white/35">You decide every priority</p>
                </div>
                <div className="rounded-2xl border border-violet-200/15 bg-violet-200/[0.035] p-4">
                  <p className="text-[9px] uppercase tracking-[.18em] text-violet-200/45">Connected state</p>
                  <p className="mt-2 text-lg font-light">StudyOS</p>
                  <p className="mt-1 text-xs text-white/35">The system explains what matters next</p>
                </div>
              </div>
            </div>

            <GradientCard>
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-light text-white/80">Priority resolution</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[.15em] text-white/25">
                      Explainable decision inputs
                    </p>
                  </div>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] text-white/35">
                    No invented score
                  </span>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Exam urgency', 'How close is the confirmed exam?'],
                    ['New content', 'What has not been assessed before?'],
                    ['Mastery evidence', 'Where is progress or confidence weakest?'],
                    ['Revision due', 'What is scheduled to resurface now?'],
                    ['Mistake frequency', 'Where are repeated errors accumulating?'],
                    ['Coverage gap', 'What confirmed syllabus remains untouched?'],
                  ].map(([title, copy], index) => (
                    <div
                      key={title}
                      className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <span className="font-mono text-[9px] text-violet-200/35">0{index + 1}</span>
                      <p className="mt-5 text-sm font-light text-white/78">{title}</p>
                      <p className="mt-2 text-xs font-light leading-5 text-white/34">{copy}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-violet-200/12 bg-violet-200/[0.035] px-5 py-4">
                  <Zap className="size-4 text-violet-200" />
                  <div>
                    <p className="text-[9px] uppercase tracking-[.16em] text-white/25">Output</p>
                    <p className="mt-1 text-sm font-light text-white/82">
                      One next action, with the reason it moved to the top.
                    </p>
                  </div>
                </div>
              </div>
            </GradientCard>
          </div>
        </section>

        <section
          id="surfaces"
          className="border-y border-white/[0.06] bg-[#030305] py-24"
        >
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-10 max-w-3xl">
              <p className="text-[10px] font-medium uppercase tracking-[.22em] text-violet-200/75">
                Connected surfaces
              </p>
              <h2 className="mt-4 text-4xl font-extralight tracking-[-.035em] sm:text-5xl">
                One system, multiple ways to prepare.
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {connectedSurfaces.map(({ icon: Icon, kicker, title, copy }) => (
                <GradientCard key={title}>
                  <article className="group p-6 sm:p-7">
                    <div className="flex items-center justify-between">
                      <span className="grid size-11 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-violet-200 transition group-hover:border-violet-200/20 group-hover:bg-violet-200/[0.04]">
                        <Icon className="size-4.5" />
                      </span>
                      <ArrowRight className="size-4 text-white/16 transition group-hover:translate-x-1 group-hover:text-white/55" />
                    </div>
                    <p className="mt-7 text-[9px] font-medium uppercase tracking-[.2em] text-white/28">{kicker}</p>
                    <h3 className="mt-2 max-w-md text-2xl font-extralight tracking-tight">{title}</h3>
                    <p className="mt-3 max-w-xl text-sm font-light leading-6 text-white/38">{copy}</p>
                  </article>
                </GradientCard>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-black py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[.22em] text-violet-200/75">
                  Everything in StudyOS
                </p>
                <h2 className="mt-4 text-4xl font-extralight tracking-[-.035em] sm:text-5xl">
                  One workspace.
                  <span className="block text-white/30">Dozens of connected capabilities.</span>
                </h2>
              </div>
              <p className="max-w-2xl text-sm font-light leading-7 text-white/42 lg:ml-auto">
                StudyOS is designed so documents, exams, plans, revision, progress and practice do not live as
                disconnected features. Each surface reads from the same authenticated academic workspace.
              </p>
            </div>

            <div className="mt-12 grid gap-3 md:grid-cols-2">
              {featureGroups.map(({ title, icon: Icon, items }) => (
                <GradientCard key={title}>
                  <article className="p-6 sm:p-7">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-violet-200">
                        <Icon className="size-4.5" />
                      </span>
                      <h3 className="text-xl font-extralight tracking-tight">{title}</h3>
                    </div>
                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                      {items.map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-2.5 rounded-xl border border-white/[0.055] bg-white/[0.018] px-3.5 py-3 text-xs font-light leading-5 text-white/48"
                        >
                          <Check className="mt-0.5 size-3.5 shrink-0 text-violet-200/70" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                </GradientCard>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 text-xs font-light text-white/38">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-violet-300" />
                Built into StudyOS
              </span>
              <span className="text-white/16">•</span>
              <span>
                AI-powered server routes activate only when their configured model provider is available.
              </span>
            </div>
          </div>
        </section>

        <section id="privacy" className="border-t border-white/[0.06] bg-[#030305] py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <GradientCard>
              <div className="grid gap-12 p-7 sm:p-10 lg:grid-cols-[1fr_.9fr] lg:p-12">
                <div>
                  <span className="grid size-12 place-items-center rounded-2xl border border-violet-200/12 bg-violet-200/[0.035]">
                    <LockKeyhole className="size-5 text-violet-200" />
                  </span>
                  <p className="mt-7 text-[10px] font-medium uppercase tracking-[.22em] text-violet-200/65">
                    Private architecture
                  </p>
                  <h2 className="mt-3 max-w-2xl text-4xl font-extralight tracking-[-.035em] sm:text-5xl">
                    Automation with boundaries.
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm font-light leading-7 text-white/42">
                    Student-owned rows remain user-scoped, uploaded academic files stay private, and uncertain
                    extraction can wait for confirmation instead of silently changing the study plan.
                  </p>
                </div>

                <div className="grid content-start gap-2">
                  {[
                    ['User-scoped academic rows', ShieldCheck],
                    ['Private document storage', LockKeyhole],
                    ['Review before uncertain extraction', FileSearch],
                    ['Source-aware curriculum records', Library],
                    ['No fake production analytics', BadgeCheck],
                    ['Fresh account starts without invented data', RefreshCw],
                  ].map(([label, Icon]) => {
                    const ItemIcon = Icon as typeof ShieldCheck;
                    return (
                      <div
                        key={label as string}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.065] bg-white/[0.02] px-4 py-3.5"
                      >
                        <ItemIcon className="size-4 text-violet-200/75" />
                        <span className="text-sm font-light text-white/52">{label as string}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </GradientCard>
          </div>
        </section>

        <section className="relative overflow-hidden bg-black py-28">
          <div className="absolute inset-0 opacity-45">
            <ParticleDrift
              className="h-full w-full"
              speed={0.45}
              density={0.5}
              opacity={0.38}
            />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(33,23,74,.12),#000_74%)]" />
          <div className="relative z-10 mx-auto max-w-4xl px-5 text-center">
            <Sparkles className="mx-auto size-7 text-violet-200/75" />
            <p className="mt-5 text-[10px] font-medium uppercase tracking-[.22em] text-white/30">
              Your academic operating system
            </p>
            <h2 className="mt-4 text-balance text-4xl font-extralight tracking-[-.04em] sm:text-6xl">
              Stop rebuilding the plan.
              <span className="block text-white/28">Let the system keep it current.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm font-light leading-7 text-white/40">
              Add the real school documents and study evidence you already have. StudyOS turns them into one
              connected preparation workspace.
            </p>
            <div className="mt-8">
              <Link
                href="/app"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-7 text-xs font-medium text-black transition hover:bg-violet-100"
              >
                Create my StudyOS <Zap className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] bg-black">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-[10px] uppercase tracking-[.15em] text-white/24 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>StudyOS AI · Personal academic operating system</span>
          <span>Real data · Evidence first · Student scoped</span>
        </div>
      </footer>
    </div>
  );
}
