'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity, react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, Bell, BookOpen, Brain, CalendarDays, Check, ChevronRight, Clock3,
  FileText, Flame, FolderOpen, Library, Loader2, LogOut, Menu, Moon, Play,
  RefreshCw, Search, Send, Settings, Sparkles, Sun, Target, Upload, X,
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

type View = 'Home'|'Today'|'Subjects'|'Library'|'Syllabus'|'Exams'|'Revision'|'Papers'|'Analytics'|'Documents'|'Resources';
type Row = Record<string, any>;

type Workspace = {
  profile: Row | null;
  subjects: Row[];
  books: Row[];
  chapters: Row[];
  exams: Row[];
  syllabus: Row[];
  progress: Row[];
  revisions: Row[];
  recommendations: Row[];
  plans: Row[];
  planItems: Row[];
  sessions: Row[];
  documents: Row[];
  papers: Row[];
  resources: Row[];
  extractions: Row[];
  blueprints: Row[];
};

const emptyWorkspace: Workspace = {
  profile:null, subjects:[], books:[], chapters:[], exams:[], syllabus:[], progress:[],
  revisions:[], recommendations:[], plans:[], planItems:[], sessions:[], documents:[],
  papers:[], resources:[], extractions:[], blueprints:[]
};

const nav: Array<[View, any]> = [
  ['Home',Sparkles],['Today',CalendarDays],['Subjects',BookOpen],['Library',Library],
  ['Syllabus',Target],['Exams',FileText],['Revision',Brain],['Papers',FolderOpen],
  ['Analytics',BarChart3],['Documents',Upload],['Resources',Library],
];

