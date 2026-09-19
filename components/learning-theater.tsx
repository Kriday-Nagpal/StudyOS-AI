'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Check, Clock3, ExternalLink, Loader2, Pause,
  Play, RotateCcw, Sparkles, Target, Timer, Video
} from 'lucide-react';
import StudyOSLogo from '@/components/studyos-logo';
import { getSupabaseClient } from '@/lib/supabase';

type Row = Record<string, any>;
type PlayerState = -1|0|1|2|3|5;
type YTPlayer = {
  playVideo:()=>void;
  pauseVideo:()=>void;
  seekTo:(seconds:number,allowSeekAhead:boolean)=>void;
  getCurrentTime:()=>number;
  getDuration:()=>number;
  getPlayerState:()=>PlayerState;
  getVideoData:()=>{title?:string;video_id?:string};
  destroy:()=>void;
};

declare global {
  interface Window {
    YT?: {
      Player:new(id:string,options:Record<string,unknown>)=>YTPlayer;
      PlayerState:{ENDED:number;PLAYING:number;PAUSED:number;BUFFERING:number;CUED:number;UNSTARTED:number};
    };
    onYouTubeIframeAPIReady?:()=>void;
  }
}

function youtubeId(raw:string){
  try{
    const url=new URL(raw.trim());
    if(url.hostname==='youtu.be') return url.pathname.split('/').filter(Boolean)[0]||'';
    if(url.hostname.includes('youtube.com')){
      if(url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2]||'';
      if(url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2]||'';
      return url.searchParams.get('v')||'';
    }
  }catch{}
  return '';
}

function canonicalYoutube(raw:string){
  const id=youtubeId(raw);
  return id?'https://www.youtube.com/watch?v='+id:raw;
}

function providerFor(raw:string){
  const value=raw.toLowerCase();
  if(value.includes('youtube.com')||value.includes('youtu.be'))return 'youtube';
  if(value.includes('diksha.gov.in'))return 'diksha';
  if(value.includes('khanacademy.org'))return 'khan_academy';
  return 'other';
}

function providerLabel(raw:string){
  const value=raw.toLowerCase();
  if(value.includes('youtube.com')||value.includes('youtu.be'))return 'YouTube';
  if(value.includes('pw.live')||value.includes('physicswallah')||value.includes('pwskills'))return 'Physics Wallah';
  if(value.includes('diksha.gov.in'))return 'DIKSHA';
  if(value.includes('khanacademy.org'))return 'Khan Academy';
  return 'External learning site';
}

function fmt(seconds:number){
  const value=Math.max(0,Math.round(seconds||0));
  const mins=Math.floor(value/60);
  return mins+':'+String(value%60).padStart(2,'0');
}

