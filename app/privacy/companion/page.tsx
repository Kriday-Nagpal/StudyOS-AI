import Link from 'next/link';
import StudyOSLogo from '@/components/studyos-logo';

export const metadata = {
  title: 'StudyOS Learning Companion Privacy',
  description: 'Privacy information for the StudyOS Learning Companion private beta.',
};

export default function CompanionPrivacyPage(){
  return <main className="min-h-screen bg-[#f7f6fb] text-[#211d2b]">
    <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      <div className="rounded-[28px] border border-[#e5e1eb] bg-white p-6 shadow-[0_30px_90px_rgba(35,28,57,.08)] sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efedf3] pb-7">
          <StudyOSLogo />
          <span className="rounded-full border border-[#e1dcf0] bg-[#f7f4ff] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-[#715fd0]">Learning Companion · Private Beta</span>
        </div>

        <div className="mt-9 max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#7a69cf]">Privacy policy</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Automatic learning tracking, with clear boundaries.</h1>
          <p className="mt-4 text-sm leading-7 text-[#77717f]">Last updated: September 19, 2026. This policy describes the StudyOS Learning Companion browser extension used with the StudyOS academic workspace.</p>
        </div>

        <div className="mt-10 grid gap-5 text-sm leading-7 text-[#655f6b]">
          <Policy title="Single purpose">The Companion helps a signed-in StudyOS student save learning progress from supported educational video pages and deliberately capture selected learning notes into the student’s private StudyOS workspace.</Policy>
          <Policy title="Data automatically processed">On supported learning domains, the Companion may process the current lesson page URL and title, video playback position, video duration, calculated completion percentage, and sync time. It does not request Chrome browser-history permission and does not collect unrelated browsing history.</Policy>
          <Policy title="Data processed only when you choose Capture">When the student uses Capture to StudyOS, the Companion may send text the student deliberately selected on the current page, together with the current URL/title, to the StudyOS review screen. Nothing from this capture flow is saved until the student confirms it in StudyOS.</Policy>
          <Policy title="Account and local extension storage">Pairing credentials for the signed-in StudyOS account, Companion preferences, recent local sync health, and the last local sync state are stored in Chrome extension local storage on that browser. Disconnecting the Companion removes the locally stored pairing credentials.</Policy>
          <Policy title="Server-side storage">Confirmed learning records and automatic progress updates are sent over HTTPS to StudyOS and stored in the signed-in student’s Supabase-backed workspace. StudyOS uses per-user Row Level Security so authenticated records are scoped to the owning account.</Policy>
          <Policy title="AI-assisted mapping and study kits">StudyOS may use its configured AI gateway to help classify a lesson title against the student’s curriculum when deterministic matching is not confident enough, or to create a study kit from notes/text the student deliberately supplies. Automatic progress tracking does not silently copy full lesson transcripts.</Policy>
          <Policy title="Third-party services">StudyOS uses Supabase for authenticated application data. If AI-assisted features are enabled, the configured StudyOS AI provider may process the minimum learning context needed for that requested feature. The Companion does not sell user data or use it for personalized advertising.</Policy>
          <Policy title="Supported domains">Automatic video progress tracking is limited to the learning domains declared in the extension package, currently including YouTube, Physics Wallah/PW, DIKSHA, Khan Academy, and the StudyOS production site used for pairing and review.</Policy>
          <Policy title="Retention and controls">The Companion keeps local pairing/preferences and a small recent-sync history until the student disconnects, clears local sync history, removes the extension, or Chrome clears extension storage. StudyOS learning records remain in the student’s StudyOS workspace until removed through StudyOS data controls or a deletion request during the Private Beta.</Policy>
          <Policy title="Chrome Web Store Limited Use">Data obtained through extension permissions is used only to provide and improve the StudyOS Learning Companion’s disclosed learning-tracking and capture features, plus necessary security and reliability functions. It is not used for advertising, sold, or transferred for unrelated purposes.</Policy>
          <Policy title="Private Beta and supervised accounts">This Companion is currently intended for trusted Private Beta testers. Browser or Family Link approval rules may still apply. StudyOS does not attempt to bypass supervised-account restrictions.</Policy>
          <Policy title="Questions or deletion requests">During the Private Beta, use the developer contact email shown on the Chrome Web Store listing for privacy questions or requests concerning Companion data.</Policy>
        </div>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-[#efedf3] pt-7">
          <Link href="/companion/connect" className="rounded-xl bg-[#211c31] px-4 py-3 text-xs font-bold text-white no-underline">Connect Companion</Link>
          <Link href="/app?view=Learning" className="rounded-xl border border-[#dfdbe7] bg-white px-4 py-3 text-xs font-bold text-[#655b70] no-underline">Open Learning Tracker</Link>
        </div>
      </div>
    </section>
  </main>;
}

function Policy({title,children}:{title:string;children:React.ReactNode}){
  return <section className="rounded-2xl border border-[#ebe8f0] bg-[#fbfafd] p-5">
    <h2 className="m-0 text-sm font-bold tracking-[-.015em] text-[#332d3d]">{title}</h2>
    <p className="mb-0 mt-2 text-[13px] leading-6">{children}</p>
  </section>;
}
