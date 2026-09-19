'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight, BarChart3, BookOpen, Brain, CalendarDays, Check, FileText,
  Library, Menu, Play, Search, ShieldCheck, Sparkles, Target, Upload, X, Zap
} from 'lucide-react';

const features = [
  {icon:Upload,title:'Upload once. StudyOS understands it.',copy:'Datesheets, school syllabus, PT-1 portions, blueprints, worksheets and previous papers become structured academic data.'},
  {icon:Brain,title:'Study Next intelligence',copy:'StudyOS combines exam dates, new chapters, mastery, revision due, mistakes and available time to pick the highest-value next action.'},
  {icon:BookOpen,title:'Verified curriculum layer',copy:'Current NCERT/CBSE structure is versioned and source-aware. No fake chapter lists or production demo academic data.'},
  {icon:FileText,title:'Blueprint-based paper studio',copy:'Generate practice papers only from confirmed syllabus and blueprint rules, with mark totals and excluded-topic validation.'},
  {icon:BarChart3,title:'Real analytics',copy:'Study time, subject balance, completion, mastery and revision trends come from your saved activity—not invented charts.'},
  {icon:ShieldCheck,title:'Private by design',copy:'Supabase Auth, RLS, private document storage and user-isolated academic records keep personal study data protected.'},
];

