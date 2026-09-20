'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, Check, Clock3, Eye, EyeOff, ExternalLink,
  Gauge, History, Loader2, Pause, Play, RotateCcw, ShieldCheck, SlidersHorizontal,
  Sparkles, Target, Timer, Video, Wifi, WifiOff, Zap
} from 'lucide-react';
import StudyOSLogo from '@/components/studyos-logo';
import { getSupabaseClient } from '@/lib/supabase';

type Row={id:string;[key:string]:string|number|boolean|null|undefined};
type SessionShape={user:{id:string};access_token:string};
type CoverageRange=[number,number];
type PlayerState=-1|0|1|2|3|5;
type YTPlayer={
  playVideo:()=>void;
  pauseVideo:()=>void;
  seekTo:(seconds:number,allowSeekAhead:boolean)=>void;
  getCurrentTime:()=>number;
  getDuration:()=>number;
  getPlayerState:()=>PlayerState;
  getPlaybackRate:()=>number;
  getVideoData:()=>{title?:string;video_id?:string};
  destroy:()=>void;
};
type YTReadyEvent={target:YTPlayer};
type YTStateEvent={data:number};
type SessionMetrics={
  clientSessionId:string;
  startedAt:string;
  engagedSeconds:number;
  contentSeconds:number;
  coverageRanges:CoverageRange[];
  seekCount:number;
  pauseCount:number;
  bufferSeconds:number;
  ended:boolean;
  lastSeen:number;
};
type ServerMetrics={
  verifiedCompletion:number;
  engagedSeconds:number;
  contentSeconds:number;
  furthestPosition:number;
  coverageSeconds:number;
  sessions:number;
  trackingConfidence:number;
};

declare global{
  interface Window{
    YT?:{
      Player:new(id:string,options:Record<string,unknown>)=>YTPlayer;
      PlayerState:{ENDED:number;PLAYING:number;PAUSED:number;BUFFERING:number;CUED:number;UNSTARTED:number};
    };
    onYouTubeIframeAPIReady?:()=>void;
  }
}

