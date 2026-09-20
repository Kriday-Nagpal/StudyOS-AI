'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity, react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, Bell, BookOpen, Brain, CalendarDays, Check, ChevronRight, Clock3,
  FileText, Flame, FolderOpen, Library, ListPlus, Loader2, LockKeyhole, LogOut, Menu, Moon, Play,
  Plus, RotateCcw, Search, Send, Settings, Sparkles, Sun, Target, Timer, Upload, Video, X,
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import StudyOSAuth from '@/components/auth/studyos-auth';
import StudyOSLogo, { StudyOSMark } from '@/components/studyos-logo';

type View = 'Home'|'Today'|'Focus'|'Learning'|'Subjects'|'Library'|'Syllabus'|'Exams'|'Revision'|'Papers'|'Analytics'|'Documents'|'Resources'|'Settings';
type Row = Record<string, any>;

type Workspace = {
  profile: Row | null;
  subjects: Row[];
  books: Row[];
  chapters: Row[];
  topics: Row[];
  videos: Row[];
  videoProgress: Row[];
  trackingSessions: Row[];
  notificationPreferences: Row | null;
  flashcards: Row[];
  flashcardReviews: Row[];
  doubts: Row[];
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
  profile:null, subjects:[], books:[], chapters:[], topics:[], videos:[], videoProgress:[], trackingSessions:[], notificationPreferences:null, flashcards:[], flashcardReviews:[], doubts:[], exams:[], syllabus:[], progress:[],
  revisions:[], recommendations:[], plans:[], planItems:[], sessions:[], documents:[],
  papers:[], resources:[], extractions:[], blueprints:[]
};

const nav: Array<[View, any]> = [
  ['Home',Sparkles],['Today',CalendarDays],['Focus',Timer],['Learning',Video],['Subjects',BookOpen],['Library',Library],
  ['Syllabus',Target],['Exams',FileText],['Revision',Brain],['Papers',FolderOpen],
  ['Analytics',BarChart3],['Documents',Upload],['Resources',Library],
];

const CORE_CLASS8_SUBJECTS = [
  {name:'English',color:'#7768e8'},
  {name:'Hindi',color:'#e98954'},
  {name:'Mathematics',color:'#4f8bd8'},
  {name:'Science',color:'#46a873'},
  {name:'Social Science',color:'#c47a42'},
  {name:'Sanskrit',color:'#9a63d7'},
] as const;

const SUBJECT_COLOR_POOL = ['#7768e8','#4f8bd8','#46a873','#e98954','#9a63d7','#d35f78','#4aa6a6','#9a8748'];

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

function normalized(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');
}
function stableNumber(value: string) {
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return Math.abs(hash>>>0);
}
function providerForUrl(value: string) {
  try {
    const host=new URL(value).hostname.toLowerCase();
    if(host.includes('youtube.com')||host==='youtu.be') return 'youtube';
    if(host.includes('diksha.gov.in')) return 'diksha';
    if(host.includes('khanacademy.org')) return 'khan_academy';
    return 'other';
  } catch { return 'other'; }
}
function providerLabel(video: Row) {
  const url=String(video?.url||'').toLowerCase();
  if(video?.provider==='youtube'||url.includes('youtube.com')||url.includes('youtu.be')) return 'YouTube';
  if(url.includes('pw.live')||url.includes('physicswallah')||url.includes('pwskills')) return 'Physics Wallah';
  if(video?.provider==='diksha'||url.includes('diksha.gov.in')) return 'DIKSHA';
  if(video?.provider==='khan_academy'||url.includes('khanacademy.org')) return 'Khan Academy';
  if(video?.provider==='school') return 'School';
  return 'Other';
}

