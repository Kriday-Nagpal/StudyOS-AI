/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, LockKeyhole, Sparkles, Video } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import StudyOSLogo from '@/components/studyos-logo';

type Row = Record<string, any>;

function normalized(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');
}

function providerForUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube';
    if (host.includes('diksha.gov.in')) return 'diksha';
    if (host.includes('khanacademy.org')) return 'khan_academy';
    return 'other';
  } catch {
    return 'other';
  }
}

function providerLabel(url: string) {
  const value = url.toLowerCase();
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'YouTube';
  if (value.includes('pw.live') || value.includes('physicswallah') || value.includes('pwskills')) return 'Physics Wallah';
  if (value.includes('diksha.gov.in')) return 'DIKSHA';
  if (value.includes('khanacademy.org')) return 'Khan Academy';
  return 'Learning page';
}

export default function LearningCompanionCapture({
  initialUrl,
  initialTitle,
  initialText,
  initialPosition = 0,
  initialDuration = 0,
  initialSource = 'manual',
  initialPlaybackRate = 1,
}: {
  initialUrl: string;
  initialTitle: string;
  initialText: string;
  initialPosition?: number;
  initialDuration?: number;
  initialSource?: string;
  initialPlaybackRate?: number;
}) {
  const supabase = getSupabaseClient();
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState('');
  const [session,setSession]=useState<any>(null);
  const [profile,setProfile]=useState<Row|null>(null);
  const [subjects,setSubjects]=useState<Row[]>([]);
  const [books,setBooks]=useState<Row[]>([]);
  const [chapters,setChapters]=useState<Row[]>([]);
  const [topics,setTopics]=useState<Row[]>([]);
  const [url,setUrl]=useState(initialUrl);
  const [title,setTitle]=useState(initialTitle);
  const [notes,setNotes]=useState(initialText.slice(0,12000));
  const [subjectId,setSubjectId]=useState('');
  const [chapterId,setChapterId]=useState('');
  const [topicId,setTopicId]=useState('');
  const isBookmarkSnapshot=initialSource==='bookmark';
  const initialPositionPercent = initialDuration > 0 ? Math.max(0,Math.min(100,initialPosition/initialDuration*100)) : 0;
  const [completion,setCompletion]=useState(0);
  const [watchedMinutes,setWatchedMinutes]=useState(0);
  const [generateKit,setGenerateKit]=useState(Boolean(initialText.trim()));
  const [result,setResult]=useState<{flashcards?:number;doubts?:number;ai?:boolean}|null>(null);

  useEffect(()=>{
    if(!supabase)return;
    let active=true;
    void (async()=>{
      const {data}=await supabase.auth.getSession();
      if(!active)return;
      if(!data.session){
        const next=window.location.pathname+window.location.search;
        window.location.replace('/auth?mode=signin&next='+encodeURIComponent(next));
        return;
      }
      setSession(data.session);
      const userId=data.session.user.id;
      const [{data:p},{data:s}]=await Promise.all([
        supabase.from('profiles').select('*').eq('id',userId).maybeSingle(),
        supabase.from('subjects').select('*').order('sort_order'),
      ]);
      if(!active)return;
      setProfile(p||null);
      setSubjects(s||[]);
      if(p?.class_level&&p?.board){
        const {data:b}=await supabase.from('curriculum_books').select('*')
          .eq('class_level',p.class_level).eq('board',p.board).eq('status','current').order('subject');
        setBooks(b||[]);
        if(b?.length){
          const {data:ch}=await supabase.from('curriculum_chapters').select('*')
            .in('curriculum_book_id',b.map((x:Row)=>x.id)).order('sort_order');
          setChapters(ch||[]);
          if(ch?.length){
            const {data:t}=await supabase.from('curriculum_topics').select('*')
              .in('chapter_id',ch.map((x:Row)=>x.id)).order('sort_order');
            setTopics(t||[]);
          }
        }
      }
      setLoading(false);
    })();
    return()=>{active=false};
  },[supabase]);

  const subject=subjects.find(s=>s.id===subjectId);
  const matchingBookIds=useMemo(()=>new Set(books.filter(b=>normalized(b.subject)===normalized(subject?.name)).map(b=>b.id)),[books,subject]);
  const availableChapters=chapters.filter(ch=>matchingBookIds.has(ch.curriculum_book_id));
  const availableTopics=topics.filter(t=>t.chapter_id===chapterId);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!supabase||!session)return;
    setSaving(true);setError('');setResult(null);
    let parsed:URL;
    try{parsed=new URL(url.trim())}catch{setError('Enter a valid lesson URL.');setSaving(false);return;}
    if(!['http:','https:'].includes(parsed.protocol)){setError('Only http/https lesson links are supported.');setSaving(false);return;}

    const provider=providerForUrl(parsed.toString());
    const videoRes=await supabase.from('videos').upsert({
      user_id:session.user.id,
      subject_id:subjectId||null,
      chapter_id:chapterId||null,
      topic_id:topicId||null,
      provider,
      external_id:parsed.toString(),
      title:title.trim()||parsed.hostname,
      url:parsed.toString(),
      classification_confidence:1,
      user_verified:true
    },{onConflict:'user_id,provider,external_id'}).select('*').single();

    if(videoRes.error||!videoRes.data){setError(videoRes.error?.message||'Could not save this lesson.');setSaving(false);return;}
    const video=videoRes.data;

    const {data:existingProgress}=await supabase.from('video_progress').select('*').eq('user_id',session.user.id).eq('video_id',video.id).maybeSingle();
    const snapshotPosition=Math.max(0,Math.round(initialPosition||0));
    const manualWatched=Math.max(0,Math.round(watchedMinutes*60));
    const preciseExisting=Number(existingProgress?.tracking_version||1)>=2;
    const progressPayload=isBookmarkSnapshot ? {
      user_id:session.user.id,
      video_id:video.id,
      watched_seconds:Number(existingProgress?.watched_seconds||0),
      completion:Number(existingProgress?.completion||0),
      verified_completion:Number(existingProgress?.verified_completion||0),
      engaged_seconds:Number(existingProgress?.engaged_seconds||0),
      content_seconds:Number(existingProgress?.content_seconds||0),
      last_position_seconds:snapshotPosition,
      furthest_position_seconds:Math.max(Number(existingProgress?.furthest_position_seconds||existingProgress?.last_position_seconds||0),snapshotPosition),
      sessions:Number(existingProgress?.sessions||0),
      confidence:existingProgress?.confidence||4,
      tracking_version:preciseExisting?Number(existingProgress?.tracking_version||2):1,
      tracking_source:preciseExisting?existingProgress?.tracking_source||'theater':'bookmark',
      coverage_ranges:Array.isArray(existingProgress?.coverage_ranges)?existingProgress.coverage_ranges:[],
      last_watched_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    } : {
      user_id:session.user.id,
      video_id:video.id,
      watched_seconds:manualWatched,
      completion:Math.max(0,Math.min(100,completion)),
      last_position_seconds:manualWatched,
      furthest_position_seconds:Math.max(Number(existingProgress?.furthest_position_seconds||0),manualWatched),
      sessions:Number(existingProgress?.sessions||0)+1,
      confidence:existingProgress?.confidence||null,
      tracking_source:'manual',
      last_watched_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    const progressRes=await supabase.from('video_progress').upsert(progressPayload,{onConflict:'user_id,video_id'});
    if(progressRes.error){setError(progressRes.error.message);setSaving(false);return;}

    if(notes.trim()){
      await supabase.from('study_resources').insert({
        user_id:session.user.id,
        subject_id:subjectId||null,
        chapter_id:chapterId||null,
        topic_id:topicId||null,
        title:'Capture notes · '+video.title,
        resource_type:'note',
        url:video.url,
        source_label:'StudyOS Learning Companion',
        metadata:{kind:'browser_capture_notes',video_id:video.id,notes:notes.trim().slice(0,12000),captured_at:new Date().toISOString()}
      });
    }

    if(generateKit&&notes.trim().length>=20){
      const {data:auth}=await supabase.auth.getSession();
      const response=await fetch('/api/learning/analyze',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.session?.access_token},
        body:JSON.stringify({videoId:video.id,notes})
      });
      const payload=await response.json() as {error?:string;ai_used?:boolean;flashcards_created?:number;doubts_created?:number};
      if(!response.ok){setError(payload.error||'The lesson was saved, but the study kit could not be generated.');setSaving(false);setSaved(true);return;}
      setResult({flashcards:payload.flashcards_created||0,doubts:payload.doubts_created||0,ai:payload.ai_used});
    }

    setSaving(false);setSaved(true);
  }

  if(loading)return <main className="capture-splash"><Loader2 className="spin"/><b>Opening Learning Companion…</b></main>;

  if(saved)return <main className="capture-page"><section className="capture-success"><span><Check/></span><p className="capture-kicker">CAPTURED</p><h1>Learning added to StudyOS.</h1><p>{result?((result.ai?'AI':'Quick')+' study kit created with '+(result.flashcards||0)+' flashcards'+(result.doubts?' and '+result.doubts+' unresolved questions':''))+'.':'The lesson and progress are now part of your learning history.'}</p><div><Link href="/app?view=Learning">Open Learning Tracker</Link><button onClick={()=>setSaved(false)}>Capture another</button></div></section></main>;

  return <main className="capture-page">
    <section className="capture-visual">
      <div className="capture-brand"><StudyOSLogo className="capture-studyos-logo"/></div>
      <div>
        <span className="capture-kicker">LEARNING COMPANION</span>
        <h1>Turn this page into learning evidence.</h1>
        <p>Review the lesson evidence, map it to your subject and optionally turn your selected notes into a private study kit. Position snapshots stay separate from verified watch coverage.</p>
        <div className="capture-proof"><LockKeyhole/><span>StudyOS does not read your browser history. Only this page and the text you deliberately selected are shown here.</span></div>
      </div>
      <small>{profile?.full_name?'Capturing for '+profile.full_name:'Private StudyOS workspace'}</small>
    </section>

    <section className="capture-form-panel">
      <Link href="/app?view=Learning" className="capture-back"><ArrowLeft/>Back to Learning</Link>
      <div className="capture-source"><Video/><div><span>{providerLabel(url)}</span><b>{title||'Untitled learning page'}</b><small>{url||'No URL supplied'}</small></div></div>
      <form onSubmit={submit}>
        <label>Lesson URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} required/></label>
        <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} required/></label>
        <div className="capture-grid">
          <label>Subject<select value={subjectId} onChange={e=>{setSubjectId(e.target.value);setChapterId('');setTopicId('')}}><option value="">Unassigned</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Chapter<select value={chapterId} onChange={e=>{setChapterId(e.target.value);setTopicId('')}}><option value="">No chapter</option>{availableChapters.map(ch=><option key={ch.id} value={ch.id}>{ch.title}</option>)}</select></label>
          <label>Topic<select value={topicId} onChange={e=>setTopicId(e.target.value)}><option value="">No topic</option>{availableTopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        </div>
        {isBookmarkSnapshot&&initialDuration>0?<div className="capture-snapshot-card"><Check size={15}/><div><b>Position snapshot captured</b><span>{Math.round(initialPosition)}s / {Math.round(initialDuration)}s · {Math.round(initialPositionPercent)}% playhead · {initialPlaybackRate.toFixed(2)}× speed</span><small>This is a resume/evidence snapshot, not verified watch time. StudyOS will not turn this position into fake active minutes.</small></div></div>:<div className="capture-grid two">
          <label>Watched minutes<input type="number" min="0" max="720" value={watchedMinutes} onChange={e=>setWatchedMinutes(Number(e.target.value))}/></label>
          <label>Completion<input type="number" min="0" max="100" value={completion} onChange={e=>setCompletion(Math.max(0,Math.min(100,Number(e.target.value))))}/></label>
        </div>}
        <label>Selected notes / transcript excerpt<textarea value={notes} onChange={e=>setNotes(e.target.value.slice(0,12000))} placeholder="Select useful text on the lesson page before using Capture to StudyOS, or add your own notes here."/></label>
        <label className="capture-checkbox"><input type="checkbox" checked={generateKit} onChange={e=>setGenerateKit(e.target.checked)}/><div><b>Build a study kit after capture</b><span>Creates a concise summary, flashcards and only the doubts/questions actually present in these notes.</span></div></label>
        {error?<div className="capture-error">{error}</div>:null}
        <button className="capture-submit" disabled={saving}>{saving?<Loader2 className="spin"/>:<Sparkles/>}{saving?'Saving to StudyOS…':'Capture to StudyOS'}</button>
      </form>
    </section>
  </main>
}