export default function LearningTheater({initialUrl='',initialTitle=''}:{initialUrl?:string;initialTitle?:string}){
  const supabase=getSupabaseClient();
  const playerRef=useRef<YTPlayer|null>(null);
  const syncTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const titleRef=useRef(initialTitle);
  const [session,setSession]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [url,setUrl]=useState(initialUrl);
  const [title,setTitle]=useState(initialTitle);
  const [loadedUrl,setLoadedUrl]=useState(initialUrl);
  const [subjects,setSubjects]=useState<Row[]>([]);
  const [chapters,setChapters]=useState<Row[]>([]);
  const [subjectId,setSubjectId]=useState('');
  const [chapterId,setChapterId]=useState('');
  const [topicId,setTopicId]=useState('');
  const [notes,setNotes]=useState('');
  const [current,setCurrent]=useState(0);
  const [duration,setDuration]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [lastSync,setLastSync]=useState<Date|null>(null);
  const [mapping,setMapping]=useState<{subject_id?:string|null;chapter_id?:string|null;topic_id?:string|null;confidence?:number}|null>(null);
  const [error,setError]=useState('');
  const [smartSession,setSmartSession]=useState<{startedAt:number;videoId:string;title:string;url:string;subjectId:string}|null>(null);
  const [returned,setReturned]=useState(false);

  const videoId=useMemo(()=>youtubeId(loadedUrl),[loadedUrl]);
  const isYoutube=Boolean(videoId);
  const completion=duration>0?Math.max(0,Math.min(100,current/duration*100)):0;
  useEffect(()=>{titleRef.current=title},[title]);
  const filteredChapters=chapters.filter(ch=>!subjectId||ch.subject_id===subjectId||ch._subject_id===subjectId);

  useEffect(()=>{
    if(!supabase)return;
    let active=true;
    void(async()=>{
      const {data}=await supabase.auth.getSession();
      if(!active)return;
      if(!data.session){
        const next=window.location.pathname+window.location.search;
        window.location.replace('/auth?mode=signin&next='+encodeURIComponent(next));
        return;
      }
      setSession(data.session);
      const [{data:subjectRows},{data:profile}]=await Promise.all([
        supabase.from('subjects').select('*').order('sort_order'),
        supabase.from('profiles').select('*').eq('id',data.session.user.id).maybeSingle()
      ]);
      if(!active)return;
      setSubjects(subjectRows||[]);
      if(profile?.board&&profile?.class_level){
        const {data:books}=await supabase.from('curriculum_books').select('*')
          .eq('board',profile.board).eq('class_level',profile.class_level).eq('status','current');
        if(books?.length){
          const {data:chapterRows}=await supabase.from('curriculum_chapters').select('*')
            .in('curriculum_book_id',books.map((b:Row)=>b.id)).order('sort_order');
          const enriched=(chapterRows||[]).map((ch:Row)=>{
            const book=books.find((b:Row)=>b.id===ch.curriculum_book_id);
            const subject=subjectRows?.find((s:Row)=>String(s.name).toLowerCase()===String(book?.subject||'').toLowerCase());
            return {...ch,_subject_id:subject?.id||null};
          });
          setChapters(enriched);
        }
      }
      const stored=window.localStorage.getItem('studyos-smart-launch');
      if(stored){
        try{
          const parsed=JSON.parse(stored);
          if(parsed?.startedAt&&parsed?.videoId)setSmartSession(parsed);
        }catch{}
      }
      setLoading(false);
    })();
    return()=>{active=false};
  },[supabase]);

  const syncYoutube=useCallback(async(force=false)=>{
    if(!playerRef.current||!session||!loadedUrl)return;
    const seconds=Math.max(0,Number(playerRef.current.getCurrentTime()||0));
    const total=Math.max(0,Number(playerRef.current.getDuration()||0));
    const data=playerRef.current.getVideoData?.()||{};
    const lessonTitle=String(data.title||titleRef.current||'YouTube lesson').slice(0,400);
    if(seconds<1||total<1)return;
    setSyncing(true);
    const response=await fetch('/api/learning/auto-progress',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify({
        url:canonicalYoutube(loadedUrl),
        title:lessonTitle,
        currentTime:seconds,
        duration:total,
        ended:playerRef.current.getPlayerState()===0,
        force
      })
    });
    const payload=await response.json().catch(()=>({}));
    setSyncing(false);
    if(!response.ok){setError(payload.error||'Could not sync this lesson.');return;}
    setTitle(lessonTitle);
    setCurrent(seconds);setDuration(total);setLastSync(new Date());
    setMapping(payload.mapped||null);
  },[loadedUrl,session]);

  useEffect(()=>{
    if(!videoId||!session)return;
    let disposed=false;
    const build=()=>{
      if(disposed||!window.YT?.Player)return;
      playerRef.current?.destroy?.();
      playerRef.current=new window.YT.Player('studyos-youtube-player',{
        videoId,
        width:'100%',
        height:'100%',
        playerVars:{
          playsinline:1,
          rel:0,
          origin:window.location.origin
        },
        events:{
          onReady:async(event:any)=>{
            if(disposed)return;
            const player=event.target as YTPlayer;
            const total=Number(player.getDuration()||0);
            setDuration(total);
            const canonical=canonicalYoutube(loadedUrl);
            const {data:video}=await supabase.from('videos').select('id,title').eq('user_id',session.user.id).eq('provider','youtube').eq('external_id',canonical).maybeSingle();
            if(video?.title&&!title)setTitle(video.title);
            if(video?.id){
              const {data:progress}=await supabase.from('video_progress').select('*').eq('user_id',session.user.id).eq('video_id',video.id).maybeSingle();
              const resume=Number(progress?.last_position_seconds||0);
              if(resume>5&&resume<total-10){
                player.seekTo(resume,true);setCurrent(resume);
              }
            }
          },
          onStateChange:(event:any)=>{
            if(disposed)return;
            const state=Number(event.data);
            setPlaying(state===1);
            if(state===2||state===0)void syncYoutube(true);
          },
          onError:()=>setError('YouTube could not load this video inside StudyOS. You can still use Smart Launch or the Bookmark Companion.')
        }
      });
    };

    if(window.YT?.Player)build();
    else{
      const existing=document.querySelector('script[data-studyos-youtube-api]');
      const previous=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{previous?.();build();};
      if(!existing){
        const script=document.createElement('script');
        script.src='https://www.youtube.com/iframe_api';
        script.async=true;
        script.dataset.studyosYoutubeApi='1';
        document.head.appendChild(script);
      }
    }

    syncTimerRef.current=setInterval(()=>{
      const player=playerRef.current;
      if(!player)return;
      const now=Number(player.getCurrentTime()||0);
      const total=Number(player.getDuration()||0);
      setCurrent(now);setDuration(total);
      if(player.getPlayerState()===1)void syncYoutube(false);
    },30000);

    const tick=setInterval(()=>{
      const player=playerRef.current;
      if(player){setCurrent(Number(player.getCurrentTime()||0));setDuration(Number(player.getDuration()||0));}
    },1000);

    return()=>{
      disposed=true;
      clearInterval(tick);
      if(syncTimerRef.current)clearInterval(syncTimerRef.current);
      void syncYoutube(true);
      playerRef.current?.destroy?.();playerRef.current=null;
    };
  },[videoId,session,loadedUrl,supabase,syncYoutube]);

  useEffect(()=>{
    const onFocus=()=>{
      if(smartSession&&Date.now()-smartSession.startedAt>15000)setReturned(true);
    };
    window.addEventListener('focus',onFocus);
    return()=>window.removeEventListener('focus',onFocus);
  },[smartSession]);

  function loadLesson(e:React.FormEvent){
    e.preventDefault();setError('');setMapping(null);setCurrent(0);setDuration(0);
    setLoadedUrl(url.trim());
    if(!title.trim()){
      try{setTitle(new URL(url.trim()).hostname.replace(/^www\./,''));}catch{}
    }
  }

  async function startSmartLaunch(){
    if(!supabase||!session||!loadedUrl)return;
    let parsed:URL;try{parsed=new URL(loadedUrl)}catch{setError('Enter a valid lesson URL.');return;}
    const provider=providerFor(loadedUrl);
    const lessonTitle=title.trim()||parsed.hostname;
    const videoResult=await supabase.from('videos').upsert({
      user_id:session.user.id,
      subject_id:subjectId||null,
      chapter_id:chapterId||null,
      topic_id:topicId||null,
      provider,
      external_id:parsed.toString(),
      title:lessonTitle,
      url:parsed.toString(),
      classification_confidence:subjectId?1:0,
      user_verified:Boolean(subjectId)
    },{onConflict:'user_id,provider,external_id'}).select('*').single();
    if(videoResult.error||!videoResult.data){setError(videoResult.error?.message||'Could not start Smart Launch.');return;}
    const state={startedAt:Date.now(),videoId:videoResult.data.id,title:lessonTitle,url:parsed.toString(),subjectId};
    setSmartSession(state);setReturned(false);
    window.localStorage.setItem('studyos-smart-launch',JSON.stringify(state));
    window.open(parsed.toString(),'_blank','noopener,noreferrer');
  }

  async function saveSmartSession(){
    if(!supabase||!session||!smartSession)return;
    const endedAt=Date.now();
    const minutes=Math.max(1,Math.round((endedAt-smartSession.startedAt)/60000));
    const res=await supabase.from('study_sessions').insert({
      user_id:session.user.id,
      subject_id:smartSession.subjectId||null,
      goal:'External lesson · '+smartSession.title,
      started_at:new Date(smartSession.startedAt).toISOString(),
      ended_at:new Date(endedAt).toISOString(),
      duration_minutes:minutes
    });
    if(res.error){setError(res.error.message);return;}
    window.localStorage.removeItem('studyos-smart-launch');
    setSmartSession(null);setReturned(false);setLastSync(new Date());
  }

  function openStudyKit(){
    const player=playerRef.current;
    const position=player?Number(player.getCurrentTime()||0):0;
    const total=player?Number(player.getDuration()||0):0;
    const params=new URLSearchParams({
      url:loadedUrl,
      title:title||'Learning lesson',
      text:notes,
      position:String(Math.round(position)),
      duration:String(Math.round(total))
    });
    window.location.href='/capture?'+params.toString();
  }

  if(loading)return <main className="theater-loading"><Loader2 className="spin"/><b>Opening Learning Theater…</b></main>;

  return <main className="learning-theater">
    <header className="theater-topbar">
      <Link href="/app?view=Learning" className="theater-back"><ArrowLeft/>Learning</Link>
      <StudyOSLogo/>
      <div className="theater-status"><span className={syncing?'syncing':'live'}></span>{syncing?'Syncing…':lastSync?'Synced '+lastSync.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Ready'}</div>
    </header>

    <section className="theater-hero">
      <div><span>CHROME-FIRST LEARNING</span><h1>StudyOS Learning Theater</h1><p>Exact YouTube progress inside StudyOS. Smart session tracking for external learning sites. No extension required.</p></div>
      <Link href="/tools/bookmark-companion" className="theater-bookmark-link"><Sparkles/>Get Chrome Bookmark Companion</Link>
    </section>

    <form className="theater-loader" onSubmit={loadLesson}>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a YouTube, PW, DIKSHA or Khan Academy lesson URL"/>
      <button><Play/>Open lesson</button>
    </form>

    {error?<div className="theater-error">{error}</div>:null}

    {isYoutube?<section className="theater-grid">
      <div className="theater-player-card">
        <div className="theater-player-shell"><div id="studyos-youtube-player"/></div>
        <div className="theater-progress">
          <div><span>{playing?'PLAYING':'PAUSED'}</span><b>{Math.round(completion)}%</b></div>
          <div className="theater-progress-track"><i style={{width:completion+'%'}}/></div>
          <div><small>{fmt(current)}</small><small>{fmt(duration)}</small></div>
        </div>
        <div className="theater-player-actions">
          <button onClick={()=>playerRef.current?.playVideo()}><Play/>Play</button>
          <button onClick={()=>playerRef.current?.pauseVideo()}><Pause/>Pause</button>
          <button onClick={()=>void syncYoutube(true)}><RotateCcw/>Sync now</button>
          <a href={canonicalYoutube(loadedUrl)} target="_blank" rel="noreferrer"><ExternalLink/>Open YouTube</a>
        </div>
      </div>

      <aside className="theater-side">
        <section className="theater-context-card">
          <span>LEARNING EVIDENCE</span>
          <h2>{title||'YouTube lesson'}</h2>
          <div className="theater-metrics">
            <div><Clock3/><b>{fmt(current)}</b><small>watched position</small></div>
            <div><Target/><b>{Math.round(completion)}%</b><small>completion</small></div>
          </div>
          {mapping?<div className="theater-map-status"><Check/><div><b>{mapping.chapter_id?'Curriculum mapped':'Lesson tracked'}</b><small>{mapping.confidence?Math.round(Number(mapping.confidence)*100)+'% mapping confidence':'StudyOS is keeping uncertain curriculum fields unassigned.'}</small></div></div>:null}
        </section>

        <section className="theater-notes-card">
          <span>LIVE NOTES</span>
          <textarea value={notes} onChange={e=>setNotes(e.target.value.slice(0,12000))} placeholder="Write your own notes while watching…"/>
          <button onClick={openStudyKit}><Sparkles/>Turn notes into Study Kit</button>
        </section>
      </aside>
    </section>:loadedUrl?<section className="smart-launch">
      <div className="smart-launch-copy">
        <span>SMART LAUNCH · {providerLabel(loadedUrl).toUpperCase()}</span>
        <h2>Track the study session without pretending we can see another site’s private player.</h2>
        <p>StudyOS records when you launch and return. If the page exposes a normal video element, use the Chrome Bookmark Companion once to capture the exact position and completion.</p>
      </div>
      <div className="smart-launch-form">
        <label>Lesson title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Lesson title"/></label>
        <label>Subject<select value={subjectId} onChange={e=>{setSubjectId(e.target.value);setChapterId('')}}><option value="">Unassigned</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Chapter<select value={chapterId} onChange={e=>setChapterId(e.target.value)}><option value="">No chapter</option>{filteredChapters.map(ch=><option key={ch.id} value={ch.id}>{ch.title}</option>)}</select></label>
        {!smartSession?<button className="smart-launch-button" onClick={startSmartLaunch}><ExternalLink/>Launch lesson + start session</button>:<div className="smart-session-active"><Timer/><div><b>Session running</b><small>Started {new Date(smartSession.startedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>{returned?<button onClick={saveSmartSession}>Save returned session</button>:<span>Return here after studying</span>}</div>}
      </div>
    </section>:<section className="theater-empty">
      <Video/><h2>Paste your first lesson above.</h2><p>YouTube gets exact automatic progress here. PW, DIKSHA and Khan get Smart Launch plus the free Chrome Bookmark Companion.</p>
    </section>}
  </main>;
}