export default function LandingPage(){
  const [menu,setMenu]=useState(false);
  return <main className="landing-shell">
    <nav className="landing-nav">
      <Link href="/" className="landing-logo"><span><Sparkles size={18}/></span><b>StudyOS <em>AI</em></b></Link>
      <div className="landing-links">
        <a href="#product">Product</a><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#security">Security</a>
      </div>
      <div className="landing-actions"><Link href="/app" className="ghost-link">Sign in</Link><Link href="/app" className="nav-cta">Open StudyOS <ArrowRight size={15}/></Link></div>
      <button className="landing-menu" onClick={()=>setMenu(v=>!v)}>{menu?<X/>:<Menu/>}</button>
      {menu&&<div className="mobile-landing-menu"><a href="#product">Product</a><a href="#features">Features</a><a href="#workflow">How it works</a><Link href="/app">Open StudyOS</Link></div>}
    </nav>

    <section className="landing-hero" id="product">
      <div className="hero-glow hero-glow-one"/><div className="hero-glow hero-glow-two"/>
      <div className="landing-hero-copy">
        <span className="hero-pill"><Sparkles size={14}/> PERSONAL ACADEMIC OPERATING SYSTEM</span>
        <h1>Stop planning your studies.<br/><span>Let StudyOS decide what matters next.</span></h1>
        <p>Upload your syllabus, datesheet and blueprint. StudyOS compares old vs new chapters, tracks real progress, schedules revision, and builds your exam strategy automatically.</p>
        <div className="hero-buttons"><Link href="/app" className="hero-primary"><Play size={16}/>Start your StudyOS</Link><a href="#workflow" className="hero-secondary">See how it works <ArrowRight size={15}/></a></div>
        <div className="hero-proof"><span><Check/>Real Supabase backend</span><span><Check/>Verified academic sources</span><span><Check/>No fake production data</span></div>
      </div>

      <div className="hero-product">
        <div className="hero-window">
          <header className="hero-window-top"><div className="window-brand"><span><Sparkles size={15}/></span>StudyOS AI</div><div className="window-search"><Search size={14}/><span>Ask StudyOS or search anything…</span><kbd>⌘ K</kbd></div><span className="window-live">LIVE DATA</span></header>
          <div className="hero-window-body">
            <aside className="hero-mini-sidebar">
              {[Sparkles,CalendarDays,BookOpen,Library,Target,FileText,Brain,BarChart3].map((Icon,i)=><span className={i===0?'active':''} key={i}><Icon size={15}/></span>)}
            </aside>
            <div className="hero-dashboard">
              <div className="hero-dashboard-head"><div><small>FRIDAY · 19 SEPTEMBER</small><h3>Good evening, Kriday</h3></div><button><Play size={13}/>Study next</button></div>
              <section className="hero-priority">
                <div><span><Sparkles size={12}/> STUDYOS PRIORITY</span><h4>Science — new chapter first</h4><p>New in Half-Yearly · exam in 6 days · not yet started</p><button><Play size={12}/>Start 35 min session</button></div>
                <div className="hero-count"><strong>6</strong><span>days</span><b>Science exam</b><small>80 marks</small></div>
              </section>
              <div className="hero-bento">
                <section className="hero-card hero-card-wide"><header><span>TODAY</span><b>Smart study plan</b></header>
                  {[
                    ['Science','Combustion & Flame','35 min','New'],
                    ['Maths','Linear equations practice','40 min','Weak'],
                    ['English','Revision due','20 min','R2'],
                  ].map((r,i)=><div className="mini-task" key={r[1]}><span className={`task-dot t${i}`}/><div><b>{r[0]}</b><small>{r[1]}</small></div><em>{r[3]}</em><strong>{r[2]}</strong></div>)}
                </section>
                <section className="hero-card"><header><span>EXAM READINESS</span><b>Science</b></header><div className="hero-ring"><strong>64%</strong><span>Developing</span></div></section>
                <section className="hero-card"><header><span>REVISION</span><b>Due today</b></header><div className="revision-chip">Coal & Petroleum <em>8 min</em></div><div className="revision-chip">Exponents <em>12 min</em></div></section>
                <section className="hero-card hero-card-chart"><header><span>7 DAYS</span><b>Study analytics</b></header><div className="hero-bars">{[38,62,47,80,70,31,18].map((x,i)=><i key={i} style={{height:x+'%'}} className={i===3?'hot':''}/>)}</div></section>
              </div>
            </div>
          </div>
        </div>
        <div className="floating-insight insight-one"><Sparkles/><div><b>3 new chapters detected</b><span>Priority updated automatically</span></div></div>
        <div className="floating-insight insight-two"><Zap/><div><b>Revision moved forward</b><span>Based on recent mistakes</span></div></div>
      </div>
    </section>

    <section className="landing-strip">
      <span>DATESHEET</span><i/> <span>SYLLABUS</span><i/> <span>NCERT</span><i/> <span>BLUEPRINT</span><i/> <span>PROGRESS</span><i/> <span>REVISION</span><i/> <span>AI PLANNING</span>
    </section>

    <section className="landing-section" id="features">
      <div className="section-intro"><span>BUILT FOR REAL STUDY WORK</span><h2>Everything connects to one academic intelligence layer.</h2><p>Not another timetable. Every feature feeds the same decision engine so the system gets more useful as you study.</p></div>
      <div className="feature-bento">{features.map((f,i)=><article className={i===0||i===3?'feature-large':''} key={f.title}><span><f.icon/></span><h3>{f.title}</h3><p>{f.copy}</p>{i===0&&<div className="upload-demo"><FileText/><div><b>Half-yearly-syllabus.pdf</b><small>7 subjects · 42 chapters detected</small></div><em>Ready to review</em></div>}{i===3&&<div className="paper-demo"><div><span>Section A</span><b>20 × 1</b></div><div><span>Section B</span><b>6 × 2</b></div><div><span>Section C</span><b>7 × 3</b></div></div>}</article>)}</div>
    </section>

    <section className="workflow-section" id="workflow">
      <div className="workflow-copy"><span>AUTOMATED STUDY LOOP</span><h2>StudyOS keeps recalculating as your academic world changes.</h2><p>Miss a study session? New syllabus? Exam moved? Quiz went badly? The plan adapts instead of forcing you to rebuild everything manually.</p><Link href="/app">Build my workspace <ArrowRight/></Link></div>
      <div className="workflow-stack">
        {[
          ['01','Upload','Datesheet, syllabus, blueprint, old papers'],
          ['02','Understand','Extract subjects, chapters, dates and rules'],
          ['03','Prioritize','Compare new content, mastery and exam urgency'],
          ['04','Study','Start the highest-value session in one tap'],
          ['05','Adapt','Update mastery, revision and tomorrow’s plan'],
        ].map(x=><article key={x[0]}><span>{x[0]}</span><div><b>{x[1]}</b><p>{x[2]}</p></div><ArrowRight/></article>)}
      </div>
    </section>

    <section className="security-section" id="security">
      <div><span><ShieldCheck/></span><small>PRIVACY FIRST</small><h2>Your study data stays yours.</h2><p>StudyOS uses authenticated user accounts, row-level security, private storage and source-aware academic records. It doesn’t need fake student analytics to make the interface look alive.</p></div>
      <div className="security-grid"><article><b>Supabase Auth</b><span>Private accounts and sessions</span></article><article><b>RLS everywhere</b><span>User-isolated academic records</span></article><article><b>Private storage</b><span>Uploaded school documents stay protected</span></article><article><b>Source provenance</b><span>Know what came from NCERT, CBSE, school or AI</span></article></div>
    </section>

    <section className="final-cta">
      <div className="cta-glow"/>
      <span><Sparkles/> STUDYOS AI</span><h2>Your academic year, finally in one intelligent system.</h2><p>Upload the documents you already receive from school. StudyOS turns them into the plan.</p><Link href="/app">Open StudyOS <ArrowRight/></Link>
    </section>

    <footer className="landing-footer"><Link href="/" className="landing-logo"><span><Sparkles size={16}/></span><b>StudyOS <em>AI</em></b></Link><p>Personal Academic Operating System</p><small>© 2026 StudyOS AI</small></footer>
  </main>
}