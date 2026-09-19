'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Clipboard, ExternalLink, MousePointerClick, ShieldCheck, Sparkles, Video } from 'lucide-react';
import StudyOSLogo from '@/components/studyos-logo';

const STUDYOS_CAPTURE='https://studyos-web-production.up.railway.app/capture';

function buildBookmarklet(){
  const code="(()=>{const a=[...document.querySelectorAll('video')].filter(v=>Number.isFinite(v.duration)&&v.duration>0).sort((x,y)=>((!y.paused?1e9:0)+y.clientWidth*y.clientHeight)-((!x.paused?1e9:0)+x.clientWidth*x.clientHeight))[0];const p=new URLSearchParams({url:location.href,title:document.title,text:String(getSelection?.()?.toString?.()||'').slice(0,12000),position:String(Math.round(a?.currentTime||0)),duration:String(Math.round(a?.duration||0))});open('"+STUDYOS_CAPTURE+"?'+p.toString(),'_blank','noopener,noreferrer')})()";
  return 'javascript:'+code;
}

export default function BookmarkCompanion(){
  const [copied,setCopied]=useState(false);
  const bookmarklet=useMemo(()=>buildBookmarklet(),[]);

  async function copy(){
    await navigator.clipboard.writeText(bookmarklet);
    setCopied(true);setTimeout(()=>setCopied(false),1600);
  }

  return <main className="bookmark-page">
    <header className="bookmark-top">
      <Link href="/app?view=Learning"><ArrowLeft/>Learning</Link>
      <StudyOSLogo/>
      <Link href="/theater">Learning Theater <ExternalLink/></Link>
    </header>

    <section className="bookmark-hero">
      <div>
        <span>₹0 · CHROME · NO EXTENSION</span>
        <h1>StudyOS Bookmark Companion</h1>
        <p>Create one normal Chrome bookmark. Whenever you are studying on YouTube, PW, DIKSHA, Khan Academy or another lesson page, click it to send the current learning context into StudyOS.</p>
      </div>
      <div className="bookmark-visual">
        <span className="bookmark-pill">Chrome tab</span>
        <div className="bookmark-flow"><Video/><i></i><MousePointerClick/><i></i><Sparkles/></div>
        <b>Lesson → one click → StudyOS</b>
      </div>
    </section>

    <section className="bookmark-grid">
      <article className="bookmark-install-card">
        <span>STEP 1</span>
        <h2>Create the bookmark</h2>
        <p>Show Chrome’s bookmarks bar, add a new bookmark/page, name it <b>⚡ Save to StudyOS</b>, then paste the code below into its URL field.</p>
        <div className="bookmark-code"><code>{bookmarklet}</code><button onClick={copy}>{copied?<Check/>:<Clipboard/>}{copied?'Copied':'Copy bookmark code'}</button></div>
        <div className="bookmark-tip"><b>Chrome shortcut:</b> <span>Ctrl + Shift + B</span> toggles the bookmarks bar on Windows.</div>
      </article>

      <article className="bookmark-use-card">
        <span>STEP 2</span>
        <h2>Use it while studying</h2>
        <div className="bookmark-steps">
          <div><b>1</b><p>Open a lesson normally in Chrome.</p></div>
          <div><b>2</b><p>Play or seek to wherever you are studying.</p></div>
          <div><b>3</b><p>Click <strong>⚡ Save to StudyOS</strong>.</p></div>
          <div><b>4</b><p>StudyOS opens with the lesson and detected progress already filled.</p></div>
        </div>
      </article>
    </section>

    <section className="bookmark-capabilities">
      <div><Check/><b>Current page URL</b><span>Automatic</span></div>
      <div><Check/><b>Page / lesson title</b><span>Automatic</span></div>
      <div><Check/><b>Selected notes</b><span>When you deliberately select text</span></div>
      <div><Check/><b>Video position + duration</b><span>When the page exposes a normal HTML5 video</span></div>
      <div><ShieldCheck/><b>No browser-history permission</b><span>Runs only when you click the bookmark</span></div>
    </section>

    <section className="bookmark-honesty">
      <ShieldCheck/>
      <div><b>What it cannot do</b><p>A bookmark cannot stay running invisibly in the background. If a site hides its player behind a special/isolated player, StudyOS may only receive the page URL/title. That is why YouTube exact progress is best inside Learning Theater, while this bookmark is the free one-click bridge for normal Chrome browsing.</p></div>
    </section>

    <div className="bookmark-actions">
      <Link href="/theater"><span className="bookmark-play-icon">▶</span>Open Learning Theater</Link>
      <Link href="/app?view=Learning" className="secondary">Back to Learning</Link>
    </div>
  </main>;
}