function pct(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}
function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(new Date(value));
}
function dateKey(value: string) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date(value));
}
function daysUntil(value?: string) {
  if (!value) return null;
  const now = new Date();
  const then = new Date(value);
  return Math.max(0, Math.ceil((then.getTime()-now.getTime())/86400000));
}
function reasons(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

async function loadWorkspace(userId: string): Promise<Workspace> {
  const supabase = getSupabaseClient();
  if (!supabase) return emptyWorkspace;

  const profileRes = await supabase.from('profiles').select('*').eq('id',userId).maybeSingle();
  const profile = profileRes.data ?? null;

  const [
    subjectsRes, examsRes, syllabusRes, progressRes, revisionsRes, recommendationsRes,
    plansRes, planItemsRes, sessionsRes, documentsRes, papersRes, resourcesRes, extractionsRes, blueprintsRes
  ] = await Promise.all([
    supabase.from('subjects').select('*').order('sort_order'),
    supabase.from('exams').select('*').order('exam_date'),
    supabase.from('exam_syllabus_items').select('*').order('priority_score',{ascending:false}),
    supabase.from('chapter_progress').select('*').order('updated_at',{ascending:false}),
    supabase.from('revision_schedule').select('*').eq('status','due').order('due_at'),
    supabase.from('study_recommendations').select('*').eq('status','active').order('priority_score',{ascending:false}),
    supabase.from('daily_plans').select('*').order('plan_date',{ascending:false}).limit(14),
    supabase.from('daily_plan_items').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('study_sessions').select('*').order('started_at',{ascending:false}).limit(250),
    supabase.from('documents').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('question_papers').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('study_resources').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('document_extractions').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('exam_blueprints').select('*').order('created_at',{ascending:false}).limit(100),
  ]);

  let books: Row[] = [];
  let chapters: Row[] = [];
  if (profile?.class_level && profile?.board) {
    const b = await supabase.from('curriculum_books').select('*')
      .eq('class_level',profile.class_level).eq('board',profile.board)
      .eq('status','current').order('subject');
    books = b.data ?? [];
    if (books.length) {
      const c = await supabase.from('curriculum_chapters').select('*')
        .in('curriculum_book_id',books.map((x:any)=>x.id)).order('sort_order');
      chapters = c.data ?? [];
    }
  }

  return {
    profile,
    subjects: subjectsRes.data ?? [],
    books,
    chapters,
    exams: examsRes.data ?? [],
    syllabus: syllabusRes.data ?? [],
    progress: progressRes.data ?? [],
    revisions: revisionsRes.data ?? [],
    recommendations: recommendationsRes.data ?? [],
    plans: plansRes.data ?? [],
    planItems: planItemsRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    documents: documentsRes.data ?? [],
    papers: papersRes.data ?? [],
    resources: resourcesRes.data ?? [],
    extractions: extractionsRes.data ?? [],
    blueprints: blueprintsRes.data ?? [],
  };
}

export default function ConnectedStudyOS() {
  const supabase = getSupabaseClient();
  const [session,setSession] = useState<any>(null);
  const [workspace,setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loading,setLoading] = useState(true);
  const [view,setView] = useState<View>('Home');
  const [dark,setDark] = useState(false);
  const [error,setError] = useState('');
  const [toast,setToast] = useState('');
  const [assistant,setAssistant] = useState(false);
  const [assistantInput,setAssistantInput] = useState('');
  const [assistantMessages,setAssistantMessages] = useState<Array<{role:'user'|'ai';text:string}>>([]);
  const [focus,setFocus] = useState<Row|null>(null);
  const [focusSeconds,setFocusSeconds] = useState(0);
  const [focusRunning,setFocusRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async()=>{
    if (!session?.user?.id) return;
    setLoading(true);
    setError('');
    try { setWorkspace(await loadWorkspace(session.user.id)); }
    catch (e:any) { setError(e?.message || 'Could not load StudyOS data.'); }
    finally { setLoading(false); }
  },[session?.user?.id]);

  useEffect(()=>{
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({data})=>{ setSession(data.session); setLoading(false); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return ()=>subscription.unsubscribe();
  },[supabase]);

  useEffect(()=>{ if (session?.user?.id) refresh(); else setWorkspace(emptyWorkspace); },[session?.user?.id,refresh]);

  useEffect(()=>{
    if (!focusRunning) return;
    const id = setInterval(()=>setFocusSeconds(x=>x+1),1000);
    return ()=>clearInterval(id);
  },[focusRunning]);

  useEffect(()=>{
    if (!toast) return;
    const id=setTimeout(()=>setToast(''),2600);
    return()=>clearTimeout(id);
  },[toast]);

  const subjectMap = useMemo(()=>new Map(workspace.subjects.map(s=>[s.id,s])),[workspace.subjects]);
  const chapterMap = useMemo(()=>new Map(workspace.chapters.map(c=>[c.id,c])),[workspace.chapters]);
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
  const todaysPlan = workspace.planItems.filter(i=>{
    const plan = workspace.plans.find(p=>p.id===i.daily_plan_id);
    return plan?.plan_date===today;
  }).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0));

  const nextExam = workspace.exams.find(e=>new Date(e.exam_date).getTime()>=Date.now()) ?? null;
  const dueRevision = workspace.revisions[0] ?? null;
  const topRecommendation = workspace.recommendations[0] ?? null;
  const topPlan = todaysPlan.find(i=>!['done','skipped'].includes(i.status)) ?? null;
  const studyNext = topRecommendation ?? (dueRevision ? {
    title: chapterMap.get(dueRevision.chapter_id)?.title || 'Revision due',
    recommendation_type:'revise',
    estimated_minutes:10,
    subject_id:dueRevision.subject_id,
    chapter_id:dueRevision.chapter_id,
    reason:['Spaced revision is due']
  } : topPlan);

  const streak = useMemo(()=>{
    const days = Array.from(new Set(workspace.sessions.filter(s=>Number(s.duration_minutes)>0).map(s=>dateKey(s.started_at)))).sort().reverse();
    let count=0;
    const cursor=new Date();
    for(let i=0;i<370;i++){
      const key = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(cursor);
      if(days.includes(key)) count++;
      else if(i>0) break;
      cursor.setDate(cursor.getDate()-1);
    }
    return count;
  },[workspace.sessions]);

  const weekMinutes = useMemo(()=>{
    const cutoff=Date.now()-7*86400000;
    return workspace.sessions.filter(s=>new Date(s.started_at).getTime()>=cutoff)
      .reduce((n,s)=>n+Number(s.duration_minutes||0),0);
  },[workspace.sessions]);

  const subjectTime = useMemo(()=>{
    const cutoff=Date.now()-7*86400000;
    const data = new Map<string,number>();
    workspace.sessions.filter(s=>new Date(s.started_at).getTime()>=cutoff).forEach(s=>{
      const name=subjectMap.get(s.subject_id)?.name || 'Unassigned';
      data.set(name,(data.get(name)||0)+Number(s.duration_minutes||0));
    });
    return [...data.entries()].sort((a,b)=>b[1]-a[1]);
  },[workspace.sessions,subjectMap]);

  async function authFetch(path: string, init: RequestInit = {}) {
    if (!supabase) throw new Error('Supabase is unavailable');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your session expired. Sign in again.');
    return fetch(path, {
      ...init,
      headers: {
        'Content-Type':'application/json',
        Authorization:'Bearer ' + token,
        ...(init.headers || {}),
      },
    });
  }

  async function uploadDocument(file: File) {
    if (!supabase || !session?.user?.id) return;
    const path = `${session.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    setToast('Uploading document…');
    const up = await supabase.storage.from('study-documents').upload(path,file,{upsert:false});
    if (up.error) { setError(up.error.message); return; }
    const lower=file.name.toLowerCase();
    const kind = lower.includes('syllabus')?'syllabus':lower.includes('date')?'date_sheet':lower.includes('blueprint')?'blueprint':lower.includes('paper')?'question_paper':'other';
    const ins = await supabase.from('documents').insert({
      user_id:session.user.id,file_name:file.name,storage_path:path,kind,
      processing_status:'uploaded',mime_type:file.type||null,size_bytes:file.size
    }).select('id').single();
    if (ins.error || !ins.data) { setError(ins.error?.message || 'Could not save document'); return; }
    setToast('Reading document with StudyOS AI…');
    const response = await authFetch('/api/documents/extract',{
      method:'POST',
      body:JSON.stringify({documentId:ins.data.id}),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setError(payload.error || 'Document extraction failed'); await refresh(); return; }
    setToast('Extraction ready for review.');
    await refresh();
  }

  async function confirmExtraction(extractionId:string, examId?:string) {
    setToast('Confirming extracted academic data…');
    const response = await authFetch('/api/documents/confirm',{
      method:'POST',
      body:JSON.stringify({extractionId,examId}),
    });
    const payload = await response.json() as { error?: string };
    if(!response.ok){setError(payload.error || 'Could not confirm extraction');return;}
    setToast('Academic data confirmed and connected.');
    await refresh();
  }

  async function generatePaper(examId:string, subjectId?:string) {
    setToast('Generating and validating practice paper…');
    const response = await authFetch('/api/papers/generate',{
      method:'POST',
      body:JSON.stringify({examId,subjectId}),
    });
    const payload = await response.json() as { error?: string };
    if(!response.ok){setError(payload.error || 'Paper generation failed');return;}
    setToast('Practice paper generated and validated.');
    await refresh();
  }

  async function setPlanStatus(item:Row,status:string){
    if(!supabase) return;
    const r=await supabase.from('daily_plan_items').update({status}).eq('id',item.id);
    if(r.error){setError(r.error.message);return;}
    setToast('Plan updated.');
    await refresh();
  }

  async function finishFocus(){
    if(!supabase||!session?.user?.id||!focus)return;
    const minutes=Math.max(1,Math.round(focusSeconds/60));
    const r=await supabase.from('study_sessions').insert({
      user_id:session.user.id,
      subject_id:focus.subject_id||null,
      task_id:null,
      goal:focus.title||'Study session',
      started_at:new Date(Date.now()-focusSeconds*1000).toISOString(),
      ended_at:new Date().toISOString(),
      duration_minutes:minutes,
      questions_solved:0
    });
    if(r.error){setError(r.error.message);return;}
    if(focus.id && focus.daily_plan_id) await supabase.from('daily_plan_items').update({status:'done'}).eq('id',focus.id);
    setFocus(null); setFocusSeconds(0); setFocusRunning(false);
    setToast(`${minutes} minute study session saved.`);
    await refresh();
  }

  function assistantAnswer(q:string){
    const text=q.toLowerCase();
    if(text.includes('next exam')||text.includes('exam')){
      if(!nextExam)return 'You do not have a confirmed upcoming exam in StudyOS yet. Upload a date sheet or add an exam first.';
      return `${nextExam.name} is your next exam on ${formatDate(nextExam.exam_date)} (${daysUntil(nextExam.exam_date)} days left). I am using only the exam records stored in your workspace.`;
    }
    if(text.includes('revise')){
      if(!dueRevision)return 'Nothing is currently in your due revision queue.';
      return `${chapterMap.get(dueRevision.chapter_id)?.title || 'A saved chapter'} is due for revision now. The current stage is R${dueRevision.stage ?? 1}.`;
    }
    if(text.includes('weak')){
      const weak=[...workspace.progress].sort((a,b)=>Number(a.mastery||0)-Number(b.mastery||0))[0];
      if(!weak)return 'There is not enough mastery evidence yet to name a weak chapter. Complete a study session or assessment first.';
      return `${chapterMap.get(weak.chapter_id)?.title || 'Your lowest-evidence chapter'} currently has the lowest recorded mastery at ${pct(weak.mastery)}%.`;
    }
    if(studyNext){
      return `Your highest-value next action is “${studyNext.title || chapterMap.get(studyNext.chapter_id)?.title || 'Study session'}”. ${reasons(studyNext.reason).join(' ') || 'It is currently the highest-priority real item in your StudyOS data.'}`;
    }
    return 'I do not have enough study evidence yet. Add your syllabus/date sheet or start a study session, and I will base recommendations on that data.';
  }

  function askAssistant(){
    const q=assistantInput.trim(); if(!q)return;
    setAssistantMessages(m=>[...m,{role:'user',text:q},{role:'ai',text:assistantAnswer(q)}]);
    setAssistantInput('');
  }

  if (!isSupabaseConfigured) return <SetupRequired/>;
  if (loading && !session) return <Splash label="Connecting to StudyOS…"/>;
  if (!session) return <AuthScreen/>;
  if (loading) return <Splash label="Loading your academic workspace…"/>;
  if (!workspace.profile?.onboarding_completed) return <Onboarding userId={session.user.id} onDone={refresh}/>;

  const initials=(workspace.profile.full_name||session.user.email||'S').split(/\s+/).map((x:string)=>x[0]).slice(0,2).join('').toUpperCase();

  return <main className={`connected-app ${dark?'dark':''}`}>
    <input ref={fileRef} type="file" accept=".pdf,image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)uploadDocument(f);e.currentTarget.value='';}}/>
    <aside className="connected-sidebar">
      <div className="connected-brand"><span><Sparkles size={18}/></span><b>StudyOS <em>AI</em></b></div>
      <p className="connected-nav-label">Command center</p>
      <nav>{nav.map(([label,Icon])=><button key={label} className={view===label?'active':''} onClick={()=>setView(label)}><Icon size={18}/><span>{label}</span>{label==='Revision'&&workspace.revisions.length>0?<i>{workspace.revisions.length}</i>:null}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <button onClick={()=>setAssistant(true)}><Sparkles size={18}/><span>StudyOS Assistant</span></button>
      <button><Settings size={18}/><span>Settings</span></button>
      <div className="connected-profile"><span>{initials}</span><div><b>{workspace.profile.full_name}</b><small>Class {workspace.profile.class_level} · {workspace.profile.board}</small></div><button onClick={()=>supabase?.auth.signOut()} aria-label="Sign out"><LogOut size={16}/></button></div>
    </aside>

    <section className="connected-main">
      <header className="connected-topbar">
        <button className="mobile-menu"><Menu size={20}/></button>
        <button className="smart-search" onClick={()=>setAssistant(true)}><Search size={17}/><span>Ask StudyOS about your real study data…</span><kbd>⌘ K</kbd></button>
        <div className="top-actions"><span className="live-pill">LIVE DATA</span><button onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button><Bell size={17}/></button><span className="top-avatar">{initials}</span></div>
      </header>

      <div className="connected-content">
        {error&&<div className="error-banner"><span>{error}</span><button onClick={()=>setError('')}><X size={15}/></button></div>}
        {view==='Home'&&<Home workspace={workspace} studyNext={studyNext} nextExam={nextExam} streak={streak} weekMinutes={weekMinutes} subjectMap={subjectMap} chapterMap={chapterMap} start={(item)=>{setFocus(item);setFocusSeconds(0);setFocusRunning(true)}} upload={()=>fileRef.current?.click()}/>}
        {view==='Today'&&<Today items={todaysPlan} subjectMap={subjectMap} chapterMap={chapterMap} setStatus={setPlanStatus} start={(item)=>{setFocus(item);setFocusSeconds(0);setFocusRunning(true)}}/>}
        {view==='Subjects'&&<Subjects workspace={workspace}/>}
        {view==='Library'&&<LibraryView workspace={workspace}/>}
        {view==='Syllabus'&&<Syllabus workspace={workspace} subjectMap={subjectMap} chapterMap={chapterMap} upload={()=>fileRef.current?.click()}/>}
        {view==='Exams'&&<Exams workspace={workspace} subjectMap={subjectMap}/>}
        {view==='Revision'&&<Revision workspace={workspace} chapterMap={chapterMap} start={(item)=>{setFocus(item);setFocusSeconds(0);setFocusRunning(true)}}/>}
        {view==='Papers'&&<Papers workspace={workspace} subjectMap={subjectMap} generate={generatePaper}/>}
        {view==='Analytics'&&<Analytics workspace={workspace} subjectTime={subjectTime} weekMinutes={weekMinutes}/>}
        {view==='Documents'&&<Documents workspace={workspace} upload={()=>fileRef.current?.click()} confirm={confirmExtraction}/>}
        {view==='Resources'&&<Resources workspace={workspace}/>}
      </div>
    </section>

    <button className="assistant-orb" onClick={()=>setAssistant(true)}><Sparkles size={18}/><span>Ask StudyOS</span></button>
    {toast&&<div className="connected-toast"><Check size={15}/>{toast}</div>}

    {focus&&<div className="connected-overlay"><section className="focus-card">
      <button className="close-button" onClick={()=>{setFocus(null);setFocusRunning(false)}}><X/></button>
      <span className="focus-eyebrow">DEEP FOCUS</span>
      <h2>{focus.title || chapterMap.get(focus.chapter_id)?.title || 'Study session'}</h2>
      <p>{subjectMap.get(focus.subject_id)?.name || 'Academic session'}</p>
      <strong>{String(Math.floor(focusSeconds/60)).padStart(2,'0')}:{String(focusSeconds%60).padStart(2,'0')}</strong>
      <div><button onClick={()=>setFocusRunning(v=>!v)}><Play size={16}/>{focusRunning?'Pause':'Resume'}</button><button className="secondary" onClick={finishFocus}><Check size={16}/>Finish & save</button></div>
    </section></div>}

    {assistant&&<aside className="connected-assistant">
      <header><span className="assistant-mark"><Sparkles size={17}/></span><div><b>StudyOS Intelligence</b><small>Grounded in your saved academic data</small></div><button onClick={()=>setAssistant(false)}><X size={18}/></button></header>
      <div className="assistant-feed">
        {assistantMessages.length===0&&<div className="assistant-empty"><Sparkles/><h3>Ask about your studies</h3><p>Try “What should I study next?”, “What is weak?”, “What should I revise?”, or “Next exam?”.</p></div>}
        {assistantMessages.map((m,i)=><div key={i} className={`assistant-message ${m.role}`}>{m.text}</div>)}
      </div>
      <div className="assistant-compose"><input value={assistantInput} onChange={e=>setAssistantInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAssistant()} placeholder="Ask StudyOS…"/><button onClick={askAssistant}><Send size={17}/></button></div>
    </aside>}
  </main>;
}

function Splash({label}:{label:string}){return <main className="connected-splash"><span><Sparkles size={24}/></span><Loader2 className="spin"/><b>{label}</b></main>}

function SetupRequired(){
  return <main className="setup-page"><section><span className="assistant-mark"><Sparkles/></span><h1>Connect StudyOS to Supabase</h1><p>This build intentionally refuses to show fabricated student data. Add the real project URL and publishable key to the deployment environment.</p><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></section></main>
}

function AuthScreen(){
  const supabase=getSupabaseClient();
  const [mode,setMode]=useState<'signin'|'signup'>('signin');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function submit(e:React.FormEvent){
    e.preventDefault(); if(!supabase)return; setBusy(true); setMessage('');
    const r=mode==='signin'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});
    if(r.error)setMessage(r.error.message); else if(mode==='signup'&&!r.data.session)setMessage('Account created. Check your email if confirmation is enabled.');
    setBusy(false);
  }
  async function magic(){
    if(!supabase||!email)return;
    setBusy(true); const r=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin}});
    setMessage(r.error?r.error.message:'Magic link sent.'); setBusy(false);
  }
  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><Sparkles/> StudyOS AI</div><div><span>PERSONAL ACADEMIC OS</span><h1>Know exactly what to study next.</h1><p>Real syllabus. Real datesheets. Real progress. No fake dashboards.</p></div></section><section className="auth-form"><form onSubmit={submit}><span className="assistant-mark"><Sparkles/></span><h2>{mode==='signin'?'Welcome back':'Create your StudyOS'}</h2><p>{mode==='signin'?'Continue your academic command center.':'Build your private study workspace.'}</p><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>{message&&<div className="form-message">{message}</div>}<button disabled={busy}>{busy?<Loader2 className="spin"/>:null}{mode==='signin'?'Sign in':'Create account'}</button><button type="button" className="secondary-auth" onClick={magic}>Email me a magic link</button><small>{mode==='signin'?'New to StudyOS?':'Already have an account?'} <button type="button" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Create account':'Sign in'}</button></small></form></section></main>
}

function Onboarding({userId,onDone}:{userId:string;onDone:()=>Promise<void>}){
  const supabase=getSupabaseClient();
  const [name,setName]=useState('');
  const [classLevel,setClassLevel]=useState(8);
  const [board,setBoard]=useState('CBSE');
  const [session,setSession]=useState('2026-27');
  const [school,setSchool]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function save(e:React.FormEvent){
    e.preventDefault();if(!supabase)return;setBusy(true);setError('');
    const p=await supabase.from('profiles').upsert({id:userId,full_name:name,class_level:classLevel,board,academic_session:session,school_name:school||null,onboarding_completed:true},{onConflict:'id'});
    if(p.error){setError(p.error.message);setBusy(false);return;}
    const b=await supabase.from('curriculum_books').select('subject').eq('board',board).eq('class_level',classLevel).eq('status','current');
    const names=Array.from(new Set((b.data??[]).map((x:any)=>x.subject))).filter(Boolean);
    if(names.length){
      const rows=names.map((n:any,i)=>({user_id:userId,name:n,sort_order:i}));
      const s=await supabase.from('subjects').upsert(rows,{onConflict:'user_id,name'});
      if(s.error){setError(s.error.message);setBusy(false);return;}
    }
    setBusy(false);await onDone();
  }
  return <main className="onboarding-page"><section><span className="assistant-mark"><Sparkles/></span><span className="onboarding-kicker">SET UP YOUR ACADEMIC OS</span><h1>Build your StudyOS workspace</h1><p>We use this only to load the correct verified curriculum and personalize your study planning.</p><form onSubmit={save}><label>Your name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label><div className="form-grid"><label>Class<select value={classLevel} onChange={e=>setClassLevel(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>Class {n}</option>)}</select></label><label>Board<select value={board} onChange={e=>setBoard(e.target.value)}><option>CBSE</option><option>ICSE</option><option>State Board</option><option>IB</option><option>Cambridge</option><option>Custom</option></select></label></div><div className="form-grid"><label>Academic session<input value={session} onChange={e=>setSession(e.target.value)}/></label><label>School (optional)<input value={school} onChange={e=>setSchool(e.target.value)}/></label></div>{error&&<div className="form-message">{error}</div>}<button disabled={busy}>{busy?<Loader2 className="spin"/>:<Sparkles/>}Build my StudyOS</button></form></section></main>
}

function SectionHead({eyebrow,title,copy,action}:{eyebrow:string;title:string;copy:string;action?:React.ReactNode}){return <header className="section-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</header>}
function Empty({icon:Icon,title,copy,action}:{icon:any;title:string;copy:string;action?:React.ReactNode}){return <div className="connected-empty"><span><Icon/></span><h3>{title}</h3><p>{copy}</p>{action}</div>}

function Home({workspace,studyNext,nextExam,streak,weekMinutes,subjectMap,chapterMap,start,upload}:any){
  const completed=workspace.planItems.filter((x:Row)=>x.status==='done').length;
  const total=workspace.planItems.length;
  const completion=workspace.progress.length?Math.round(workspace.progress.reduce((n:number,x:Row)=>n+Number(x.completion||0),0)/workspace.progress.length):null;
  return <><SectionHead eyebrow={new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date())} title={`Good to see you, ${workspace.profile.full_name.split(' ')[0]}`} copy="Your command center uses only data stored in your StudyOS workspace." action={<button className="premium-button" onClick={()=>studyNext&&start(studyNext)} disabled={!studyNext}><Play size={16}/>Study next</button>}/><section className="hero-intelligence"><div className="hero-copy"><span><Sparkles size={14}/> STUDYOS PRIORITY</span>{studyNext?<><h2>{studyNext.title || chapterMap.get(studyNext.chapter_id)?.title || 'Your next study action'}</h2><p>{reasons(studyNext.reason).join(' ') || 'This is currently the highest-priority verified item in your workspace.'}</p><div><button onClick={()=>start(studyNext)}><Play size={16}/>Start now</button><small>{studyNext.estimated_minutes?studyNext.estimated_minutes+' min':''}</small></div></>:<><h2>Build your first intelligent recommendation</h2><p>Upload your school syllabus or date sheet, then StudyOS can prioritize real chapters and exams.</p><button onClick={upload}><Upload size={16}/>Upload academic PDF</button></>}</div><div className="hero-exam">{nextExam?<><span>Next exam</span><strong>{daysUntil(nextExam.exam_date)}</strong><small>days</small><b>{nextExam.name}</b><em>{formatDate(nextExam.exam_date)}</em></>:<><span>Next exam</span><strong>—</strong><small>not added</small><b>Upload your date sheet</b></>}</div></section><div className="metric-grid"><Metric icon={Clock3} label="Study time · 7 days" value={weekMinutes?Math.floor(weekMinutes/60)+'h '+weekMinutes%60+'m':'No sessions yet'} detail="Calculated from saved focus sessions"/><Metric icon={Flame} label="Current streak" value={streak?streak+' days':'Start today'} detail="Based on days with logged study"/><Metric icon={Target} label="Chapter completion" value={completion===null?'No evidence yet':completion+'%'} detail="Average across tracked chapters"/><Metric icon={Check} label="Plan completion" value={total?completed+'/'+total:'No plan yet'} detail="Saved daily plan items"/></div><div className="dashboard-grid"><section className="connected-card wide"><header><div><span>TODAY</span><h3>Your real study plan</h3></div></header>{workspace.planItems.length?workspace.planItems.slice(0,5).map((x:Row)=><div className="list-row" key={x.id}><span className="row-icon"><BookOpen/></span><div><b>{x.title}</b><small>{subjectMap.get(x.subject_id)?.name || x.activity_type || 'Study'}</small></div><em>{x.status}</em></div>):<Empty icon={CalendarDays} title="No generated plan yet" copy="Once recommendations or syllabus items exist, your daily planner can schedule them without invented tasks."/>}</section><section className="connected-card"><header><div><span>ACADEMIC DATA</span><h3>Workspace health</h3></div></header><Health label="Verified books" value={workspace.books.length}/><Health label="Syllabus items" value={workspace.syllabus.length}/><Health label="Uploaded documents" value={workspace.documents.length}/><Health label="Tracked chapters" value={workspace.progress.length}/></section></div></>;
}

function Metric({icon:Icon,label,value,detail}:any){return <section className="metric-card"><span><Icon/></span><div><small>{label}</small><b>{value}</b><p>{detail}</p></div></section>}
function Health({label,value}:{label:string;value:number}){return <div className="health-row"><span>{label}</span><b>{value}</b></div>}

function Today({items,subjectMap,chapterMap,setStatus,start}:any){return <><SectionHead eyebrow="DAILY PLAN" title="Today" copy="Only saved plan items appear here—no generated demo tasks." action={<button className="secondary-button"><RefreshCw size={16}/>Recalculate</button>}/>{items.length?<section className="connected-card plan-list">{items.map((x:Row)=><article key={x.id}><button className={x.status==='done'?'check done':'check'} onClick={()=>setStatus(x,x.status==='done'?'todo':'done')}>{x.status==='done'?<Check/>:null}</button><div><span>{subjectMap.get(x.subject_id)?.name || x.activity_type}</span><b>{x.title}</b><small>{chapterMap.get(x.chapter_id)?.title || reasons(x.reason).join(' ')}</small></div><em>{x.estimated_minutes} min</em><button onClick={()=>start(x)}><Play size={15}/></button></article>)}</section>:<Empty icon={CalendarDays} title="No plan for today" copy="Your daily plan will appear when StudyOS has enough syllabus, exam, revision, or recommendation data."/>}</>}

function Subjects({workspace}:{workspace:Workspace}){return <><SectionHead eyebrow="ACADEMIC MAP" title="Subjects" copy="Your subjects are private workspace records connected to verified curriculum books and progress."/><div className="subject-card-grid">{workspace.subjects.map(s=>{const rows=workspace.progress.filter(p=>p.subject_id===s.id);const avg=rows.length?Math.round(rows.reduce((n,p)=>n+Number(p.mastery||0),0)/rows.length):null;return <section className="connected-card subject-real" key={s.id}><header><span style={{background:s.color}}>{s.name.slice(0,2).toUpperCase()}</span><div><h3>{s.name}</h3><p>{rows.length} tracked chapter{rows.length===1?'':'s'}</p></div><ChevronRight/></header><div className="subject-metric"><span>Mastery evidence</span><b>{avg===null?'—':avg+'%'}</b></div><div className="mini-progress"><i style={{width:(avg||0)+'%',background:s.color}}/></div></section>})}</div>{!workspace.subjects.length&&<Empty icon={BookOpen} title="No subjects yet" copy="Choose your class/board in onboarding or add subjects to begin tracking."/>}</>}

function LibraryView({workspace}:{workspace:Workspace}){return <><SectionHead eyebrow="VERIFIED CURRICULUM" title="NCERT & academic library" copy="Only current curriculum records from the StudyOS academic source registry are shown. Full copyrighted book text is not copied into the app."/><div className="library-grid">{workspace.books.map(b=>{const chapters=workspace.chapters.filter(c=>c.curriculum_book_id===b.id);return <section className="connected-card book-card" key={b.id}><div className="book-cover"><BookOpen/></div><div><span>{b.subject} · Class {b.class_level}</span><h3>{b.title}</h3><p>{b.edition_label || b.academic_year}</p><small>{chapters.length?chapters.length+' verified chapters':'Chapter index awaiting verification'}</small><div className="book-actions"><a href={b.source_url} target="_blank" rel="noreferrer">Open official source</a></div></div></section>})}</div>{!workspace.books.length&&<Empty icon={Library} title="No verified books found for this profile" copy="StudyOS will not substitute guessed textbook data. An administrator must verify and publish the curriculum version first."/>}</>}

function Syllabus({workspace,subjectMap,chapterMap,upload}:any){return <><SectionHead eyebrow="SYLLABUS INTELLIGENCE" title="Exam syllabus" copy="Current exam items are compared using real stored flags such as new content, prior assessment count, blueprint weight, and priority." action={<button className="premium-button" onClick={upload}><Upload size={16}/>Upload syllabus</button>}/>{workspace.syllabus.length?<section className="connected-card data-table"><header><span>Item</span><span>Subject</span><span>State</span><span>Priority</span></header>{workspace.syllabus.map((x:Row)=><article key={x.id}><div><b>{x.label || chapterMap.get(x.chapter_id)?.title || 'Syllabus item'}</b><small>{x.is_new_content?'New in this assessment':x.prior_assessment_count?'Previously assessed':'Unclassified history'}</small></div><span>{subjectMap.get(x.subject_id)?.name || '—'}</span><span className={x.is_new_content?'state-new':'state-old'}>{x.inclusion}</span><b>{Math.round(Number(x.priority_score||0))}</b></article>)}</section>:<Empty icon={Target} title="No confirmed syllabus items" copy="Upload a syllabus PDF. StudyOS stores extracted items separately and can require confirmation before they affect planning." action={<button className="premium-button" onClick={upload}>Upload syllabus</button>}/>}</>}

function Exams({workspace,subjectMap}:{workspace:Workspace;subjectMap:Map<any,any>}){return <><SectionHead eyebrow="EXAM MODE" title="Exam roadmap" copy="Dates and marks are read from your confirmed exam records."/><div className="exam-grid">{workspace.exams.map(e=><section className="connected-card exam-card" key={e.id}><span>{subjectMap.get(e.subject_id)?.name || 'Exam'}</span><h3>{e.name}</h3><strong>{daysUntil(e.exam_date)}<small> days</small></strong><p>{formatDate(e.exam_date)}{e.maximum_marks?' · '+e.maximum_marks+' marks':''}</p><em>{e.confirmed?'Confirmed':'Needs confirmation'}</em></section>)}</div>{!workspace.exams.length&&<Empty icon={FileText} title="No upcoming exams" copy="Upload your date sheet or add an exam to unlock exam-aware planning."/>}</>}

function Revision({workspace,chapterMap,start}:any){return <><SectionHead eyebrow="SPACED REVISION" title="Revision queue" copy="Due items come directly from your revision schedule."/><div className="revision-real-grid">{workspace.revisions.map((r:Row)=><section className="connected-card revision-real" key={r.id}><span>R{r.stage || 1}</span><h3>{chapterMap.get(r.chapter_id)?.title || 'Revision item'}</h3><p>Due {formatDate(r.due_at)} · interval {r.interval_days || 0} days</p><button onClick={()=>start({title:chapterMap.get(r.chapter_id)?.title || 'Revision',subject_id:r.subject_id,chapter_id:r.chapter_id,estimated_minutes:10,reason:['Revision due']})}><Play size={15}/>Start revision</button></section>)}</div>{!workspace.revisions.length&&<Empty icon={Brain} title="Nothing due right now" copy="Revision items will appear after StudyOS schedules them from completed learning and assessment evidence."/>}</>}

function Papers({workspace,subjectMap,generate}:{workspace:Workspace;subjectMap:Map<any,any>;generate:(examId:string,subjectId?:string)=>Promise<void>}){return <><SectionHead eyebrow="QUESTION PAPER STUDIO" title="Practice papers" copy="Papers are generated only from confirmed syllabus + blueprint records, then validated before saving."/><div className="paper-generate-grid">{workspace.exams.map(exam=>{const hasBlueprint=workspace.blueprints.some(b=>b.exam_id===exam.id&&b.status==='confirmed');const hasSyllabus=workspace.syllabus.some(s=>s.exam_id===exam.id&&s.user_verified&&s.inclusion!=='excluded');return <section className="connected-card paper-generator" key={exam.id}><div><span>{subjectMap.get(exam.subject_id)?.name || 'Exam'}</span><h3>{exam.name}</h3><p>{hasSyllabus?'Syllabus confirmed':'Syllabus needed'} · {hasBlueprint?'Blueprint confirmed':'Blueprint needed'}</p></div><button disabled={!hasBlueprint||!hasSyllabus||!exam.subject_id} onClick={()=>generate(exam.id,exam.subject_id)}><Sparkles size={14}/>Generate paper</button></section>})}</div><div className="paper-grid">{workspace.papers.map(p=><section className="connected-card paper-card" key={p.id}><FileText/><div><span>{p.status}</span><h3>{p.title}</h3><p>{p.total_marks?Math.round(Number(p.total_marks))+' marks':'Marks not set'}{p.duration_minutes?' · '+p.duration_minutes+' min':''}</p></div><ChevronRight/></section>)}</div>{!workspace.exams.length&&<Empty icon={FileText} title="No exam context yet" copy="Upload and confirm your date sheet, syllabus, and blueprint first. StudyOS will not invent a paper pattern."/>}</>}

function Analytics({workspace,subjectTime,weekMinutes}:{workspace:Workspace;subjectTime:Array<[string,number]>;weekMinutes:number}){const max=Math.max(...subjectTime.map(x=>x[1]),1);return <><SectionHead eyebrow="REAL ANALYTICS" title="Your progress" copy="Every chart is computed from saved sessions and progress rows; insufficient data stays visibly empty."/><div className="analytics-real-grid"><section className="connected-card"><header><span>LAST 7 DAYS</span><h3>Study time</h3></header><div className="big-number">{weekMinutes}<small> min</small></div><p className="muted">From {workspace.sessions.filter(s=>Number(s.duration_minutes)>0).length} saved sessions.</p></section><section className="connected-card"><header><span>SUBJECT BALANCE</span><h3>Where your time went</h3></header>{subjectTime.length?subjectTime.map(([name,min])=><div className="balance-real" key={name}><span>{name}</span><div><i style={{width:(min/max*100)+'%'}}/></div><b>{min}m</b></div>):<p className="muted">Not enough session data yet.</p>}</section><section className="connected-card analytics-wide"><header><span>MASTERY EVIDENCE</span><h3>Tracked chapters</h3></header>{workspace.progress.length?<div className="progress-grid">{workspace.progress.slice(0,12).map(p=><div key={p.id}><span>{pct(p.mastery)}%</span><div><i style={{height:pct(p.mastery)+'%'}}/></div><small>{pct(p.completion)}% done</small></div>)}</div>:<p className="muted">No chapter mastery evidence yet.</p>}</section></div></>}

function Documents({workspace,upload,confirm}:{workspace:Workspace;upload:()=>void;confirm:(extractionId:string,examId?:string)=>Promise<void>}){const [examChoice,setExamChoice]=useState<Record<string,string>>({});return <><SectionHead eyebrow="ACADEMIC DOCUMENTS" title="Document center" copy="Upload → AI extraction → review → confirm. Nothing changes your plan before approval." action={<button className="premium-button" onClick={upload}><Upload size={16}/>Upload document</button>}/><button className="drop-zone-real" onClick={upload}><Upload/><b>Upload syllabus, date sheet, blueprint, previous paper, worksheet, or notes</b><span>PDF, JPG, PNG · private storage · AI review-first extraction</span></button>{workspace.extractions.filter(x=>x.status==='needs_confirmation').map(ex=>{const needsExam=ex.extraction_type==='syllabus'||ex.extraction_type==='blueprint';const payload=(ex.payload||{}) as Row;return <section className="connected-card extraction-review" key={ex.id}><div><span>READY TO REVIEW · {Math.round(Number(ex.confidence||0)*100)}% confidence</span><h3>{String(ex.extraction_type).replaceAll('_',' ')}</h3><p>{payload.summary || 'Review the extracted structure before it changes StudyOS.'}</p></div>{needsExam?<select value={examChoice[ex.id]||''} onChange={e=>setExamChoice(v=>({...v,[ex.id]:e.target.value}))}><option value="">Choose target exam…</option>{workspace.exams.map(e=><option key={e.id} value={e.id}>{e.name} · {formatDate(e.exam_date)}</option>)}</select>:null}<button disabled={needsExam&&!examChoice[ex.id]} onClick={()=>confirm(ex.id,examChoice[ex.id]||undefined)}><Check size={14}/>Confirm extraction</button></section>})}{workspace.documents.length?<section className="connected-card data-table documents-real"><header><span>File</span><span>Kind</span><span>Status</span><span>Added</span></header>{workspace.documents.map(d=><article key={d.id}><div><b>{d.file_name}</b><small>{d.mime_type || 'document'}</small></div><span>{d.kind}</span><span>{d.processing_status}</span><b>{formatDate(d.created_at)}</b></article>)}</section>:null}</>}

function Resources({workspace}:{workspace:Workspace}){return <><SectionHead eyebrow="LEARNING LIBRARY" title="Resources" copy="Your own notes, videos, worksheets, websites, and papers can be linked to real subjects, chapters, and topics."/><div className="resource-real-grid">{workspace.resources.map(r=><section className="connected-card resource-real" key={r.id}><span><Library/></span><div><small>{r.resource_type}</small><h3>{r.title}</h3><p>{r.source_label || 'Personal resource'}</p>{r.url?<a href={r.url} target="_blank" rel="noreferrer">Open resource</a>:null}</div></section>)}</div>{!workspace.resources.length&&<Empty icon={Library} title="No resources saved" copy="Add your own study material and StudyOS will keep it tied to the correct academic context."/>}</>}