function youtubeId(raw:string){
  try{
    const url=new URL(raw.trim());
    if(url.hostname==='youtu.be')return url.pathname.split('/').filter(Boolean)[0]||'';
    if(url.hostname.includes('youtube.com')){
      if(url.pathname.startsWith('/shorts/'))return url.pathname.split('/')[2]||'';
      if(url.pathname.startsWith('/embed/'))return url.pathname.split('/')[2]||'';
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
  const hours=Math.floor(value/3600);
  const mins=Math.floor((value%3600)/60);
  const secs=String(value%60).padStart(2,'0');
  return hours?hours+':'+String(mins).padStart(2,'0')+':'+secs:mins+':'+secs;
}

function prettySeconds(seconds:number){
  const total=Math.max(0,Math.round(seconds||0));
  if(total<60)return total+'s';
  const minutes=Math.floor(total/60);
  if(minutes<60)return minutes+'m '+String(total%60).padStart(2,'0')+'s';
  return Math.floor(minutes/60)+'h '+minutes%60+'m';
}

function mergeRanges(input:CoverageRange[],duration=86400):CoverageRange[]{
  const clean=input
    .map(([a,b])=>[Math.max(0,Math.min(duration,Number(a))),Math.max(0,Math.min(duration,Number(b)))] as CoverageRange)
    .map(([a,b])=>[Math.min(a,b),Math.max(a,b)] as CoverageRange)
    .filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b-a>=0.15)
    .sort((a,b)=>a[0]-b[0]);
  const merged:CoverageRange[]=[];
  for(const range of clean){
    const last=merged[merged.length-1];
    if(!last||range[0]>last[1]+1.25)merged.push([range[0],range[1]]);
    else last[1]=Math.max(last[1],range[1]);
  }
  return merged.slice(0,180);
}

function rangeSeconds(ranges:CoverageRange[]){
  return ranges.reduce((sum,[a,b])=>sum+Math.max(0,b-a),0);
}

function newSession(videoId:string):SessionMetrics{
  return{
    clientSessionId:(globalThis.crypto?.randomUUID?.()||('session-'+Date.now()+'-'+Math.random().toString(36).slice(2))),
    startedAt:new Date().toISOString(),
    engagedSeconds:0,
    contentSeconds:0,
    coverageRanges:[],
    seekCount:0,
    pauseCount:0,
    bufferSeconds:0,
    ended:false,
    lastSeen:Date.now(),
  };
}

function loadSession(videoId:string):SessionMetrics{
  if(typeof window==='undefined')return newSession(videoId);
  const key='studyos-theater-v2:'+videoId;
  try{
    const saved=JSON.parse(sessionStorage.getItem(key)||'null') as SessionMetrics|null;
    if(saved?.clientSessionId&&!saved.ended&&Date.now()-Number(saved.lastSeen||0)<45*60*1000){
      return{
        ...saved,
        engagedSeconds:Number(saved.engagedSeconds||0),
        contentSeconds:Number(saved.contentSeconds||0),
        coverageRanges:mergeRanges(Array.isArray(saved.coverageRanges)?saved.coverageRanges:[]),
        seekCount:Number(saved.seekCount||0),
        pauseCount:Number(saved.pauseCount||0),
        bufferSeconds:Number(saved.bufferSeconds||0),
      };
    }
  }catch{}
  return newSession(videoId);
}

export default function LearningTheater({initialUrl='',initialTitle=''}:{initialUrl?:string;initialTitle?:string}){
  const supabase=getSupabaseClient();
  const playerRef=useRef<YTPlayer|null>(null);
  const titleRef=useRef(initialTitle);
  const metricsRef=useRef<SessionMetrics>(newSession('initial'));
  const baseCoverageRef=useRef<CoverageRange[]>([]);
  const baseEngagedRef=useRef(0);
  const baseContentRef=useRef(0);
  const lastSampleRef=useRef({wall:0,position:0,state:-1 as PlayerState,rate:1});
  const syncingRef=useRef(false);
  const endedRef=useRef(false);

  const [session,setSession]=useState<SessionShape|null>(null);
  const [loading,setLoading]=useState(true);
  const [url,setUrl]=useState(initialUrl);
  const [title,setTitle]=useState(initialTitle);
  const [loadedUrl,setLoadedUrl]=useState(initialUrl);
  const [subjects,setSubjects]=useState<Row[]>([]);
  const [chapters,setChapters]=useState<Row[]>([]);
  const [subjectId,setSubjectId]=useState('');
  const [chapterId,setChapterId]=useState('');
  const [notes,setNotes]=useState('');
  const [current,setCurrent]=useState(0);
  const [duration,setDuration]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [buffering,setBuffering]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [lastSync,setLastSync]=useState<Date|null>(null);
  const [mapping,setMapping]=useState<{subject_id?:string|null;chapter_id?:string|null;topic_id?:string|null;confidence?:number}|null>(null);
  const [error,setError]=useState('');
  const [online,setOnline]=useState(true);
  const [queued,setQueued]=useState(false);
  const [tabVisible,setTabVisible]=useState(true);
  const [trackingEnabled,setTrackingEnabled]=useState(true);
  const [syncInterval,setSyncIntervalSeconds]=useState(15);
  const [metricTick,setMetricTick]=useState(0);
  const [resumeAt,setResumeAt]=useState(0);
  const [serverMetrics,setServerMetrics]=useState<ServerMetrics>({
    verifiedCompletion:0,engagedSeconds:0,contentSeconds:0,furthestPosition:0,coverageSeconds:0,sessions:0,trackingConfidence:1
  });
  const [currentSessionKnown,setCurrentSessionKnown]=useState(false);
  const [events,setEvents]=useState<Array<{at:number;label:string;detail:string;kind:'ok'|'info'|'warn'}>>([]);
  const [smartSession,setSmartSession]=useState<{startedAt:number;videoId:string;title:string;url:string;subjectId:string}|null>(null);
  const [returned,setReturned]=useState(false);
  const [nowTick,setNowTick]=useState(Date.now());

  const videoId=useMemo(()=>youtubeId(loadedUrl),[loadedUrl]);
  const isYoutube=Boolean(videoId);
  const positionCompletion=duration>0?Math.max(0,Math.min(100,current/duration*100)):0;
  const localRanges=metricsRef.current.coverageRanges;
  const projectedRanges=useMemo(
    ()=>mergeRanges([...baseCoverageRef.current,...localRanges],duration||86400),
    // metricTick intentionally drives ref-derived coverage recalculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duration,metricTick,videoId]
  );
  const projectedCoverageSeconds=rangeSeconds(projectedRanges);
  const projectedVerified=duration>0?Math.min(100,projectedCoverageSeconds/duration*100):serverMetrics.verifiedCompletion;
  const projectedEngaged=baseEngagedRef.current+metricsRef.current.engagedSeconds;
  const projectedContent=baseContentRef.current+metricsRef.current.contentSeconds;
  const filteredChapters=chapters.filter(ch=>!subjectId||ch.subject_id===subjectId||ch._subject_id===subjectId);

  useEffect(()=>{titleRef.current=title},[title]);

  useEffect(()=>{
    if(typeof window==='undefined')return;
    setOnline(navigator.onLine);
    setTabVisible(document.visibilityState==='visible');
    try{
      const raw=JSON.parse(localStorage.getItem('studyos-theater-v2-settings')||'{}');
      setTrackingEnabled(raw.trackingEnabled!==false);
      setSyncIntervalSeconds([10,15,30,60].includes(Number(raw.syncInterval))?Number(raw.syncInterval):15);
    }catch{}
  },[]);

  useEffect(()=>{
    if(typeof window==='undefined')return;
    localStorage.setItem('studyos-theater-v2-settings',JSON.stringify({trackingEnabled,syncInterval}));
  },[trackingEnabled,syncInterval]);

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

  const addEvent=useCallback((label:string,detail:string,kind:'ok'|'info'|'warn'='info')=>{
    setEvents(list=>[{at:Date.now(),label,detail,kind},...list].slice(0,6));
  },[]);

  const persistMetrics=useCallback(()=>{
    if(typeof window==='undefined'||!videoId)return;
    metricsRef.current.lastSeen=Date.now();
    sessionStorage.setItem('studyos-theater-v2:'+videoId,JSON.stringify(metricsRef.current));
  },[videoId]);

  const queuePayload=useCallback((payload:Record<string,unknown>)=>{
    if(typeof window==='undefined')return;
    localStorage.setItem('studyos-theater-v2-pending:'+metricsRef.current.clientSessionId,JSON.stringify(payload));
    setQueued(true);
  },[]);

  const syncYoutube=useCallback(async(force=false,event='progress',keepalive=false)=>{
    const player=playerRef.current;
    if(!player||!session||!loadedUrl)return false;
    if(!trackingEnabled&&!force)return false;
    if(syncingRef.current&&!force)return false;

    const seconds=Math.max(0,Number(player.getCurrentTime()||0));
    const total=Math.max(0,Number(player.getDuration()||0));
    const data=player.getVideoData?.()||{};
    const lessonTitle=String(data.title||titleRef.current||'YouTube lesson').slice(0,400);
    if(total<1)return false;

    persistMetrics();
    const payload={
      url:canonicalYoutube(loadedUrl),
      title:lessonTitle,
      currentTime:seconds,
      duration:total,
      ended:player.getPlayerState()===0,
      source:'theater',
      clientSessionId:metricsRef.current.clientSessionId,
      sessionStartedAt:metricsRef.current.startedAt,
      sessionEngagedSeconds:Number(metricsRef.current.engagedSeconds.toFixed(2)),
      sessionContentSeconds:Number(metricsRef.current.contentSeconds.toFixed(2)),
      coverageRanges:metricsRef.current.coverageRanges.map(([a,b])=>[Number(a.toFixed(2)),Number(b.toFixed(2))]),
      seekCount:metricsRef.current.seekCount,
      pauseCount:metricsRef.current.pauseCount,
      bufferSeconds:Number(metricsRef.current.bufferSeconds.toFixed(2)),
      playbackRate:Number(player.getPlaybackRate?.()||1),
      event,
      visible:document.visibilityState==='visible',
    };

    if(!navigator.onLine){
      queuePayload(payload);
      addEvent('Saved offline','Latest tracking checkpoint queued safely.','warn');
      return false;
    }

    syncingRef.current=true;
    setSyncing(true);
    try{
      const response=await fetch('/api/learning/auto-progress',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify(payload),
        keepalive,
      });
      const result=await response.json().catch(()=>({})) as {
        error?:string;warning?:string;verified_completion?:number;engaged_seconds?:number;content_seconds?:number;
        furthest_position_seconds?:number;coverage_seconds?:number;sessions?:number;tracking_confidence?:number;
        mapped?:{subject_id?:string|null;chapter_id?:string|null;topic_id?:string|null;confidence?:number};
      };
      if(!response.ok){
        queuePayload(payload);
        setError(result.error||'Could not sync this lesson.');
        addEvent('Sync delayed',result.error||'StudyOS will retry this checkpoint.','warn');
        return false;
      }
      setTitle(lessonTitle);
      setCurrent(seconds);
      setDuration(total);
      setLastSync(new Date());
      setQueued(false);
      setError('');
      setMapping(result.mapped||null);
      setCurrentSessionKnown(true);
      setServerMetrics({
        verifiedCompletion:Number(result.verified_completion||0),
        engagedSeconds:Number(result.engaged_seconds||0),
        contentSeconds:Number(result.content_seconds||0),
        furthestPosition:Number(result.furthest_position_seconds||0),
        coverageSeconds:Number(result.coverage_seconds||0),
        sessions:Number(result.sessions||1),
        trackingConfidence:Number(result.tracking_confidence||1),
      });
      try{localStorage.removeItem('studyos-theater-v2-pending:'+metricsRef.current.clientSessionId)}catch{}
      addEvent(event==='manual'?'Manual checkpoint saved':'Tracking checkpoint saved',
        Math.round(Number(result.verified_completion||0))+'% verified · '+prettySeconds(Number(result.engaged_seconds||0))+' active','ok');
      return true;
    }catch{
      queuePayload(payload);
      setError('Network interrupted. Your latest checkpoint is queued locally.');
      addEvent('Network interrupted','No watch-time was lost; cumulative metrics will retry.','warn');
      return false;
    }finally{
      syncingRef.current=false;
      setSyncing(false);
    }
  },[addEvent,loadedUrl,persistMetrics,queuePayload,session,trackingEnabled]);

  const resetTrackingSession=useCallback(()=>{
    if(!videoId)return;
    metricsRef.current=newSession(videoId);
    endedRef.current=false;
    lastSampleRef.current={wall:performance.now(),position:Number(playerRef.current?.getCurrentTime()||0),state:playerRef.current?.getPlayerState()||-1,rate:Number(playerRef.current?.getPlaybackRate?.()||1)};
    persistMetrics();
    setMetricTick(v=>v+1);
    addEvent('New study session','Fresh active-time and coverage counters started.','info');
  },[addEvent,persistMetrics,videoId]);

  useEffect(()=>{
    if(!videoId||!session)return;
    let disposed=false;
    metricsRef.current=loadSession(videoId);
    endedRef.current=metricsRef.current.ended;
    setMetricTick(v=>v+1);

    const build=()=>{
      if(disposed||!window.YT?.Player)return;
      playerRef.current?.destroy?.();
      playerRef.current=new window.YT.Player('studyos-youtube-player',{
        videoId,
        width:'100%',
        height:'100%',
        playerVars:{playsinline:1,rel:0,origin:window.location.origin},
        events:{
          onReady:async(event:YTReadyEvent)=>{
            if(disposed)return;
            const player=event.target;
            const total=Number(player.getDuration()||0);
            setDuration(total);
            lastSampleRef.current={wall:performance.now(),position:Number(player.getCurrentTime()||0),state:player.getPlayerState(),rate:Number(player.getPlaybackRate?.()||1)};
            const canonical=canonicalYoutube(loadedUrl);
            const {data:video}=await supabase.from('videos').select('id,title').eq('user_id',session.user.id).eq('provider','youtube').eq('external_id',canonical).maybeSingle();
            if(video?.title&&!titleRef.current)setTitle(String(video.title));
            if(video?.id){
              const [{data:progress},{data:trackingSession}]=await Promise.all([
                supabase.from('video_progress').select('*').eq('user_id',session.user.id).eq('video_id',video.id).maybeSingle(),
                supabase.from('video_tracking_sessions').select('*').eq('user_id',session.user.id).eq('video_id',video.id).eq('client_session_id',metricsRef.current.clientSessionId).maybeSingle()
              ]);
              setCurrentSessionKnown(Boolean(trackingSession));
              if(progress){
                const ranges=mergeRanges(Array.isArray(progress.coverage_ranges)?progress.coverage_ranges:[],total||86400);
                baseCoverageRef.current=ranges;
                baseEngagedRef.current=Math.max(0,Number(progress.engaged_seconds||0)-Number(trackingSession?.engaged_seconds||0));
                baseContentRef.current=Math.max(0,Number(progress.content_seconds||0)-Number(trackingSession?.content_seconds||0));
                setServerMetrics({
                  verifiedCompletion:Number(progress.verified_completion||0),
                  engagedSeconds:Number(progress.engaged_seconds||0),
                  contentSeconds:Number(progress.content_seconds||0),
                  furthestPosition:Number(progress.furthest_position_seconds||progress.last_position_seconds||0),
                  coverageSeconds:rangeSeconds(ranges),
                  sessions:Number(progress.sessions||0),
                  trackingConfidence:Number(progress.confidence?Number(progress.confidence)/5:1),
                });
                const resume=Number(progress.last_position_seconds||0);
                setResumeAt(resume);
                if(resume>5&&resume<total-10){
                  player.seekTo(resume,true);
                  setCurrent(resume);
                  addEvent('Resume point restored','Continuing from '+fmt(resume)+'.','info');
                }
              }
            }
            addEvent('Precision tracking ready','YouTube Player API connected · v2 coverage tracking active.','ok');
          },
          onStateChange:(event:YTStateEvent)=>{
            if(disposed)return;
            const state=Number(event.data) as PlayerState;
            const previous=lastSampleRef.current.state;
            setPlaying(state===1);
            setBuffering(state===3);

            if(previous===1&&state===2){
              metricsRef.current.pauseCount+=1;
              void syncYoutube(true,'pause');
            }
            if(state===0){
              metricsRef.current.ended=true;
              endedRef.current=true;
              persistMetrics();
              void syncYoutube(true,'ended');
            }
            if(state===1&&endedRef.current)resetTrackingSession();
            lastSampleRef.current.state=state;
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

    const sample=setInterval(()=>{
      const player=playerRef.current;
      if(!player)return;
      const now=performance.now();
      const position=Number(player.getCurrentTime()||0);
      const total=Number(player.getDuration()||0);
      const state=player.getPlayerState();
      const rate=Math.max(.25,Math.min(4,Number(player.getPlaybackRate?.()||1)));
      const prev=lastSampleRef.current;
      const wall=Math.max(0,Math.min(3,(now-prev.wall)/1000));
      const posDelta=position-prev.position;
      const visible=document.visibilityState==='visible';

      setCurrent(position);
      setDuration(total);
      setPlaying(state===1);
      setBuffering(state===3);
      setTabVisible(visible);

      if(trackingEnabled&&visible&&wall>0.15){
        if(prev.state===1&&state===1){
          const expected=Math.max(.1,wall*((prev.rate+rate)/2));
          const plausible=posDelta>=-.35&&posDelta<=expected*1.85+1.35;
          if(plausible){
            metricsRef.current.engagedSeconds+=wall;
            if(posDelta>0.03){
              metricsRef.current.contentSeconds+=posDelta;
              metricsRef.current.coverageRanges=mergeRanges(
                [...metricsRef.current.coverageRanges,[Math.max(0,prev.position),Math.max(0,position)]],
                total||86400
              );
            }
          }else if(Math.abs(posDelta)>2){
            metricsRef.current.seekCount+=1;
            addEvent('Seek filtered',Math.abs(Math.round(posDelta))+'s jump excluded from verified watch time.','info');
          }
        }
        if(prev.state===3||state===3)metricsRef.current.bufferSeconds+=wall;
      }

      metricsRef.current.lastSeen=Date.now();
      lastSampleRef.current={wall:now,position,state,rate};
      persistMetrics();
      setMetricTick(v=>v+1);
    },1000);

    return()=>{
      disposed=true;
      clearInterval(sample);
      persistMetrics();
      void syncYoutube(true,'unmount',true);
      playerRef.current?.destroy?.();
      playerRef.current=null;
    };
  },[addEvent,loadedUrl,persistMetrics,resetTrackingSession,session,supabase,syncYoutube,trackingEnabled,videoId]);

  useEffect(()=>{
    if(!isYoutube||!session||!trackingEnabled)return;
    const timer=setInterval(()=>void syncYoutube(false,'interval'),syncInterval*1000);
    return()=>clearInterval(timer);
  },[isYoutube,session,syncInterval,syncYoutube,trackingEnabled]);

  useEffect(()=>{
    const onOnline=()=>{setOnline(true);void syncYoutube(true,'network_recovered')};
    const onOffline=()=>{setOnline(false);setQueued(true)};
    const onVisibility=()=>{
      const visible=document.visibilityState==='visible';
      setTabVisible(visible);
      if(!visible)void syncYoutube(true,'hidden',true);
      else addEvent('Tab visible','Active-time tracking resumed.','info');
    };
    const onPageHide=()=>{void syncYoutube(true,'pagehide',true)};
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('pagehide',onPageHide);
    return()=>{
      window.removeEventListener('online',onOnline);
      window.removeEventListener('offline',onOffline);
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('pagehide',onPageHide);
    };
  },[addEvent,syncYoutube]);

  useEffect(()=>{
    const timer=setInterval(()=>setNowTick(Date.now()),1000);
    return()=>clearInterval(timer);
  },[]);

  useEffect(()=>{
    const onFocus=()=>{
      if(smartSession&&Date.now()-smartSession.startedAt>15000)setReturned(true);
    };
    window.addEventListener('focus',onFocus);
    return()=>window.removeEventListener('focus',onFocus);
  },[smartSession]);

  function loadLesson(e:React.FormEvent){
    e.preventDefault();
    setError('');
    setMapping(null);
    setCurrent(0);
    setDuration(0);
    setResumeAt(0);
    baseCoverageRef.current=[];
    baseEngagedRef.current=0;
    baseContentRef.current=0;
    setServerMetrics({verifiedCompletion:0,engagedSeconds:0,contentSeconds:0,furthestPosition:0,coverageSeconds:0,sessions:0,trackingConfidence:1});
    setCurrentSessionKnown(false);
    setEvents([]);
    setLoadedUrl(url.trim());
    if(!title.trim()){
      try{setTitle(new URL(url.trim()).hostname.replace(/^www\./,''))}catch{}
    }
  }

  async function startSmartLaunch(){
    if(!supabase||!session||!loadedUrl)return;
    let parsed:URL;
    try{parsed=new URL(loadedUrl)}catch{setError('Enter a valid lesson URL.');return}
    const provider=providerFor(loadedUrl);
    const lessonTitle=title.trim()||parsed.hostname;
    const videoResult=await supabase.from('videos').upsert({
      user_id:session.user.id,
      subject_id:subjectId||null,
      chapter_id:chapterId||null,
      provider,
      external_id:parsed.toString(),
      title:lessonTitle,
      url:parsed.toString(),
      classification_confidence:subjectId?1:0,
      user_verified:Boolean(subjectId)
    },{onConflict:'user_id,provider,external_id'}).select('*').single();
    if(videoResult.error||!videoResult.data){setError(videoResult.error?.message||'Could not start Smart Launch.');return}
    const state={startedAt:Date.now(),videoId:videoResult.data.id,title:lessonTitle,url:parsed.toString(),subjectId};
    setSmartSession(state);
    setReturned(false);
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
    if(res.error){setError(res.error.message);return}
    window.localStorage.removeItem('studyos-smart-launch');
    setSmartSession(null);
    setReturned(false);
    setLastSync(new Date());
    addEvent('Smart session saved',minutes+' minutes added to StudyOS analytics.','ok');
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

  const healthLabel=!trackingEnabled?'Tracking paused':!online?'Offline · safely queued':!tabVisible?'Tab hidden · active time paused':buffering?'Buffering':playing?'Precision tracking live':'Ready';
  const healthClass=!trackingEnabled?'paused':!online?'warning':!tabVisible?'muted':playing?'live':'ready';
  const sessionElapsed=smartSession?Math.max(0,Math.round((nowTick-smartSession.startedAt)/1000)):0;

  if(loading)return <main className="theater-loading"><Loader2 className="spin"/><b>Opening Learning Theater…</b></main>;

  return <main className="learning-theater learning-theater-v2">
    <header className="theater-topbar">
      <Link href="/app?view=Learning" className="theater-back"><ArrowLeft/>Learning</Link>
      <StudyOSLogo/>
      <div className={'theater-status '+healthClass}>
        <span></span>{syncing?'Syncing evidence…':healthLabel}
      </div>
    </header>

    <section className="theater-hero theater-hero-v2">
      <div>
        <span>PRECISION TRACKING V2 · CHROME-FIRST</span>
        <h1>Learning Theater</h1>
        <p>Verified timeline coverage, real active watch time, seek filtering, resumable checkpoints and safe offline retry—without a paid browser extension.</p>
      </div>
      <div className="theater-hero-actions">
        <div className="precision-badge"><ShieldCheck/><span><b>Evidence-based</b><small>Position ≠ watched</small></span></div>
        <Link href="/tools/bookmark-companion" className="theater-bookmark-link"><Sparkles/>Chrome Bookmark</Link>
      </div>
    </section>

    <form className="theater-loader" onSubmit={loadLesson}>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a YouTube, PW, DIKSHA or Khan Academy lesson URL"/>
      <button><Play/>Open lesson</button>
    </form>

    {error?<div className="theater-error">{error}</div>:null}

    {isYoutube?<>
      <section className="tracking-command-strip">
        <div className={'tracking-signal '+healthClass}><Activity/><span><b>{healthLabel}</b><small>{queued?'Local checkpoint waiting to retry':lastSync?'Last server checkpoint '+lastSync.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'No server checkpoint yet'}</small></span></div>
        <div className="tracking-proof"><Eye/><span><b>{tabVisible?'Tab visible':'Tab hidden'}</b><small>{tabVisible?'Active time can count':'Active time is not counted'}</small></span></div>
        <div className="tracking-proof">{online?<Wifi/>:<WifiOff/>}<span><b>{online?'Online':'Offline'}</b><small>{online?'Encrypted sync available':'Cumulative metrics remain local'}</small></span></div>
        <div className="tracking-proof"><Gauge/><span><b>{syncInterval}s checkpoint</b><small>1-second local sampling</small></span></div>
        <label className="tracking-master-switch"><input type="checkbox" checked={trackingEnabled} onChange={e=>setTrackingEnabled(e.target.checked)}/><i></i><span>{trackingEnabled?'Tracking on':'Tracking off'}</span></label>
      </section>

      <section className="theater-grid theater-grid-v2">
        <div className="theater-player-card theater-player-v2">
          <div className="player-frame-wrap">
            <div className="theater-player-shell"><div id="studyos-youtube-player"/></div>
            <div className="player-overlay-top">
              <span className="source-proof"><ShieldCheck/>YouTube Player API</span>
              {resumeAt>5?<span className="resume-proof"><History/>Resumed from {fmt(resumeAt)}</span>:null}
            </div>
          </div>

          <div className="verified-timeline">
            <div className="timeline-heading">
              <div><span>VERIFIED COVERAGE</span><b>{projectedVerified.toFixed(1)}%</b></div>
              <div><span>PLAYHEAD POSITION</span><b>{positionCompletion.toFixed(1)}%</b></div>
            </div>
            <div className="coverage-track">
              <div className="coverage-ranges">
                {projectedRanges.map(([a,b],index)=><i key={index} style={{left:(duration?Math.max(0,a/duration*100):0)+'%',width:(duration?Math.max(.2,(b-a)/duration*100):0)+'%'}}/>)}
              </div>
              <span className="playhead" style={{left:Math.max(0,Math.min(100,positionCompletion))+'%'}}></span>
              {[25,50,75,90].map(mark=><em key={mark} style={{left:mark+'%'}}><small>{mark}</small></em>)}
            </div>
            <div className="timeline-foot"><span>{fmt(current)} current</span><span>{prettySeconds(projectedCoverageSeconds)} unique coverage</span><span>{fmt(duration)} total</span></div>
          </div>

          <div className="theater-player-actions">
            <button onClick={()=>playerRef.current?.playVideo()}><Play/>Play</button>
            <button onClick={()=>playerRef.current?.pauseVideo()}><Pause/>Pause</button>
            <button onClick={()=>void syncYoutube(true,'manual')}><RotateCcw/>Save checkpoint</button>
            <a href={canonicalYoutube(loadedUrl)} target="_blank" rel="noreferrer"><ExternalLink/>Open YouTube</a>
          </div>
        </div>

        <aside className="theater-side theater-side-v2">
          <section className="precision-card">
            <header><div><span>VERIFIED LEARNING</span><h2>{title||'YouTube lesson'}</h2></div><div className="confidence-ring">{Math.round(serverMetrics.trackingConfidence*100)}<small>%</small></div></header>
            <div className="precision-metrics">
              <div><Target/><span><b>{projectedVerified.toFixed(1)}%</b><small>unique coverage</small></span></div>
              <div><Clock3/><span><b>{prettySeconds(projectedEngaged)}</b><small>active watch time</small></span></div>
              <div><Zap/><span><b>{prettySeconds(projectedContent)}</b><small>content played</small></span></div>
              <div><BarChart3/><span><b>{Math.max(serverMetrics.sessions+(currentSessionKnown?0:1),1)}</b><small>tracked sessions</small></span></div>
            </div>
            <div className="precision-submetrics">
              <span><b>{metricsRef.current.seekCount}</b> seeks filtered</span>
              <span><b>{metricsRef.current.pauseCount}</b> pauses</span>
              <span><b>{prettySeconds(metricsRef.current.bufferSeconds)}</b> buffering</span>
              <span><b>{fmt(Math.max(serverMetrics.furthestPosition,current))}</b> furthest</span>
            </div>
            {mapping?<div className="theater-map-status"><Check/><div><b>{mapping.chapter_id?'Curriculum mapped':'Lesson tracked safely'}</b><small>{mapping.confidence?Math.round(Number(mapping.confidence)*100)+'% curriculum mapping confidence':'Uncertain academic mapping stays unassigned.'}</small></div></div>:null}
          </section>

          <section className="tracking-controls-card">
            <div className="tracking-card-title"><SlidersHorizontal/><div><span>TRACKING CONTROLS</span><b>Precision & privacy</b></div></div>
            <label><span><b>Automatic checkpoints</b><small>Local sampling stays 1s; only server frequency changes.</small></span><select value={syncInterval} onChange={e=>setSyncIntervalSeconds(Number(e.target.value))}><option value={10}>Every 10 sec</option><option value={15}>Every 15 sec</option><option value={30}>Every 30 sec</option><option value={60}>Every 60 sec</option></select></label>
            <div className="tracking-rule"><EyeOff/><p><b>Hidden tabs never add active watch time.</b> Playback position may move, but verified coverage only grows from plausible visible playback samples.</p></div>
          </section>

          <section className="tracking-events-card">
            <div className="tracking-card-title"><History/><div><span>SESSION HEALTH</span><b>Recent evidence events</b></div></div>
            <div className="tracking-event-list">
              {events.length?events.map(event=><article key={event.at} className={event.kind}><i></i><div><b>{event.label}</b><small>{event.detail}</small></div><time>{new Date(event.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></article>):<p>No tracking events yet. Start the video to begin.</p>}
            </div>
          </section>

          <section className="theater-notes-card theater-notes-v2">
            <div className="tracking-card-title"><Sparkles/><div><span>LIVE NOTES</span><b>Capture while you learn</b></div></div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value.slice(0,12000))} placeholder="Write concepts, examples, formulas or doubts while watching…"/>
            <button onClick={openStudyKit}><Sparkles/>Turn notes into Study Kit</button>
          </section>
        </aside>
      </section>
    </>:loadedUrl?<section className="smart-launch smart-launch-v2">
      <div className="smart-launch-copy">
        <span>SMART LAUNCH · {providerLabel(loadedUrl).toUpperCase()}</span>
        <h2>Track the learning session accurately without pretending StudyOS can see a private player.</h2>
        <p>StudyOS records real elapsed session time after you launch the lesson. Use the Chrome Bookmark Companion if that site exposes a standard video element and you want a precise position snapshot.</p>
        <div className="smart-evidence-row">
          <span><Timer/><b>Session time</b><small>Reliable</small></span>
          <span><Target/><b>Video %</b><small>Only when measurable</small></span>
          <span><ShieldCheck/><b>No guessing</b><small>Always</small></span>
        </div>
      </div>
      <div className="smart-launch-form">
        <label>Lesson title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Lesson title"/></label>
        <label>Subject<select value={subjectId} onChange={e=>{setSubjectId(e.target.value);setChapterId('')}}><option value="">Unassigned</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Chapter<select value={chapterId} onChange={e=>setChapterId(e.target.value)}><option value="">No chapter</option>{filteredChapters.map(ch=><option key={ch.id} value={ch.id}>{ch.title}</option>)}</select></label>
        {!smartSession?<button className="smart-launch-button" onClick={startSmartLaunch}><ExternalLink/>Launch lesson + start session</button>:<div className="smart-session-active smart-session-v2"><Timer/><div><b>Study session running · {fmt(sessionElapsed)}</b><small>Started {new Date(smartSession.startedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>{returned?<button onClick={saveSmartSession}>Save session</button>:<span>Return here when finished</span>}</div>}
      </div>
    </section>:<section className="theater-empty theater-empty-v2">
      <div className="empty-orbit"><Video/><i></i><ShieldCheck/></div>
      <h2>Paste a lesson to start precision tracking.</h2>
      <p>YouTube gets verified timeline coverage and active-time tracking. PW, DIKSHA and Khan Academy get honest Smart Launch session evidence plus the free Chrome bookmark bridge.</p>
      <div><span><Check/>Seek filtering</span><span><Check/>Offline retry</span><span><Check/>Resume checkpoints</span><span><Check/>Visible-playback evidence</span></div>
    </section>}
  </main>;
}