async function loadWorkspace(userId: string): Promise<Workspace> {
  const supabase = getSupabaseClient();
  if (!supabase) return emptyWorkspace;

  const profileRes = await supabase.from('profiles').select('*').eq('id',userId).maybeSingle();
  const profile = profileRes.data ?? null;

  const [
    subjectsRes, examsRes, syllabusRes, progressRes, revisionsRes, recommendationsRes,
    plansRes, planItemsRes, sessionsRes, documentsRes, papersRes, resourcesRes, extractionsRes, blueprintsRes,
    videosRes, videoProgressRes, trackingSessionsRes, notificationPreferencesRes, flashcardsRes, flashcardReviewsRes, doubtsRes
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
    supabase.from('videos').select('*').order('created_at',{ascending:false}).limit(250),
    supabase.from('video_progress').select('*').order('updated_at',{ascending:false}).limit(250),
    supabase.from('video_tracking_sessions').select('*').order('last_event_at',{ascending:false}).limit(250),
    supabase.from('notification_preferences').select('*').eq('user_id',userId).maybeSingle(),
    supabase.from('flashcards').select('*').order('created_at',{ascending:false}).limit(500),
    supabase.from('flashcard_reviews').select('*').order('reviewed_at',{ascending:false}).limit(1000),
    supabase.from('doubts').select('*').eq('status','unresolved').order('created_at',{ascending:false}).limit(250),
  ]);

  let subjects: Row[] = subjectsRes.data ?? [];
  if (profile?.class_level === 8 && String(profile?.board || '').toUpperCase() === 'CBSE') {
    const existing = new Set(subjects.map((s:Row)=>String(s.name).toLowerCase()));
    const missing = CORE_CLASS8_SUBJECTS.filter(s=>!existing.has(s.name.toLowerCase()));
    if (missing.length) {
      await supabase.from('subjects').upsert(
        missing.map((s,i)=>({user_id:userId,name:s.name,color:s.color,sort_order:subjects.length+i})),
        {onConflict:'user_id,name'}
      );
      const refreshed = await supabase.from('subjects').select('*').order('sort_order');
      subjects = refreshed.data ?? subjects;
    }
  }

  let books: Row[] = [];
  let chapters: Row[] = [];
  let topics: Row[] = [];
  if (profile?.class_level && profile?.board) {
    const b = await supabase.from('curriculum_books').select('*')
      .eq('class_level',profile.class_level).eq('board',profile.board)
      .eq('status','current').order('subject');
    books = b.data ?? [];
    if (books.length) {
      const c = await supabase.from('curriculum_chapters').select('*')
        .in('curriculum_book_id',books.map((x:any)=>x.id)).order('sort_order');
      chapters = c.data ?? [];
      if (chapters.length) {
        const t = await supabase.from('curriculum_topics').select('*')
          .in('chapter_id',chapters.map((x:any)=>x.id)).order('sort_order');
        topics = t.data ?? [];
      }
    }
  }

  return {
    profile,
    subjects,
    books,
    chapters,
    topics,
    videos: videosRes.data ?? [],
    videoProgress: videoProgressRes.data ?? [],
    trackingSessions: trackingSessionsRes.data ?? [],
    notificationPreferences: notificationPreferencesRes.data ?? null,
    flashcards: flashcardsRes.data ?? [],
    flashcardReviews: flashcardReviewsRes.data ?? [],
    doubts: doubtsRes.data ?? [],
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
  const [subjectsPerDay,setSubjectsPerDay] = useState(2);
  const [error,setError] = useState('');
  const [toast,setToast] = useState('');
  const [assistant,setAssistant] = useState(false);
  const [assistantInput,setAssistantInput] = useState('');
  const [assistantMessages,setAssistantMessages] = useState<Array<{role:'user'|'ai';text:string}>>([]);
  const [focus,setFocus] = useState<Row|null>(null);
  const [focusSeconds,setFocusSeconds] = useState(0);
  const [focusTargetSeconds,setFocusTargetSeconds] = useState(25*60);
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
    const theme=window.localStorage.getItem('studyos-theme');
    const count=Number(window.localStorage.getItem('studyos-subjects-per-day')||2);
    setDark(theme==='dark');
    setSubjectsPerDay(Number.isFinite(count)?Math.max(2,Math.min(6,count)):2);
  },[]);

  useEffect(()=>{window.localStorage.setItem('studyos-theme',dark?'dark':'light')},[dark]);

  useEffect(()=>{
    const requested=new URL(window.location.href).searchParams.get('view') as View | null;
    const allowed=new Set<View>([...nav.map(([label])=>label),'Settings']);
    if(requested&&allowed.has(requested))setView(requested);
  },[]);
  useEffect(()=>{window.localStorage.setItem('studyos-subjects-per-day',String(subjectsPerDay))},[subjectsPerDay]);

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

  const studyMode: 'general'|'exam' = workspace.profile?.study_mode==='exam'?'exam':'general';
  const upcomingExams = [...workspace.exams].filter(e=>new Date(e.exam_date).getTime()>=Date.now()).sort((a,b)=>new Date(a.exam_date).getTime()-new Date(b.exam_date).getTime());
  const nextExam = upcomingExams[0] ?? null;
  const dueRevision = workspace.revisions[0] ?? null;
  const topRecommendation = workspace.recommendations[0] ?? null;
  const topPlan = todaysPlan.find(i=>!['done','skipped'].includes(i.status)) ?? null;

  const recentMinutesBySubject = useMemo(()=>{
    const cutoff=Date.now()-7*86400000;
    const data = new Map<string,number>();
    workspace.sessions.filter(s=>new Date(s.started_at).getTime()>=cutoff).forEach(s=>{
      if(!s.subject_id) return;
      data.set(s.subject_id,(data.get(s.subject_id)||0)+Number(s.duration_minutes||0));
    });
    return data;
  },[workspace.sessions]);

  const generalSubject = useMemo(()=>{
    if(!workspace.subjects.length) return null;
    return [...workspace.subjects].sort((a,b)=>{
      const diff=(recentMinutesBySubject.get(a.id)||0)-(recentMinutesBySubject.get(b.id)||0);
      return diff || Number(a.sort_order||0)-Number(b.sort_order||0);
    })[0] || null;
  },[workspace.subjects,recentMinutesBySubject]);

  const generalNext = generalSubject ? {
    title:`Focus on ${generalSubject.name}`,
    recommendation_type:'general_focus',
    estimated_minutes:Number(workspace.profile?.preferred_focus_minutes||25),
    subject_id:generalSubject.id,
    chapter_id:null,
    reason:[
      'General Study Mode is active — no exam or date sheet is required.',
      'This subject has received the least study time in your recent balance.'
    ]
  } : null;

  const examSyllabusItem = nextExam ? workspace.syllabus
    .filter((item:Row)=>item.exam_id===nextExam.id && item.user_verified && item.inclusion!=='excluded')
    .sort((a:Row,b:Row)=>Number(b.priority_score||0)+Number(b.blueprint_weight||0)+(b.is_new_content?20:0)-Number(a.priority_score||0)-Number(a.blueprint_weight||0)-(a.is_new_content?20:0))[0] : null;
  const examNext = nextExam ? {
    title: examSyllabusItem?.label || chapterMap.get(examSyllabusItem?.chapter_id)?.title || ('Prepare '+(subjectMap.get(nextExam.subject_id)?.name || nextExam.name)),
    recommendation_type:'exam_priority',
    estimated_minutes:Number(workspace.profile?.preferred_focus_minutes||25),
    subject_id:examSyllabusItem?.subject_id || nextExam.subject_id || null,
    chapter_id:examSyllabusItem?.chapter_id || null,
    topic_id:examSyllabusItem?.topic_id || null,
    reason:['Exam Mode', nextExam.name+' · '+Math.max(0,Number(daysUntil(nextExam.exam_date)??0))+' days remaining', examSyllabusItem?.is_new_content?'New content prioritized':examSyllabusItem?'Confirmed syllabus prioritized':'No confirmed syllabus yet — using exam subject context']
  } : null;

  const generalStudyNext = topRecommendation ?? (dueRevision ? {
    title: chapterMap.get(dueRevision.chapter_id)?.title || 'Revision due',
    recommendation_type:'revise', estimated_minutes:10, subject_id:dueRevision.subject_id,
    chapter_id:dueRevision.chapter_id, reason:['Spaced revision is due']
  } : topPlan ?? generalNext);
  const studyNext = studyMode==='exam' ? (examNext ?? generalStudyNext) : generalStudyNext;

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
    return workspace.subjects
      .map(s=>[String(s.name),recentMinutesBySubject.get(s.id)||0] as [string,number])
      .sort((a,b)=>b[1]-a[1]);
  },[workspace.subjects,recentMinutesBySubject]);

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

  async function setStudyMode(next:'general'|'exam'){
    if(!supabase||!session?.user?.id)return;
    const r=await supabase.from('profiles').update({study_mode:next,updated_at:new Date().toISOString()}).eq('id',session.user.id).select('*').single();
    if(r.error){setError(r.error.message);return;}
    setWorkspace(prev=>({...prev,profile:r.data||{...prev.profile,study_mode:next}}));
    setToast(next==='exam'?(nextExam?'Exam Mode active — nearest exam now leads planning.':'Exam Mode active — add an exam when ready; General Study remains the fallback.'):'General Study Mode active — balanced everyday learning restored.');
  }

  async function ensureTodayPlan() {
    if(!supabase||!session?.user?.id) return null;
    const minutes=Number(workspace.profile?.preferred_focus_minutes||25);
    const r=await supabase.from('daily_plans').upsert({
      user_id:session.user.id,
      plan_date:today,
      available_minutes:Math.min(1440,minutes*subjectsPerDay),
      generated_reason:{mode:studyMode,exam_required:studyMode==='exam'},
      status:'active'
    },{onConflict:'user_id,plan_date'}).select('id').single();
    if(r.error){setError(r.error.message);return null;}
    return r.data?.id || null;
  }

  async function buildGeneralPlan(){
    if(!supabase||!session?.user?.id||!workspace.subjects.length)return;
    if(studyMode==='exam'){
      if(!upcomingExams.length){setToast('No upcoming exam saved — using the General Study planner.');}
      else {
        const planId=await ensureTodayPlan(); if(!planId)return;
        const minutes=Number(workspace.profile?.preferred_focus_minutes||25);
        const existing=new Set(todaysPlan.filter((x:Row)=>x.subject_id&&!['done','skipped'].includes(x.status)).map((x:Row)=>x.subject_id));
        const exams=upcomingExams.filter((e:Row)=>e.subject_id&&!existing.has(e.subject_id)).filter((e:Row,i:number,a:Row[])=>a.findIndex((x:Row)=>x.subject_id===e.subject_id)===i).slice(0,Math.max(0,subjectsPerDay-existing.size));
        if(!exams.length){setToast('Today already covers your current Exam Mode subjects.');return;}
        const rows=exams.map((exam:Row,i:number)=>{
          const item=workspace.syllabus.filter((x:Row)=>x.exam_id===exam.id&&x.user_verified&&x.inclusion!=='excluded').sort((a:Row,b:Row)=>Number(b.priority_score||0)+Number(b.blueprint_weight||0)+(b.is_new_content?20:0)-Number(a.priority_score||0)-Number(a.blueprint_weight||0)-(a.is_new_content?20:0))[0];
          const subject=subjectMap.get(exam.subject_id);
          return {daily_plan_id:planId,user_id:session.user.id,subject_id:exam.subject_id,chapter_id:item?.chapter_id||null,topic_id:item?.topic_id||null,title:item?.label||('Prepare '+(subject?.name||exam.name)),activity_type:'exam_prep',estimated_minutes:minutes,priority_score:95-i*5,reason:['Exam Mode',exam.name+' · '+Math.max(0,Number(daysUntil(exam.exam_date)??0))+' days remaining',item?.is_new_content?'New content prioritized':item?'Confirmed syllabus prioritized':'Exam subject priority'],status:'todo',sort_order:todaysPlan.length+i};
        });
        const r=await supabase.from('daily_plan_items').insert(rows); if(r.error){setError(r.error.message);return;}
        setToast('Exam Mode plan added '+rows.length+' priority subject'+(rows.length===1?'':'s')+'.'); await refresh(); return;
      }
    }
    const planId=await ensureTodayPlan();if(!planId)return;
    const minutes=Number(workspace.profile?.preferred_focus_minutes||25);
    const existing=new Set(todaysPlan.filter((x:Row)=>x.subject_id).map((x:Row)=>x.subject_id));
    const remainingSlots=Math.max(0,subjectsPerDay-existing.size);
    if(!remainingSlots){setToast(`Today already covers ${subjectsPerDay} subjects.`);return;}

    const selected=[...workspace.subjects]
      .filter(s=>!existing.has(s.id))
      .sort((a,b)=>{
        const balance=(recentMinutesBySubject.get(a.id)||0)-(recentMinutesBySubject.get(b.id)||0);
        if(balance!==0) return balance;
        return stableNumber(today+'|'+a.id)-stableNumber(today+'|'+b.id);
      })
      .slice(0,Math.min(remainingSlots,workspace.subjects.length));

    if(!selected.length){setToast('Today already has balanced subject coverage.');return;}

    const rows=selected.map((s,i)=>{
      const unfinishedVideos=workspace.videos
        .filter((v:Row)=>v.subject_id===s.id)
        .map((v:Row)=>({video:v,progress:workspace.videoProgress.find((p:Row)=>p.video_id===v.id)}))
        .filter((x:Row)=>Number(x.progress?.completion||0)<90)
        .sort((a:Row,b:Row)=>Number(b.progress?.completion||0)-Number(a.progress?.completion||0));

      const subjectCards=workspace.flashcards.filter((card:Row)=>card.subject_id===s.id);
      const dueCards=subjectCards.filter((card:Row)=>{
        const review=workspace.flashcardReviews.find((r:Row)=>r.flashcard_id===card.id);
        return !review?.next_due_at || new Date(review.next_due_at).getTime()<=Date.now();
      });

      if(unfinishedVideos.length && stableNumber(today+'|'+s.id+'|learning')%3!==0){
        const learning=unfinishedVideos[0];
        const completion=Number(learning.progress?.completion||0);
        return {
          daily_plan_id:planId,user_id:session.user.id,subject_id:s.id,
          chapter_id:learning.video.chapter_id||null,topic_id:learning.video.topic_id||null,
          title:`Continue: ${learning.video.title}`,activity_type:'video',
          estimated_minutes:Math.min(minutes,Math.max(10,Math.round(Number(learning.video.duration_seconds||1200)/60*(1-completion/100)))),
          priority_score:82-i*4,
          reason:['Connected Learning','Tracked lesson is unfinished',`${Math.round(completion)}% complete`],
          status:'todo',sort_order:todaysPlan.length+i
        };
      }

      if(dueCards.length && stableNumber(today+'|'+s.id+'|flashcards')%2===0){
        return {
          daily_plan_id:planId,user_id:session.user.id,subject_id:s.id,
          chapter_id:dueCards[0]?.chapter_id||null,topic_id:dueCards[0]?.topic_id||null,
          title:`Review ${Math.min(dueCards.length,8)} flashcards · ${s.name}`,activity_type:'flashcards',
          estimated_minutes:Math.min(15,minutes),
          priority_score:78-i*4,
          reason:['Learning Companion','Flashcards are due for review'],
          status:'todo',sort_order:todaysPlan.length+i
        };
      }

      const bookIds=new Set(workspace.books
        .filter((b:Row)=>normalized(b.subject)===normalized(s.name))
        .map((b:Row)=>b.id));
      const candidates=workspace.chapters
        .filter((ch:Row)=>bookIds.has(ch.curriculum_book_id))
        .sort((a:Row,b:Row)=>{
          const pa=workspace.progress.find((p:Row)=>p.chapter_id===a.id);
          const pb=workspace.progress.find((p:Row)=>p.chapter_id===b.id);
          const completionDiff=Number(pa?.completion||0)-Number(pb?.completion||0);
          if(completionDiff!==0) return completionDiff;
          const lastA=pa?.last_studied_at?new Date(pa.last_studied_at).getTime():0;
          const lastB=pb?.last_studied_at?new Date(pb.last_studied_at).getTime():0;
          if(lastA!==lastB) return lastA-lastB;
          return stableNumber(today+'|'+a.id)-stableNumber(today+'|'+b.id);
        });
      const chapter=candidates[0]||null;
      const topics=chapter?workspace.topics.filter((t:Row)=>t.chapter_id===chapter.id):[];
      const topic=topics.length?topics[stableNumber(today+'|'+s.id+'|topic')%topics.length]:null;
      const progress=chapter?workspace.progress.find((p:Row)=>p.chapter_id===chapter.id):null;
      const activity=Number(progress?.completion||0)>=55?'practice':'learn';
      const title=topic?.title || chapter?.title || `Study ${s.name}`;
      return {
        daily_plan_id:planId,user_id:session.user.id,subject_id:s.id,
        chapter_id:chapter?.id||null,topic_id:topic?.id||null,
        title,activity_type:activity,estimated_minutes:minutes,
        priority_score:75-i*4,
        reason:[
          'Balanced Shuffle Plan',
          'No exam or date sheet required',
          `Daily coverage target: ${subjectsPerDay} subjects`,
          topic?'A curriculum topic was selected for focused coverage':chapter?'An under-covered chapter was selected':'Subject rotation based on recent study time'
        ],
        status:'todo',sort_order:todaysPlan.length+i
      };
    });

    const r=await supabase.from('daily_plan_items').insert(rows);
    if(r.error){setError(r.error.message);return;}
    setToast(`Balanced plan added ${rows.length} subject${rows.length===1?'':'s'} for today.`);
    await refresh();
  }

  async function addQuickTask(input:{subjectId?:string;title:string;minutes:number;activityType:string}){
    if(!supabase||!session?.user?.id||!input.title.trim())return;
    const planId=await ensureTodayPlan();if(!planId)return;
    const r=await supabase.from('daily_plan_items').insert({
      daily_plan_id:planId,user_id:session.user.id,subject_id:input.subjectId||null,chapter_id:null,topic_id:null,
      title:input.title.trim(),activity_type:input.activityType,estimated_minutes:Math.max(1,Math.min(720,input.minutes)),
      priority_score:50,reason:['Added manually in General Study Mode'],status:'todo',sort_order:todaysPlan.length
    });
    if(r.error){setError(r.error.message);return;}
    setToast('Study task added.');
    await refresh();
  }

  async function saveVideoSummary(video:Row,summary:string){
    if(!supabase||!session?.user?.id)return;
    const trimmed=summary.trim();
    await supabase.from('study_resources').delete()
      .eq('user_id',session.user.id)
      .contains('metadata',{kind:'video_summary',video_id:video.id});
    if(!trimmed)return;
    const r=await supabase.from('study_resources').insert({
      user_id:session.user.id,
      subject_id:video.subject_id||null,
      chapter_id:video.chapter_id||null,
      topic_id:video.topic_id||null,
      title:`Summary · ${video.title}`,
      resource_type:'note',
      url:video.url||null,
      source_label:providerLabel(video)+' learning summary',
      metadata:{kind:'video_summary',video_id:video.id,summary:trimmed}
    });
    if(r.error) throw r.error;
  }

  async function addLearningVideo(input:{url:string;title:string;subjectId?:string;chapterId?:string;topicId?:string;durationMinutes?:number;completion?:number;watchedMinutes?:number;summary?:string}){
    if(!supabase||!session?.user?.id)return;
    let parsed:URL;
    try{parsed=new URL(input.url.trim());}catch{setError('Enter a valid video or lesson URL.');return;}
    if(!['http:','https:'].includes(parsed.protocol)){setError('Only http/https learning links are supported.');return;}
    if(!input.title.trim()){setError('Add a title so StudyOS can identify this learning item.');return;}
    const provider=providerForUrl(parsed.toString());
    const durationSeconds=Math.max(0,Math.round(Number(input.durationMinutes||0)*60))||null;
    const videoRes=await supabase.from('videos').upsert({
      user_id:session.user.id,
      subject_id:input.subjectId||null,
      chapter_id:input.chapterId||null,
      topic_id:input.topicId||null,
      provider,
      external_id:parsed.toString(),
      title:input.title.trim(),
      url:parsed.toString(),
      duration_seconds:durationSeconds,
      classification_confidence:1,
      user_verified:true
    },{onConflict:'user_id,provider,external_id'}).select('*').single();
    if(videoRes.error||!videoRes.data){setError(videoRes.error?.message||'Could not save learning video.');return;}
    const video=videoRes.data;
    const completion=Math.max(0,Math.min(100,Number(input.completion||0)));
    const watchedSeconds=Math.max(0,Math.round(Number(input.watchedMinutes||0)*60));
    const existing=workspace.videoProgress.find((p:Row)=>p.video_id===video.id);
    const progressRes=await supabase.from('video_progress').upsert({
      user_id:session.user.id,
      video_id:video.id,
      watched_seconds:watchedSeconds,
      completion,
      last_position_seconds:watchedSeconds,
      sessions:Number(existing?.sessions||0)+1,
      last_watched_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    },{onConflict:'user_id,video_id'});
    if(progressRes.error){setError(progressRes.error.message);return;}
    try{await saveVideoSummary(video,input.summary||'');}catch(e:any){setError(e?.message||'Video saved, but the summary could not be saved.');return;}
    setToast(`${providerLabel(video)} learning progress saved.`);
    await refresh();
  }

  async function updateLearningProgress(video:Row,input:{completion:number;watchedMinutes:number;summary:string}){
    if(!supabase||!session?.user?.id)return;
    const existing=workspace.videoProgress.find((p:Row)=>p.video_id===video.id);
    if(Number(existing?.tracking_version||1)>=2&&existing?.tracking_source&&existing.tracking_source!=='manual'){
      try{await saveVideoSummary(video,input.summary);}catch(e:any){setError(e?.message||'Summary could not be saved.');return;}
      setToast('Summary saved. Precision tracking metrics stay protected.');
      await refresh();
      return;
    }
    const watchedSeconds=Math.max(0,Math.round(Number(input.watchedMinutes||0)*60));
    const r=await supabase.from('video_progress').upsert({
      user_id:session.user.id,
      video_id:video.id,
      watched_seconds:watchedSeconds,
      completion:Math.max(0,Math.min(100,Number(input.completion||0))),
      last_position_seconds:watchedSeconds,
      sessions:Number(existing?.sessions||0)+1,
      confidence:existing?.confidence||null,
      tracking_source:'manual',
      last_watched_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    },{onConflict:'user_id,video_id'});
    if(r.error){setError(r.error.message);return;}
    try{await saveVideoSummary(video,input.summary);}catch(e:any){setError(e?.message||'Progress saved, but the summary could not be saved.');return;}
    setToast('Learning progress updated.');
    await refresh();
  }

  async function saveProfileSettings(input:Row){
    if(!supabase||!session?.user?.id)return;
    const payload={
      id:session.user.id,
      full_name:String(input.full_name||'').trim()||null,
      class_level:Math.max(1,Math.min(12,Number(input.class_level||8))),
      board:String(input.board||'CBSE'),
      academic_session:String(input.academic_session||'2026-27'),
      school_name:String(input.school_name||'').trim()||null,
      timezone:String(input.timezone||'Asia/Kolkata'),
      preferred_focus_minutes:Math.max(10,Math.min(120,Number(input.preferred_focus_minutes||25))),
      onboarding_completed:true,
      updated_at:new Date().toISOString()
    };
    const r=await supabase.from('profiles').upsert(payload,{onConflict:'id'}).select('*').single();
    if(r.error){setError(r.error.message);return;}
    if(payload.class_level===8&&payload.board==='CBSE'){
      await supabase.from('subjects').upsert(
        CORE_CLASS8_SUBJECTS.map((s,i)=>({user_id:session.user.id,name:s.name,color:s.color,sort_order:i})),
        {onConflict:'user_id,name'}
      );
    }
    setWorkspace(prev=>({...prev,profile:r.data||payload}));
    setToast('Profile and study preferences saved.');
    await refresh();
  }

  async function saveNotificationSettings(input:Row){
    if(!supabase||!session?.user?.id)return;
    const r=await supabase.from('notification_preferences').upsert({
      user_id:session.user.id,
      browser_enabled:Boolean(input.browser_enabled),
      email_enabled:Boolean(input.email_enabled),
      revision_enabled:Boolean(input.revision_enabled),
      homework_enabled:Boolean(input.homework_enabled),
      exam_enabled:Boolean(input.exam_enabled),
      weekly_report_enabled:Boolean(input.weekly_report_enabled),
      quiet_hours_start:input.quiet_hours_start||null,
      quiet_hours_end:input.quiet_hours_end||null,
      timezone:workspace.profile?.timezone||'Asia/Kolkata',
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
    if(r.error){setError(r.error.message);return;}
    setToast('Notification preferences saved.');
    await refresh();
  }

  async function sendPasswordReset(){
    if(!supabase||!session?.user?.email)return;
    const r=await supabase.auth.resetPasswordForEmail(session.user.email,{redirectTo:window.location.origin+'/auth'});
    if(r.error){setError(r.error.message);return;}
    setToast('Password reset email sent.');
  }

  async function generateLearningKit(video:Row,notes:string){
    if(!supabase)return;
    const {data}=await supabase.auth.getSession();
    const token=data.session?.access_token;
    if(!token){setError('Your session expired. Sign in again.');return;}
    setToast('Building your study kit…');
    const response=await fetch('/api/learning/analyze',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({videoId:video.id,notes})
    });
    const payload=await response.json() as {error?:string;ai_used?:boolean;flashcards_created?:number;doubts_created?:number};
    if(!response.ok){setError(payload.error||'Could not build the study kit.');return;}
    setToast(`${payload.ai_used?'AI':'Quick'} study kit ready · ${payload.flashcards_created||0} flashcards${payload.doubts_created?' · '+payload.doubts_created+' doubts':''}`);
    await refresh();
  }

  async function addSubject(name:string){
    if(!supabase||!session?.user?.id||!name.trim())return;
    const clean=name.trim();
    const color=SUBJECT_COLOR_POOL[workspace.subjects.length%SUBJECT_COLOR_POOL.length];
    const r=await supabase.from('subjects').upsert({
      user_id:session.user.id,name:clean,color,sort_order:workspace.subjects.length
    },{onConflict:'user_id,name'});
    if(r.error){setError(r.error.message);return;}
    setToast(`${clean} added.`);
    await refresh();
  }

  function beginFocus(item:Row,minutes?:number){
    const target=Math.max(1,Number(minutes||item.estimated_minutes||workspace.profile?.preferred_focus_minutes||25));
    setFocus({...item,estimated_minutes:target});
    setFocusSeconds(0);
    setFocusTargetSeconds(target*60);
    setFocusRunning(true);
  }

  function resetFocus(){
    setFocusSeconds(0);
    setFocusRunning(false);
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
    setFocus(null); setFocusSeconds(0); setFocusTargetSeconds(25*60); setFocusRunning(false);
    setToast(`${minutes} minute study session saved.`);
    await refresh();
  }

  function assistantAnswer(q:string){
    const text=q.toLowerCase();
    if(text.includes('next exam')||text.includes('exam')){
      if(!nextExam)return 'You do not have an upcoming exam saved, and that is fine. General Study Mode still works with your subjects, focus timer, balanced plans, revision and study history.';
      return `${nextExam.name} is your next exam on ${formatDate(nextExam.exam_date)} (${daysUntil(nextExam.exam_date)} days left). I am using only the exam records stored in your workspace.`;
    }
    if(text.includes('revise')){
      if(!dueRevision)return 'Nothing is currently in your due revision queue.';
      return `${chapterMap.get(dueRevision.chapter_id)?.title || 'A saved chapter'} is due for revision now. The current stage is R${dueRevision.stage ?? 1}.`;
    }
    if(text.includes('video')||text.includes('youtube')||text.includes('physics wallah')||text.includes('pw ')){
      const tracked=workspace.videos.length;
      const completed=workspace.videoProgress.filter((p:Row)=>Number(p.completion)>=90).length;
      return tracked?`You are tracking ${tracked} learning video${tracked===1?'':'s'} across StudyOS, with ${completed} at 90%+ completion. Open Learning to resume, update progress, or save summaries by topic.`:'You have not tracked any videos yet. Open Learning and add a YouTube, Physics Wallah, DIKSHA, Khan Academy, school, or other lesson URL.';
    }
    if(text.includes('weak')){
      const weak=[...workspace.progress].sort((a,b)=>Number(a.mastery||0)-Number(b.mastery||0))[0];
      if(!weak)return 'There is not enough mastery evidence yet to name a weak chapter. Complete a study session or assessment first.';
      return `${chapterMap.get(weak.chapter_id)?.title || 'Your lowest-evidence chapter'} currently has the lowest recorded mastery at ${pct(weak.mastery)}%.`;
    }
    if(studyNext){
      return `Your highest-value next action is “${studyNext.title || chapterMap.get(studyNext.chapter_id)?.title || 'Study session'}”. ${reasons(studyNext.reason).join(' ') || 'It is currently the highest-priority real item in your StudyOS data.'}`;
    }
    if(text.includes('timer')||text.includes('focus')) return 'Open Focus from the sidebar to start a 15, 25, 40, 50 or 60 minute subject session. A date sheet is not required.';
    return 'Start a focus session, add a subject, or build a balanced general plan. Exams and date sheets are optional and only add extra exam-aware intelligence.';
  }

  function askAssistant(){
    const q=assistantInput.trim(); if(!q)return;
    setAssistantMessages(m=>[...m,{role:'user',text:q},{role:'ai',text:assistantAnswer(q)}]);
    setAssistantInput('');
  }

  if (!isSupabaseConfigured) return <SetupRequired/>;
  if (loading && !session) return <Splash label="Connecting to StudyOS…"/>;
  if (!session) return <StudyOSAuth initialMode="signin" />;
  if (loading) return <Splash label="Loading your academic workspace…"/>;
  if (!workspace.profile?.onboarding_completed) return <Onboarding userId={session.user.id} onDone={refresh}/>;

  const initials=(workspace.profile.full_name||session.user.email||'S').split(/\s+/).map((x:string)=>x[0]).slice(0,2).join('').toUpperCase();

  return <main className={`connected-app ${dark?'dark':''}`}>
    <input ref={fileRef} type="file" accept=".pdf,image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)uploadDocument(f);e.currentTarget.value='';}}/>
    <aside className="connected-sidebar">
      <div className="connected-brand"><StudyOSLogo className="app-studyos-logo"/></div>
      <p className="connected-nav-label">Command center</p>
      <nav>{nav.map(([label,Icon])=><button key={label} className={view===label?'active':''} onClick={()=>setView(label)}><Icon size={18}/><span>{label}</span>{label==='Revision'&&workspace.revisions.length>0?<i>{workspace.revisions.length}</i>:null}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <button onClick={()=>setAssistant(true)}><Sparkles size={18}/><span>StudyOS Assistant</span></button>
      <button className={view==='Settings'?'active':''} onClick={()=>setView('Settings')}><Settings size={18}/><span>Settings</span></button>
      <div className="connected-profile"><span>{initials}</span><div><b>{workspace.profile.full_name}</b><small>Class {workspace.profile.class_level} · {workspace.profile.board}</small></div><button onClick={()=>supabase?.auth.signOut()} aria-label="Sign out"><LogOut size={16}/></button></div>
    </aside>

    <section className="connected-main">
      <header className="connected-topbar">
        <button className="mobile-menu"><Menu size={20}/></button>
        <button className="smart-search" onClick={()=>setAssistant(true)}><Search size={17}/><span>Ask StudyOS about your real study data…</span><kbd>⌘ K</kbd></button>
        <div className="top-actions"><div className="study-mode-switch" role="group" aria-label="Study mode"><button className={studyMode==='general'?'active':''} onClick={()=>setStudyMode('general')}><BookOpen size={14}/>General</button><button className={studyMode==='exam'?'active exam':''} onClick={()=>setStudyMode('exam')}><Target size={14}/>Exam</button></div><span className="live-pill">LIVE DATA</span><button onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button><Bell size={17}/></button><button className="top-profile-button" onClick={()=>setView('Settings')} title="Open profile and settings"><span className="top-avatar">{initials}</span><span className="top-profile-copy"><b>{workspace.profile.full_name?.split(' ')[0]||'Profile'}</b><small>Settings</small></span></button></div>
      </header>

      <div className="connected-content">
        {error&&<div className="error-banner"><span>{error}</span><button onClick={()=>setError('')}><X size={15}/></button></div>}
        {view==='Home'&&<Home workspace={workspace} studyNext={studyNext} nextExam={nextExam} streak={streak} weekMinutes={weekMinutes} subjectMap={subjectMap} chapterMap={chapterMap} start={beginFocus} upload={()=>fileRef.current?.click()} buildGeneralPlan={buildGeneralPlan}/>}
        {view==='Today'&&<Today workspace={workspace} items={todaysPlan} subjectMap={subjectMap} chapterMap={chapterMap} setStatus={setPlanStatus} start={beginFocus} buildGeneralPlan={buildGeneralPlan} addTask={addQuickTask}/>}
        {view==='Focus'&&<FocusHub workspace={workspace} subjectTime={subjectTime} start={beginFocus}/>}
        {view==='Learning'&&<LearningTracker workspace={workspace} onAdd={addLearningVideo} onUpdate={updateLearningProgress} onGenerateKit={generateLearningKit}/>}
        {view==='Subjects'&&<Subjects workspace={workspace} onAdd={addSubject} start={beginFocus}/>}
        {view==='Library'&&<LibraryView workspace={workspace}/>}
        {view==='Syllabus'&&<Syllabus workspace={workspace} subjectMap={subjectMap} chapterMap={chapterMap} upload={()=>fileRef.current?.click()}/>}
        {view==='Exams'&&<Exams workspace={workspace} subjectMap={subjectMap}/>}
        {view==='Revision'&&<Revision workspace={workspace} chapterMap={chapterMap} start={beginFocus}/>} 
        {view==='Papers'&&<Papers workspace={workspace} subjectMap={subjectMap} generate={generatePaper}/>}
        {view==='Analytics'&&<Analytics workspace={workspace} subjectTime={subjectTime} weekMinutes={weekMinutes}/>}
        {view==='Documents'&&<Documents workspace={workspace} upload={()=>fileRef.current?.click()} confirm={confirmExtraction}/>}
        {view==='Resources'&&<Resources workspace={workspace}/>}
        {view==='Settings'&&<SettingsPanel workspace={workspace} email={session.user.email||''} dark={dark} setDark={setDark} subjectsPerDay={subjectsPerDay} setSubjectsPerDay={setSubjectsPerDay} studyMode={studyMode} setStudyMode={setStudyMode} saveProfile={saveProfileSettings} saveNotifications={saveNotificationSettings} sendPasswordReset={sendPasswordReset} signOut={()=>supabase?.auth.signOut()} openView={setView}/>}
      </div>
    </section>

    <button className="assistant-orb" onClick={()=>setAssistant(true)}><Sparkles size={18}/><span>Ask StudyOS</span></button>
    {toast&&<div className="connected-toast"><Check size={15}/>{toast}</div>}

    {focus&&<div className="connected-overlay"><section className="focus-card focus-card-upgraded">
      <button className="close-button" onClick={()=>{setFocus(null);setFocusRunning(false)}}><X/></button>
      <span className="focus-eyebrow">FOCUS TIMER · {String(focus.activity_type||focus.recommendation_type||'study').replaceAll('_',' ').toUpperCase()}</span>
      <h2>{focus.title || chapterMap.get(focus.chapter_id)?.title || 'Study session'}</h2>
      <p>{subjectMap.get(focus.subject_id)?.name || 'General study'} · target {Math.round(focusTargetSeconds/60)} min</p>
      <div className="focus-timer-ring" style={{'--focus-progress':Math.min(100,focusTargetSeconds?focusSeconds/focusTargetSeconds*100:0)+'%'} as React.CSSProperties}>
        <strong>{String(Math.floor(Math.max(0,focusTargetSeconds-focusSeconds)/60)).padStart(2,'0')}:{String(Math.max(0,focusTargetSeconds-focusSeconds)%60).padStart(2,'0')}</strong>
        <small>{Math.floor(focusSeconds/60)} min elapsed</small>
      </div>
      <div className="focus-controls"><button onClick={()=>setFocusRunning(v=>!v)}><Play size={16}/>{focusRunning?'Pause':'Resume'}</button><button className="secondary" onClick={resetFocus}><RotateCcw size={16}/>Reset</button><button className="secondary" onClick={finishFocus}><Check size={16}/>Finish & save</button></div>
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

function Splash({label}:{label:string}){return <main className="connected-splash"><StudyOSMark size={42}/><Loader2 className="spin"/><b>{label}</b></main>}

function SetupRequired(){
  return <main className="setup-page"><section><StudyOSLogo/><h1>Connect StudyOS to Supabase</h1><p>This build intentionally refuses to show fabricated student data. Add the real project URL and publishable key to the deployment environment.</p><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></section></main>
}

function Onboarding({userId,onDone}:{userId:string;onDone:()=>Promise<void>}){
  const supabase=getSupabaseClient();
  const [name,setName]=useState('');
  const [classLevel,setClassLevel]=useState(8);
  const [board,setBoard]=useState('CBSE');
  const [session,setSession]=useState('2026-27');
  const [school,setSchool]=useState('');
  const [focusMinutes,setFocusMinutes]=useState(25);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function save(e:React.FormEvent){
    e.preventDefault();if(!supabase)return;setBusy(true);setError('');
    const p=await supabase.from('profiles').upsert({
      id:userId,full_name:name,class_level:classLevel,board,academic_session:session,
      school_name:school||null,preferred_focus_minutes:focusMinutes,onboarding_completed:true
    },{onConflict:'id'});
    if(p.error){setError(p.error.message);setBusy(false);return;}
    const b=await supabase.from('curriculum_books').select('subject').eq('board',board).eq('class_level',classLevel).eq('status','current');
    const curriculumNames=Array.from(new Set((b.data??[]).map((x:any)=>String(x.subject||'').trim()).filter(Boolean)));
    const base = classLevel===8 && board==='CBSE' ? CORE_CLASS8_SUBJECTS.map(x=>({name:x.name,color:x.color})) : [];
    const merged = new Map<string,{name:string;color:string}>();
    base.forEach(x=>merged.set(x.name.toLowerCase(),x));
    curriculumNames.forEach((n:any,i)=>{
      if(!merged.has(String(n).toLowerCase())) merged.set(String(n).toLowerCase(),{
        name:String(n),
        color:SUBJECT_COLOR_POOL[(base.length+i)%SUBJECT_COLOR_POOL.length]
      });
    });
    const rows=[...merged.values()].map((x,i)=>({user_id:userId,name:x.name,color:x.color,sort_order:i}));
    if(rows.length){
      const s=await supabase.from('subjects').upsert(rows,{onConflict:'user_id,name'});
      if(s.error){setError(s.error.message);setBusy(false);return;}
    }
    setBusy(false);await onDone();
  }
  return <main className="onboarding-page"><section><StudyOSLogo/><span className="onboarding-kicker">SET UP YOUR ACADEMIC OS</span><h1>Build your StudyOS workspace</h1><p>Start with subjects, everyday study tracking and a focus timer. Exams, syllabi and date sheets are optional and can be added later for extra intelligence.</p>{classLevel===8&&board==='CBSE'?<div className="onboarding-core-subjects"><span>YOUR CORE 6 SUBJECTS</span><div>{CORE_CLASS8_SUBJECTS.map(s=><b key={s.name} style={{'--subject-color':s.color} as React.CSSProperties}>{s.name}</b>)}</div></div>:null}<form onSubmit={save}><label>Your name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label><div className="form-grid"><label>Class<select value={classLevel} onChange={e=>setClassLevel(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>Class {n}</option>)}</select></label><label>Board<select value={board} onChange={e=>setBoard(e.target.value)}><option>CBSE</option><option>ICSE</option><option>State Board</option><option>IB</option><option>Cambridge</option><option>Custom</option></select></label></div><div className="form-grid"><label>Academic session<input value={session} onChange={e=>setSession(e.target.value)}/></label><label>School (optional)<input value={school} onChange={e=>setSchool(e.target.value)}/></label></div><label>Default focus block<select value={focusMinutes} onChange={e=>setFocusMinutes(Number(e.target.value))}>{[15,25,40,50,60].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label>{error&&<div className="form-message">{error}</div>}<button disabled={busy}>{busy?<Loader2 className="spin"/>:<Sparkles/>}Build my StudyOS</button></form></section></main>
}

function SectionHead({eyebrow,title,copy,action}:{eyebrow:string;title:string;copy:string;action?:React.ReactNode}){return <header className="section-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</header>}
function Empty({icon:Icon,title,copy,action}:{icon:any;title:string;copy:string;action?:React.ReactNode}){return <div className="connected-empty"><span><Icon/></span><h3>{title}</h3><p>{copy}</p>{action}</div>}

function Home({workspace,studyNext,nextExam,streak,weekMinutes,subjectMap,chapterMap,start,upload,buildGeneralPlan}:any){
  const completed=workspace.planItems.filter((x:Row)=>x.status==='done').length;
  const total=workspace.planItems.length;
  const examActive=workspace.profile?.study_mode==='exam';
  return <><SectionHead eyebrow={new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date())} title={`Good to see you, ${workspace.profile.full_name.split(' ')[0]}`} copy={examActive?'Exam Mode is prioritizing upcoming exams and confirmed syllabus evidence.':'General Study Mode balances everyday learning even without exams or date sheets.'} action={<div className="section-actions"><button className="secondary-button" onClick={buildGeneralPlan}><ListPlus size={16}/>{examActive?'Build exam plan':'Balanced plan'}</button><button className="premium-button" onClick={()=>studyNext&&start(studyNext)} disabled={!studyNext}><Play size={16}/>Study next</button></div>}/><section className="hero-intelligence"><div className="hero-copy"><span><Sparkles size={14}/> {examActive?'EXAM MODE PRIORITY':'GENERAL STUDY MODE'}</span>{studyNext?<><h2>{studyNext.title || chapterMap.get(studyNext.chapter_id)?.title || 'Your next study action'}</h2><p>{reasons(studyNext.reason).join(' ') || 'This is currently the highest-value real item in your workspace.'}</p><div><button onClick={()=>start(studyNext)}><Play size={16}/>Start focus</button><small>{studyNext.estimated_minutes?studyNext.estimated_minutes+' min':''}</small></div></>:<><h2>Start anywhere — no date sheet needed</h2><p>Add a subject or start a focus timer. StudyOS can build useful history and balanced plans before you ever add an exam.</p><div><button onClick={buildGeneralPlan}><ListPlus size={16}/>Build balanced plan</button><button onClick={upload}><Upload size={16}/>Add study material</button></div></>}</div><div className="hero-exam">{nextExam?<><span>Next exam</span><strong>{daysUntil(nextExam.exam_date)}</strong><small>days</small><b>{nextExam.name}</b><em>{formatDate(nextExam.exam_date)}</em></>:<><span>Study mode</span><strong>∞</strong><small>any day</small><b>General study active</b><em>No exam required</em></>}</div></section><div className="metric-grid"><Metric icon={Clock3} label="Study time · 7 days" value={weekMinutes?Math.floor(weekMinutes/60)+'h '+weekMinutes%60+'m':'No sessions yet'} detail="Calculated from saved focus sessions"/><Metric icon={Flame} label="Current streak" value={streak?streak+' days':'Start today'} detail="Based on days with logged study"/><Metric icon={BookOpen} label="Active subjects" value={workspace.subjects.length?String(workspace.subjects.length):'Add subjects'} detail="Study any subject without exam setup"/><Metric icon={Check} label="Plan completion" value={total?completed+'/'+total:'No plan yet'} detail="Saved daily plan items"/></div><div className="dashboard-grid"><section className="connected-card wide"><header><div><span>TODAY</span><h3>Your study plan</h3></div><button className="card-link-button" onClick={buildGeneralPlan}>{examActive?'Prioritize exams':'Balance subjects'}</button></header>{workspace.planItems.length?workspace.planItems.slice(0,5).map((x:Row)=><div className="list-row" key={x.id}><span className="row-icon"><BookOpen/></span><div><b>{x.title}</b><small>{subjectMap.get(x.subject_id)?.name || x.activity_type || 'Study'}</small></div><em>{x.status}</em></div>):<Empty icon={CalendarDays} title="No plan yet" copy="Build a balanced general plan instantly. You do not need an exam, syllabus or date sheet."/>}</section><section className="connected-card"><header><div><span>WORKSPACE</span><h3>Study system health</h3></div></header><Health label="Subjects" value={workspace.subjects.length}/><Health label="Saved sessions" value={workspace.sessions.length}/><Health label="Revision due" value={workspace.revisions.length}/><Health label="Optional exams" value={workspace.exams.length}/></section></div></>;
}

function Metric({icon:Icon,label,value,detail}:any){return <section className="metric-card"><span><Icon/></span><div><small>{label}</small><b>{value}</b><p>{detail}</p></div></section>}
function Health({label,value}:{label:string;value:number}){return <div className="health-row"><span>{label}</span><b>{value}</b></div>}

function Today({workspace,items,subjectMap,chapterMap,setStatus,start,buildGeneralPlan,addTask}:any){
  const [title,setTitle]=useState('');
  const [subjectId,setSubjectId]=useState('');
  const [minutes,setMinutes]=useState(Number(workspace.profile?.preferred_focus_minutes||25));
  const [activityType,setActivityType]=useState('learn');
  async function submit(e:React.FormEvent){e.preventDefault();if(!title.trim())return;await addTask({subjectId,title,minutes,activityType});setTitle('');}
  return <><SectionHead eyebrow="DAILY PLAN" title="Today" copy={workspace.profile?.study_mode==='exam'?'Exam Mode prioritizes upcoming exam work while still allowing normal tasks.':'Plan normal schoolwork, homework, reading or revision. Exam setup is optional.'} action={<button className="premium-button" onClick={buildGeneralPlan}><ListPlus size={16}/>{workspace.profile?.study_mode==='exam'?'Build exam plan':'Build balanced plan'}</button>}/><form className="quick-task-composer connected-card" onSubmit={submit}><div><span>QUICK ADD</span><b>Add any study task</b></div><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">Any subject</option>{workspace.subjects.map((s:Row)=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Complete Maths exercise" required/><select value={activityType} onChange={e=>setActivityType(e.target.value)}><option value="learn">Learn</option><option value="practice">Practice</option><option value="revision">Revision</option><option value="homework">Homework</option><option value="read">Reading</option><option value="notes">Notes</option></select><select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[15,25,30,40,50,60].map(n=><option key={n} value={n}>{n} min</option>)}</select><button><Plus size={15}/>Add</button></form>{items.length?<section className="connected-card plan-list">{items.map((x:Row)=><article key={x.id}><button className={x.status==='done'?'check done':'check'} onClick={()=>setStatus(x,x.status==='done'?'todo':'done')}>{x.status==='done'?<Check/>:null}</button><div><span>{subjectMap.get(x.subject_id)?.name || x.activity_type}</span><b>{x.title}</b><small>{chapterMap.get(x.chapter_id)?.title || reasons(x.reason).join(' ')}</small></div><em>{x.estimated_minutes} min</em><button onClick={()=>start(x)}><Play size={15}/></button></article>)}</section>:<Empty icon={CalendarDays} title="No tasks yet" copy="Add a task above or build a balanced plan from your subjects. No date sheet is required."/>}</>
}

function FocusHub({workspace,subjectTime,start}:any){
  const [subjectId,setSubjectId]=useState(workspace.subjects[0]?.id || '');
  const [minutes,setMinutes]=useState(Number(workspace.profile?.preferred_focus_minutes||25));
  const [activityType,setActivityType]=useState('learn');
  const [goal,setGoal]=useState('');
  const recent=workspace.sessions.slice(0,6);
  const selected=subjectId||workspace.subjects[0]?.id||'';
  const subject=workspace.subjects.find((s:Row)=>s.id===selected);
  function launch(){
    start({subject_id:selected||null,title:goal.trim()||(`${activityType[0].toUpperCase()+activityType.slice(1)} ${subject?.name||'study'}`),activity_type:activityType,estimated_minutes:minutes},minutes);
  }
  const max=Math.max(...subjectTime.map((x:[string,number])=>x[1]),1);
  return <><SectionHead eyebrow="FOCUS ENGINE" title="Focus timer" copy="Start a study block for any subject at any time. No plan, syllabus or exam is required."/><div className="focus-hub-grid"><section className="connected-card focus-launcher"><div className="focus-launcher-head"><span><Timer/></span><div><small>QUICK FOCUS</small><h3>Build your session</h3></div></div><label>Subject<select value={selected} onChange={e=>setSubjectId(e.target.value)}>{workspace.subjects.map((s:Row)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Goal<input value={goal} onChange={e=>setGoal(e.target.value)} placeholder={subject?`What will you do in ${subject.name}?`:'What will you study?'}/></label><div className="focus-mode-grid">{['learn','practice','revision','homework','read'].map(mode=><button type="button" key={mode} className={activityType===mode?'active':''} onClick={()=>setActivityType(mode)}>{mode}</button>)}</div><div className="timer-presets">{[15,25,40,50,60].map(n=><button type="button" key={n} className={minutes===n?'active':''} onClick={()=>setMinutes(n)}><b>{n}</b><span>min</span></button>)}</div><button className="premium-button focus-start-button" disabled={!workspace.subjects.length} onClick={launch}><Play size={16}/>Start {minutes} minute focus</button></section><section className="connected-card focus-balance"><header><div><span>7-DAY BALANCE</span><h3>Subject study time</h3></div></header>{subjectTime.map(([name,min]:[string,number])=><div className="focus-balance-row" key={name}><span>{name}</span><div><i style={{width:Math.min(100,min/max*100)+'%'}}/></div><b>{min}m</b></div>)}{!subjectTime.length?<p className="muted">Start your first session to build subject balance.</p>:null}</section><section className="connected-card focus-recent"><header><div><span>RECENT</span><h3>Saved focus sessions</h3></div></header>{recent.length?recent.map((s:Row)=><div className="list-row" key={s.id}><span className="row-icon"><Clock3/></span><div><b>{s.goal||'Study session'}</b><small>{workspace.subjects.find((x:Row)=>x.id===s.subject_id)?.name||'General study'}</small></div><em>{s.duration_minutes} min</em></div>):<Empty icon={Timer} title="No sessions yet" copy="Your completed timer sessions will appear here automatically."/>}</section></div></>;
}


function LearningTracker({workspace,onAdd,onUpdate,onGenerateKit}:any){
  const [url,setUrl]=useState('');
  const [title,setTitle]=useState('');
  const [subjectId,setSubjectId]=useState('');
  const [chapterId,setChapterId]=useState('');
  const [topicId,setTopicId]=useState('');
  const [durationMinutes,setDurationMinutes]=useState(30);
  const [completion,setCompletion]=useState(0);
  const [watchedMinutes,setWatchedMinutes]=useState(0);
  const [summary,setSummary]=useState('');

  const subject=workspace.subjects.find((s:Row)=>s.id===subjectId);
  const bookIds=new Set(workspace.books.filter((b:Row)=>normalized(b.subject)===normalized(subject?.name)).map((b:Row)=>b.id));
  const chapters=workspace.chapters.filter((ch:Row)=>bookIds.has(ch.curriculum_book_id));
  const topics=workspace.topics.filter((t:Row)=>t.chapter_id===chapterId);
  const totalActiveSeconds=workspace.videoProgress.reduce((n:number,p:Row)=>{
    const precise=Number(p.tracking_version||1)>=2;
    return n+Number(precise?p.engaged_seconds||0:p.watched_seconds||0);
  },0);
  const totalActiveMinutes=Math.round(totalActiveSeconds/60);
  const verifiedComplete=workspace.videoProgress.filter((p:Row)=>{
    const precise=Number(p.tracking_version||1)>=2;
    return Number(precise?p.verified_completion||0:p.completion||0)>=90;
  }).length;
  const precisionLessons=workspace.videoProgress.filter((p:Row)=>Number(p.tracking_version||1)>=2).length;
  const precisionSessions=workspace.trackingSessions.length;
  const averageTrackingConfidence=workspace.trackingSessions.length
    ? Math.round(workspace.trackingSessions.reduce((n:number,s:Row)=>n+Number(s.tracking_confidence||0),0)/workspace.trackingSessions.length*100)
    : 0;
  const mappedTopics=new Set(workspace.videos.filter((v:Row)=>v.topic_id).map((v:Row)=>v.topic_id)).size;
  const companionCards=workspace.flashcards.filter((card:Row)=>card.source_kind==='learning_companion').length;
  const unresolvedDoubts=workspace.doubts.length;
  const recentPrecisionSessions=workspace.trackingSessions.slice(0,5);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    await onAdd({url,title,subjectId,chapterId,topicId,durationMinutes,completion,watchedMinutes,summary});
    setUrl('');setTitle('');setChapterId('');setTopicId('');setCompletion(0);setWatchedMinutes(0);setSummary('');
  }

  return <>
    <SectionHead eyebrow="CONNECTED LEARNING" title="Learning intelligence" copy="Track real learning evidence across YouTube, Physics Wallah, DIKSHA, Khan Academy and your own resources—with verified coverage separated from simple playback position." action={<div className="learning-primary-actions"><a className="premium-button" href="/theater"><Play size={16}/>Precision Theater</a><a className="secondary-button" href="/tools/bookmark-companion"><Sparkles size={15}/>Chrome Bookmark</a><a className="tertiary-button" href="/companion/connect">Extension Companion</a></div>}/>

    <div className="learning-metrics learning-metrics-six">
      <Metric icon={Video} label="Tracked lessons" value={String(workspace.videos.length)} detail={precisionLessons?precisionLessons+' using precision v2':'Across connected learning sources'}/>
      <Metric icon={Clock3} label="Active watch time" value={totalActiveMinutes?totalActiveMinutes+' min':'No active time yet'} detail="Visible, plausible playback only"/>
      <Metric icon={Check} label="Verified 90%+" value={String(verifiedComplete)} detail="Unique timeline coverage where available"/>
      <Metric icon={Timer} label="Precision sessions" value={String(precisionSessions)} detail="Separate measured study sessions"/>
      <Metric icon={Target} label="Topics mapped" value={String(mappedTopics)} detail="Curriculum topics connected"/>
      <Metric icon={Brain} label="Study intelligence" value={String(companionCards)+' cards'} detail={unresolvedDoubts?unresolvedDoubts+' unresolved learning doubts':averageTrackingConfidence?averageTrackingConfidence+'% avg tracking confidence':'Flashcards from your notes'}/>
    </div>

    <section className="connected-card precision-overview-card">
      <div className="precision-overview-main">
        <span>PRECISION TRACKING V2</span>
        <h3>Position is no longer treated as watch time.</h3>
        <p>StudyOS now separates active wall-clock learning, content played, furthest position and verified unique coverage. Seeking forward does not inflate verified completion.</p>
        <div className="precision-overview-badges"><b>Seek filtering</b><b>Visible-playback evidence</b><b>Offline-safe cumulative sync</b><b>Real session counting</b></div>
      </div>
      <div className="precision-overview-score">
        <strong>{averageTrackingConfidence||'—'}{averageTrackingConfidence?<small>%</small>:null}</strong>
        <span>average evidence confidence</span>
        <a href="/theater"><Play size={14}/>Open Precision Theater</a>
      </div>
      <div className="precision-recent-sessions">
        <header><span>RECENT PRECISION SESSIONS</span><b>{precisionSessions} total</b></header>
        {recentPrecisionSessions.length?recentPrecisionSessions.map((s:Row)=>{
          const video=workspace.videos.find((v:Row)=>v.id===s.video_id);
          return <article key={s.id}><i className={'source-'+String(s.source||'theater')}></i><div><b>{video?.title||'Tracked lesson'}</b><small>{String(s.source||'theater').replaceAll('_',' ')} · {Math.round(Number(s.tracking_confidence||0)*100)}% evidence · {Math.round(Number(s.engaged_seconds||0)/60)} active min</small></div><em>{Math.round(Number(s.coverage_seconds||0)/60)}m covered</em></article>
        }):<p>No precision sessions yet. Open a YouTube lesson in Theater to create one.</p>}
      </div>
    </section>

    <section className="connected-card learning-add-card">
      <header><div><span>ADD LEARNING</span><h3>Connect a lesson manually</h3><p>Use this for sources StudyOS cannot measure automatically. Manual values stay labeled separately from precision evidence.</p></div></header>
      <form className="learning-add-form" onSubmit={submit}>
        <label className="learning-wide">Lesson URL<input type="url" required value={url} onChange={e=>setUrl(e.target.value)} placeholder="YouTube, PW, DIKSHA, Khan Academy, school portal…"/></label>
        <label className="learning-wide">Lesson title<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Force and Pressure — One Shot"/></label>
        <label>Subject<select value={subjectId} onChange={e=>{setSubjectId(e.target.value);setChapterId('');setTopicId('')}}><option value="">Unassigned</option>{workspace.subjects.map((s:Row)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Chapter<select value={chapterId} onChange={e=>{setChapterId(e.target.value);setTopicId('')}}><option value="">No chapter</option>{chapters.map((ch:Row)=><option key={ch.id} value={ch.id}>{ch.title}</option>)}</select></label>
        <label>Topic<select value={topicId} onChange={e=>setTopicId(e.target.value)}><option value="">No topic</option>{topics.map((t:Row)=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <label>Video length<input type="number" min="1" max="720" value={durationMinutes} onChange={e=>setDurationMinutes(Number(e.target.value))}/><small>minutes</small></label>
        <label>Watched<input type="number" min="0" max="720" value={watchedMinutes} onChange={e=>setWatchedMinutes(Number(e.target.value))}/><small>minutes</small></label>
        <label>Completion<select value={completion} onChange={e=>setCompletion(Number(e.target.value))}>{[0,10,25,50,75,90,100].map(n=><option key={n} value={n}>{n}%</option>)}</select></label>
        <label className="learning-wide">What did you learn?<textarea value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Write or paste a short summary, formulas, concepts, doubts, or key takeaways…"/></label>
        <button className="premium-button learning-save"><Plus size={15}/>Save manual learning</button>
      </form>
    </section>

    <section className="learning-history">
      <div className="learning-history-head"><div><span>YOUR LEARNING STREAM</span><h3>Resume, review and build Study Kits</h3></div><small>{workspace.videos.length} tracked</small></div>
      {workspace.videos.length?<div className="learning-card-grid">{workspace.videos.map((video:Row)=><LearningVideoCard key={video.id} video={video} workspace={workspace} onUpdate={onUpdate} onGenerateKit={onGenerateKit}/>)}</div>:<Empty icon={Video} title="No connected lessons yet" copy="Open Precision Theater for YouTube or add a lesson manually above."/>}
    </section>
  </>
}

function LearningVideoCard({video,workspace,onUpdate,onGenerateKit}:any){
  const progress=workspace.videoProgress.find((p:Row)=>p.video_id===video.id);
  const resource=workspace.resources.find((r:Row)=>r.metadata?.kind==='video_summary'&&r.metadata?.video_id===video.id);
  const kit=workspace.resources.find((r:Row)=>r.metadata?.kind==='ai_learning_artifacts'&&r.metadata?.video_id===video.id);
  const precise=Number(progress?.tracking_version||1)>=2;
  const autoEvidence=precise&&progress?.tracking_source&&progress.tracking_source!=='manual';
  const evidenceCompletion=Math.round(Number(precise?progress?.verified_completion||0:progress?.completion||0));
  const evidenceMinutes=Math.round(Number(precise?progress?.engaged_seconds||0:progress?.watched_seconds||0)/60);
  const [completion,setCompletion]=useState(evidenceCompletion);
  const [watchedMinutes,setWatchedMinutes]=useState(evidenceMinutes);
  const [summary,setSummary]=useState(String(resource?.metadata?.summary||''));
  const subject=workspace.subjects.find((s:Row)=>s.id===video.subject_id);
  const chapter=workspace.chapters.find((ch:Row)=>ch.id===video.chapter_id);
  const topic=workspace.topics.find((t:Row)=>t.id===video.topic_id);
  const resumeSeconds=Number(progress?.last_position_seconds||0);
  const furthestSeconds=Number(precise?progress?.furthest_position_seconds||0:resumeSeconds);
  const source=String(progress?.tracking_source||'manual');
  const confidence=Number(progress?.confidence||0);
  const sessionCount=Number(progress?.sessions||0);

  return <article className={'connected-card learning-video-card '+(autoEvidence?'precision-video-card':'')}>
    <div className="learning-source-row"><span className={'provider-chip provider-'+String(video.provider||'other')}>{providerLabel(video)}</span><span className={autoEvidence?'precision-evidence-chip':''}>{autoEvidence?'VERIFIED '+evidenceCompletion+'%':completion+'% watched'}</span></div>
    <h3>{video.title}</h3>
    <p>{[subject?.name,chapter?.title,topic?.title].filter(Boolean).join(' · ')||'Not mapped to curriculum yet'}</p>
    <div className="learning-progress"><i style={{width:Math.max(0,Math.min(100,autoEvidence?evidenceCompletion:completion))+'%'}}/></div>

    {autoEvidence?<div className="video-evidence-grid">
      <div><span>Verified coverage</span><b>{evidenceCompletion}%</b></div>
      <div><span>Active time</span><b>{evidenceMinutes}m</b></div>
      <div><span>Resume</span><b>{fmtCompact(resumeSeconds)}</b></div>
      <div><span>Furthest</span><b>{fmtCompact(furthestSeconds)}</b></div>
      <div><span>Sessions</span><b>{sessionCount}</b></div>
      <div><span>Evidence</span><b>{confidence?Math.round(confidence/5*100)+'%':'—'}</b></div>
    </div>:<div className="learning-progress-controls">
      <label>Progress<select value={completion} onChange={e=>setCompletion(Number(e.target.value))}>{[0,10,25,50,75,90,100].map(n=><option key={n} value={n}>{n}%</option>)}</select></label>
      <label>Watched<input type="number" min="0" max="720" value={watchedMinutes} onChange={e=>setWatchedMinutes(Number(e.target.value))}/><small>min</small></label>
    </div>}

    {autoEvidence?<div className="video-evidence-note"><ShieldCheck size={14}/><span>Progress is protected precision evidence from <b>{source.replaceAll('_',' ')}</b>. Manual edits can change the summary, not the measured watch data.</span></div>:null}
    <label className="learning-summary-label">Learning summary<textarea value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Key concepts, formulas, examples, doubts…"/></label>
    {kit?<div className="learning-kit-preview"><span>STUDY KIT</span><p>{String(kit.metadata?.summary||'')}</p><small>{Array.isArray(kit.metadata?.key_points)?kit.metadata.key_points.length:0} key points · {kit.metadata?.ai_used?'AI-assisted':'quick fallback'}</small></div>:null}
    <div className="learning-card-actions">
      {video.provider==='youtube'&&video.url?<a href={'/theater?url='+encodeURIComponent(String(video.url))+'&title='+encodeURIComponent(String(video.title||''))}><Play size={14}/>Open in Theater</a>:video.url?<a href={video.url} target="_blank" rel="noreferrer"><Play size={14}/>Open lesson</a>:null}
      <button onClick={()=>onUpdate(video,{completion,watchedMinutes,summary})}><Check size={14}/>{autoEvidence?'Save summary':'Save progress'}</button>
      <button className="kit-button" disabled={summary.trim().length<20} onClick={()=>onGenerateKit(video,summary)}><Sparkles size={14}/>Build study kit</button>
    </div>
  </article>
}

function fmtCompact(seconds:number){
  const total=Math.max(0,Math.round(seconds||0));
  const minutes=Math.floor(total/60);
  const secs=String(total%60).padStart(2,'0');
  return minutes+':'+secs;
}

function SettingsPanel({workspace,email,dark,setDark,subjectsPerDay,setSubjectsPerDay,studyMode,setStudyMode,saveProfile,saveNotifications,sendPasswordReset,signOut,openView}:any){
  const profile=workspace.profile||{};
  const notifications=workspace.notificationPreferences||{};
  const [form,setForm]=useState({
    full_name:profile.full_name||'',
    class_level:Number(profile.class_level||8),
    board:profile.board||'CBSE',
    academic_session:profile.academic_session||'2026-27',
    school_name:profile.school_name||'',
    timezone:profile.timezone||'Asia/Kolkata',
    preferred_focus_minutes:Number(profile.preferred_focus_minutes||25)
  });
  const [notify,setNotify]=useState({
    browser_enabled:notifications.browser_enabled??true,
    email_enabled:notifications.email_enabled??false,
    revision_enabled:notifications.revision_enabled??true,
    homework_enabled:notifications.homework_enabled??true,
    exam_enabled:notifications.exam_enabled??true,
    weekly_report_enabled:notifications.weekly_report_enabled??true,
    quiet_hours_start:notifications.quiet_hours_start||'',
    quiet_hours_end:notifications.quiet_hours_end||''
  });
  return <><SectionHead eyebrow="PERSONALIZATION" title="Settings & account" copy="Customize how StudyOS plans your day, manage your academic profile, notifications and account access."/><div className="settings-grid"><section className="connected-card settings-section settings-profile"><header><div><span>PROFILE</span><h3>Academic identity</h3></div></header><form onSubmit={async e=>{e.preventDefault();await saveProfile(form)}}><label>Name<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><div className="settings-row"><label>Class<select value={form.class_level} onChange={e=>setForm({...form,class_level:Number(e.target.value)})}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>Class {n}</option>)}</select></label><label>Board<select value={form.board} onChange={e=>setForm({...form,board:e.target.value})}><option>CBSE</option><option>ICSE</option><option>State Board</option><option>IB</option><option>Cambridge</option><option>Custom</option></select></label></div><div className="settings-row"><label>Academic session<input value={form.academic_session} onChange={e=>setForm({...form,academic_session:e.target.value})}/></label><label>School<input value={form.school_name} onChange={e=>setForm({...form,school_name:e.target.value})} placeholder="Optional"/></label></div><div className="settings-row"><label>Default focus<select value={form.preferred_focus_minutes} onChange={e=>setForm({...form,preferred_focus_minutes:Number(e.target.value)})}>{[15,25,30,40,50,60].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><label>Timezone<input value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})}/></label></div><button className="premium-button"><Check size={15}/>Save profile</button></form></section><section className="connected-card settings-section"><header><div><span>PLANNER</span><h3>Daily study style</h3></div></header><div className="setting-control"><div><b>Study mode</b><p>General balances everyday learning. Exam Mode prioritizes upcoming exams and confirmed syllabus.</p></div><div className="theme-segment"><button className={studyMode==='general'?'active':''} onClick={()=>setStudyMode('general')}><BookOpen size={14}/>General</button><button className={studyMode==='exam'?'active':''} onClick={()=>setStudyMode('exam')}><Target size={14}/>Exam</button></div></div><div className="setting-control"><div><b>Subjects per day</b><p>Balanced Shuffle Plan will try to cover this many different subjects each day.</p></div><select value={subjectsPerDay} onChange={e=>setSubjectsPerDay(Number(e.target.value))}>{[2,3,4,5,6].map(n=><option key={n} value={n}>{n} subjects</option>)}</select></div><div className="setting-control"><div><b>Appearance</b><p>Switch the StudyOS workspace between light and dark themes.</p></div><div className="theme-segment"><button className={!dark?'active':''} onClick={()=>setDark(false)}><Sun size={14}/>Light</button><button className={dark?'active':''} onClick={()=>setDark(true)}><Moon size={14}/>Dark</button></div></div><div className="settings-callout"><Sparkles size={16}/><p><b>Balanced Shuffle is stable for the day.</b> It uses recent subject time, unfinished curriculum coverage and a daily deterministic shuffle so refreshing the page does not randomly destroy your plan.</p></div><div className="settings-tools"><span>STUDY TOOLS</span><div><button onClick={()=>openView('Focus')}><Timer size={15}/><b>Focus Timer</b><small>Quick timed study</small></button><button onClick={()=>openView('Learning')}><Video size={15}/><b>Learning Tracker</b><small>Theater, Chrome bookmark & connected lessons</small></button><button onClick={()=>openView('Today')}><ListPlus size={15}/><b>Daily Planner</b><small>2-subject default shuffle</small></button><button onClick={()=>openView('Library')}><Library size={15}/><b>NCERT Library</b><small>Current books & chapters</small></button></div></div></section><section className="connected-card settings-section"><header><div><span>NOTIFICATIONS</span><h3>Study reminders</h3></div></header><form onSubmit={async e=>{e.preventDefault();await saveNotifications(notify)}} className="notification-settings">{[['browser_enabled','Browser reminders'],['email_enabled','Email reminders'],['revision_enabled','Revision due'],['homework_enabled','Homework'],['exam_enabled','Exam updates'],['weekly_report_enabled','Weekly report']].map(([key,label])=><label className="toggle-row" key={key}><div><b>{label}</b><small>{key==='exam_enabled'?'Only matters when you add exams':'You can change this anytime'}</small></div><input type="checkbox" checked={Boolean((notify as Row)[key])} onChange={e=>setNotify({...notify,[key]:e.target.checked})}/></label>)}<div className="settings-row"><label>Quiet hours start<input type="time" value={notify.quiet_hours_start} onChange={e=>setNotify({...notify,quiet_hours_start:e.target.value})}/></label><label>Quiet hours end<input type="time" value={notify.quiet_hours_end} onChange={e=>setNotify({...notify,quiet_hours_end:e.target.value})}/></label></div><button className="secondary-button"><Check size={15}/>Save notifications</button></form></section><section className="connected-card settings-section settings-account"><header><div><span>ACCOUNT</span><h3>Security & access</h3></div></header><div className="account-email"><span>Email</span><b>{email}</b></div><button className="secondary-button" onClick={sendPasswordReset}>Send password reset email</button><div className="privacy-note"><LockKeyhole/><div><b>Your learning history is private to your account.</b><p>Study sessions, tracked videos, summaries and academic documents are stored in your authenticated StudyOS workspace.</p></div></div><button className="danger-soft-button" onClick={signOut}><LogOut size={15}/>Sign out of StudyOS</button></section></div></>
}

function Subjects({workspace,onAdd,start}:{workspace:Workspace;onAdd:(name:string)=>Promise<void>;start:(item:Row,minutes?:number)=>void}){
  const [name,setName]=useState('');
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [chapterSearch,setChapterSearch]=useState<Record<string,string>>({});
  async function submit(e:React.FormEvent){e.preventDefault();if(!name.trim())return;await onAdd(name);setName('');}
  return <><SectionHead eyebrow="ACADEMIC MAP" title="Subjects & chapters" copy="Current Class 8 curriculum metadata is prefilled where verified. Progress stays honest: chapters remain Not started until you actually study them." action={<form className="add-subject-inline" onSubmit={submit}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Add another subject"/><button><Plus size={15}/>Add</button></form>}/><div className="subject-card-grid">{workspace.subjects.map(s=>{
    const sessions=workspace.sessions.filter(x=>x.subject_id===s.id);
    const books=workspace.books.filter((b:Row)=>normalized(b.subject)===normalized(s.name));
    const bookIds=new Set(books.map((b:Row)=>b.id));
    const allChapters=workspace.chapters.filter((ch:Row)=>bookIds.has(ch.curriculum_book_id)).sort((a:Row,b:Row)=>Number(a.sort_order||a.chapter_number||0)-Number(b.sort_order||b.chapter_number||0));
    const q=(chapterSearch[s.id]||'').toLowerCase().trim();
    const chapters=q?allChapters.filter((ch:Row)=>String(ch.title).toLowerCase().includes(q)):allChapters;
    const done=allChapters.filter((ch:Row)=>Number(workspace.progress.find((p:Row)=>p.chapter_id===ch.id)?.completion||0)>=100).length;
    const inProgress=allChapters.filter((ch:Row)=>{const v=Number(workspace.progress.find((p:Row)=>p.chapter_id===ch.id)?.completion||0);return v>0&&v<100}).length;
    const isOpen=Boolean(expanded[s.id]);
    return <section className={'connected-card subject-real subject-with-chapters '+(isOpen?'expanded':'')} key={s.id}>
      <header><span style={{background:s.color}}>{s.name.slice(0,2).toUpperCase()}</span><div><h3>{s.name}</h3><p>{books[0]?.title||'Custom subject'} · {allChapters.length} chapter{allChapters.length===1?'':'s'}</p></div><button className="subject-expand-button" onClick={()=>setExpanded(v=>({...v,[s.id]:!v[s.id]}))}>{isOpen?<X size={16}/>:<ChevronRight size={16}/>}</button></header>
      <div className="subject-overview-row"><div><span>Completed</span><b>{done}/{allChapters.length||'—'}</b></div><div><span>In progress</span><b>{inProgress}</b></div><div><span>Sessions</span><b>{sessions.length}</b></div></div>
      <div className="mini-progress"><i style={{width:(allChapters.length?done/allChapters.length*100:0)+'%',background:s.color}}/></div>
      {isOpen?<div className="subject-chapter-panel">
        <div className="chapter-panel-head"><div><span>CURRENT CHAPTERS</span><b>{books.map((b:Row)=>b.title).join(' + ')||'No verified book linked'}</b></div>{allChapters.length>5?<input value={chapterSearch[s.id]||''} onChange={e=>setChapterSearch(v=>({...v,[s.id]:e.target.value}))} placeholder="Search chapters…"/>:null}</div>
        {chapters.length?<div className="chapter-list">{chapters.map((ch:Row)=>{
          const p=workspace.progress.find((x:Row)=>x.chapter_id===ch.id);
          const completion=Math.max(0,Math.min(100,Number(p?.completion||0)));
          const status=completion>=100?'Completed':completion>0?'In progress':'Not started';
          return <article key={ch.id}><span className="chapter-number">{ch.chapter_number||'•'}</span><div className="chapter-copy"><b>{ch.title}</b><small>{ch.source_page||'Current verified curriculum metadata'} · {status}</small><div className="chapter-progress"><i style={{width:completion+'%',background:s.color}}/></div></div><button onClick={()=>start({subject_id:s.id,chapter_id:ch.id,title:ch.title,activity_type:completion>0?'practice':'learn',estimated_minutes:Number(workspace.profile?.preferred_focus_minutes||25)})}><Play size={14}/>{completion>0?'Continue':'Start'}</button></article>
        })}</div>:<div className="chapter-empty"><BookOpen/><div><b>No verified chapter metadata yet</b><p>You can still study this subject normally while StudyOS waits for a verified curriculum index.</p></div></div>}
      </div>:<button className="subject-show-chapters" onClick={()=>setExpanded(v=>({...v,[s.id]:true}))}><BookOpen size={14}/>Show current chapters</button>}
    </section>})}</div>{!workspace.subjects.length&&<Empty icon={BookOpen} title="No subjects yet" copy="Add a subject above and start a timer immediately—no exam setup needed."/>}</>;
}

function LibraryView({workspace}:{workspace:Workspace}){return <><SectionHead eyebrow="VERIFIED CURRICULUM" title="NCERT & academic library" copy="Only current curriculum records from the StudyOS academic source registry are shown. Full copyrighted book text is not copied into the app."/><div className="library-grid">{workspace.books.map(b=>{const chapters=workspace.chapters.filter(c=>c.curriculum_book_id===b.id);return <section className="connected-card book-card" key={b.id}><div className="book-cover"><BookOpen/></div><div><span>{b.subject} · Class {b.class_level}</span><h3>{b.title}</h3><p>{b.edition_label || b.academic_year}</p><small>{chapters.length?chapters.length+' verified chapters':'Chapter index awaiting verification'}</small><div className="book-actions"><a href={b.source_url} target="_blank" rel="noreferrer">Open official source</a></div></div></section>})}</div>{!workspace.books.length&&<Empty icon={Library} title="No verified books found for this profile" copy="StudyOS will not substitute guessed textbook data. An administrator must verify and publish the curriculum version first."/>}</>}

function Syllabus({workspace,subjectMap,chapterMap,upload}:any){return <><SectionHead eyebrow="SYLLABUS INTELLIGENCE" title="Exam syllabus" copy="Current exam items are compared using real stored flags such as new content, prior assessment count, blueprint weight, and priority." action={<button className="premium-button" onClick={upload}><Upload size={16}/>Upload syllabus</button>}/>{workspace.syllabus.length?<section className="connected-card data-table"><header><span>Item</span><span>Subject</span><span>State</span><span>Priority</span></header>{workspace.syllabus.map((x:Row)=><article key={x.id}><div><b>{x.label || chapterMap.get(x.chapter_id)?.title || 'Syllabus item'}</b><small>{x.is_new_content?'New in this assessment':x.prior_assessment_count?'Previously assessed':'Unclassified history'}</small></div><span>{subjectMap.get(x.subject_id)?.name || '—'}</span><span className={x.is_new_content?'state-new':'state-old'}>{x.inclusion}</span><b>{Math.round(Number(x.priority_score||0))}</b></article>)}</section>:<Empty icon={Target} title="No confirmed syllabus items" copy="Upload a syllabus PDF. StudyOS stores extracted items separately and can require confirmation before they affect planning." action={<button className="premium-button" onClick={upload}>Upload syllabus</button>}/>}</>}

function Exams({workspace,subjectMap}:{workspace:Workspace;subjectMap:Map<any,any>}){return <><SectionHead eyebrow="OPTIONAL EXAM MODE" title="Exam roadmap" copy="Use this when you have an exam. StudyOS remains fully usable without a date sheet."/><div className="exam-grid">{workspace.exams.map(e=><section className="connected-card exam-card" key={e.id}><span>{subjectMap.get(e.subject_id)?.name || 'Exam'}</span><h3>{e.name}</h3><strong>{daysUntil(e.exam_date)}<small> days</small></strong><p>{formatDate(e.exam_date)}{e.maximum_marks?' · '+e.maximum_marks+' marks':''}</p><em>{e.confirmed?'Confirmed':'Needs confirmation'}</em></section>)}</div>{!workspace.exams.length&&<Empty icon={FileText} title="No upcoming exams — that is okay" copy="General Study Mode, focus timer, subject tracking, balanced plans, revision and analytics all work without a date sheet."/>}</>}

function Revision({workspace,chapterMap,start}:any){return <><SectionHead eyebrow="SPACED REVISION" title="Revision queue" copy="Due items come directly from your revision schedule."/><div className="revision-real-grid">{workspace.revisions.map((r:Row)=><section className="connected-card revision-real" key={r.id}><span>R{r.stage || 1}</span><h3>{chapterMap.get(r.chapter_id)?.title || 'Revision item'}</h3><p>Due {formatDate(r.due_at)} · interval {r.interval_days || 0} days</p><button onClick={()=>start({title:chapterMap.get(r.chapter_id)?.title || 'Revision',subject_id:r.subject_id,chapter_id:r.chapter_id,estimated_minutes:10,reason:['Revision due']})}><Play size={15}/>Start revision</button></section>)}</div>{!workspace.revisions.length&&<Empty icon={Brain} title="Nothing due right now" copy="Revision items will appear after StudyOS schedules them from completed learning and assessment evidence."/>}</>}

function Papers({workspace,subjectMap,generate}:{workspace:Workspace;subjectMap:Map<any,any>;generate:(examId:string,subjectId?:string)=>Promise<void>}){return <><SectionHead eyebrow="QUESTION PAPER STUDIO" title="Practice papers" copy="Papers are generated only from confirmed syllabus + blueprint records, then validated before saving."/><div className="paper-generate-grid">{workspace.exams.map(exam=>{const hasBlueprint=workspace.blueprints.some(b=>b.exam_id===exam.id&&b.status==='confirmed');const hasSyllabus=workspace.syllabus.some(s=>s.exam_id===exam.id&&s.user_verified&&s.inclusion!=='excluded');return <section className="connected-card paper-generator" key={exam.id}><div><span>{subjectMap.get(exam.subject_id)?.name || 'Exam'}</span><h3>{exam.name}</h3><p>{hasSyllabus?'Syllabus confirmed':'Syllabus needed'} · {hasBlueprint?'Blueprint confirmed':'Blueprint needed'}</p></div><button disabled={!hasBlueprint||!hasSyllabus||!exam.subject_id} onClick={()=>generate(exam.id,exam.subject_id)}><Sparkles size={14}/>Generate paper</button></section>})}</div><div className="paper-grid">{workspace.papers.map(p=><section className="connected-card paper-card" key={p.id}><FileText/><div><span>{p.status}</span><h3>{p.title}</h3><p>{p.total_marks?Math.round(Number(p.total_marks))+' marks':'Marks not set'}{p.duration_minutes?' · '+p.duration_minutes+' min':''}</p></div><ChevronRight/></section>)}</div>{!workspace.exams.length&&<Empty icon={FileText} title="No exam context yet" copy="Upload and confirm your date sheet, syllabus, and blueprint first. StudyOS will not invent a paper pattern."/>}</>}

function Analytics({workspace,subjectTime,weekMinutes}:{workspace:Workspace;subjectTime:Array<[string,number]>;weekMinutes:number}){const max=Math.max(...subjectTime.map(x=>x[1]),1);return <><SectionHead eyebrow="REAL ANALYTICS" title="Your progress" copy="Every chart is computed from saved sessions and progress rows; insufficient data stays visibly empty."/><div className="analytics-real-grid"><section className="connected-card"><header><span>LAST 7 DAYS</span><h3>Study time</h3></header><div className="big-number">{weekMinutes}<small> min</small></div><p className="muted">From {workspace.sessions.filter(s=>Number(s.duration_minutes)>0).length} saved sessions.</p></section><section className="connected-card"><header><span>SUBJECT BALANCE</span><h3>Where your time went</h3></header>{subjectTime.length?subjectTime.map(([name,min])=><div className="balance-real" key={name}><span>{name}</span><div><i style={{width:(min/max*100)+'%'}}/></div><b>{min}m</b></div>):<p className="muted">Not enough session data yet.</p>}</section><section className="connected-card analytics-wide"><header><span>MASTERY EVIDENCE</span><h3>Tracked chapters</h3></header>{workspace.progress.length?<div className="progress-grid">{workspace.progress.slice(0,12).map(p=><div key={p.id}><span>{pct(p.mastery)}%</span><div><i style={{height:pct(p.mastery)+'%'}}/></div><small>{pct(p.completion)}% done</small></div>)}</div>:<p className="muted">No chapter mastery evidence yet.</p>}</section></div></>}

function Documents({workspace,upload,confirm}:{workspace:Workspace;upload:()=>void;confirm:(extractionId:string,examId?:string)=>Promise<void>}){const [examChoice,setExamChoice]=useState<Record<string,string>>({});return <><SectionHead eyebrow="ACADEMIC DOCUMENTS" title="Document center" copy="Upload → AI extraction → review → confirm. Nothing changes your plan before approval." action={<button className="premium-button" onClick={upload}><Upload size={16}/>Upload document</button>}/><button className="drop-zone-real" onClick={upload}><Upload/><b>Upload syllabus, date sheet, blueprint, previous paper, worksheet, or notes</b><span>PDF, JPG, PNG · private storage · AI review-first extraction</span></button>{workspace.extractions.filter(x=>x.status==='needs_confirmation').map(ex=>{const needsExam=ex.extraction_type==='syllabus'||ex.extraction_type==='blueprint';const payload=(ex.payload||{}) as Row;return <section className="connected-card extraction-review" key={ex.id}><div><span>READY TO REVIEW · {Math.round(Number(ex.confidence||0)*100)}% confidence</span><h3>{String(ex.extraction_type).replaceAll('_',' ')}</h3><p>{payload.summary || 'Review the extracted structure before it changes StudyOS.'}</p></div>{needsExam?<select value={examChoice[ex.id]||''} onChange={e=>setExamChoice(v=>({...v,[ex.id]:e.target.value}))}><option value="">Choose target exam…</option>{workspace.exams.map(e=><option key={e.id} value={e.id}>{e.name} · {formatDate(e.exam_date)}</option>)}</select>:null}<button disabled={needsExam&&!examChoice[ex.id]} onClick={()=>confirm(ex.id,examChoice[ex.id]||undefined)}><Check size={14}/>Confirm extraction</button></section>})}{workspace.documents.length?<section className="connected-card data-table documents-real"><header><span>File</span><span>Kind</span><span>Status</span><span>Added</span></header>{workspace.documents.map(d=><article key={d.id}><div><b>{d.file_name}</b><small>{d.mime_type || 'document'}</small></div><span>{d.kind}</span><span>{d.processing_status}</span><b>{formatDate(d.created_at)}</b></article>)}</section>:null}</>}

function Resources({workspace}:{workspace:Workspace}){return <><SectionHead eyebrow="LEARNING LIBRARY" title="Resources" copy="Your own notes, videos, worksheets, websites, and papers can be linked to real subjects, chapters, and topics."/><div className="resource-real-grid">{workspace.resources.map(r=><section className="connected-card resource-real" key={r.id}><span><Library/></span><div><small>{r.resource_type}</small><h3>{r.title}</h3><p>{r.source_label || 'Personal resource'}</p>{r.url?<a href={r.url} target="_blank" rel="noreferrer">Open resource</a>:null}</div></section>)}</div>{!workspace.resources.length&&<Empty icon={Library} title="No resources saved" copy="Add your own study material and StudyOS will keep it tied to the correct academic context."/>}</>}