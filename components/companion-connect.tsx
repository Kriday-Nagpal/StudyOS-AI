'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, Loader2, LockKeyhole, PlugZap, ShieldCheck } from 'lucide-react';
import StudyOSLogo from '@/components/studyos-logo';
import { getSupabaseClient } from '@/lib/supabase';

export default function CompanionConnect() {
  const supabase = getSupabaseClient();
  const [loading,setLoading]=useState(Boolean(supabase));
  const [connected,setConnected]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!supabase)return;
    let active=true;
    void (async()=>{
      const {data}=await supabase.auth.getSession();
      if(!active)return;
      if(!data.session){
        window.location.replace('/auth?mode=signin&next='+encodeURIComponent('/companion/connect'));
        return;
      }
      setLoading(false);
    })();
    const handler=(event:MessageEvent)=>{
      if(event.source!==window||event.origin!==window.location.origin)return;
      if(event.data?.type==='STUDYOS_COMPANION_CONNECTED'){
        setConnected(true);
        setMessage('Learning Companion paired. Progress can now sync automatically on supported learning sites.');
      }
    };
    window.addEventListener('message',handler);
    return()=>{active=false;window.removeEventListener('message',handler)};
  },[supabase]);

  async function pair(){
    if(!supabase)return;
    setError('');setMessage('');
    const {data,error:sessionError}=await supabase.auth.getSession();
    if(sessionError||!data.session){setError('Sign in to StudyOS again before pairing.');return;}
    window.postMessage({
      type:'STUDYOS_COMPANION_PAIR',
      accessToken:data.session.access_token,
      refreshToken:data.session.refresh_token,
      expiresAt:data.session.expires_at||0,
    },window.location.origin);
    setMessage('Pairing signal sent. If the Companion is installed, it will confirm here in a moment.');
  }

  if(!supabase)return <main className="companion-connect-page"><section className="companion-connect-card"><StudyOSLogo/><p>StudyOS is not connected to Supabase in this deployment.</p></section></main>;
  if(loading)return <main className="companion-connect-page"><Loader2 className="spin"/></main>;

  return <main className="companion-connect-page">
    <section className="companion-connect-card">
      <StudyOSLogo/>
      <span className="companion-connect-kicker">AUTOMATIC LEARNING SYNC</span>
      <h1>Pair the StudyOS Learning Companion</h1>
      <p>After pairing once, supported lesson pages can update watched time, completion and resume position automatically while you study.</p>
      <div className="companion-domain-grid">
        {['YouTube','Physics Wallah','DIKSHA','Khan Academy'].map(name=><div key={name}><Check size={15}/><span>{name}</span></div>)}
      </div>
      <div className="companion-privacy"><ShieldCheck/><div><b>Designed around your StudyOS account.</b><span>The extension does not request browser-history access. It only runs on the supported learning domains and sends active video progress through your signed-in StudyOS session.</span></div></div>
      {message?<div className={connected?'companion-message success':'companion-message'}>{message}</div>:null}
      {error?<div className="companion-message error">{error}</div>:null}
      <button className="companion-pair-button" onClick={pair}><PlugZap size={17}/>{connected?'Reconnect Companion':'Connect Companion'}</button>
      <div className="companion-connect-links"><Link href="/app?view=Learning">Open Learning Tracker</Link><Link href="/app?view=Settings">StudyOS Settings <ExternalLink size={12}/></Link></div>
      <small><LockKeyhole size={12}/>Automatic progress sync does not automatically copy full transcripts or private account history.</small>
    </section>
  </main>
}
