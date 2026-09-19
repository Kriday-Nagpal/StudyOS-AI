import type { CSSProperties } from 'react';

export function StudyOSMark({size=34,className='',style}:{size?:number;className?:string;style?:CSSProperties}) {
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="studyos-g1" x1="18" y1="14" x2="76" y2="84" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6C63FF"/><stop offset=".55" stopColor="#7B5CF0"/><stop offset="1" stopColor="#49B7F2"/>
      </linearGradient>
      <linearGradient id="studyos-g2" x1="78" y1="14" x2="20" y2="82" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A58BFF"/><stop offset="1" stopColor="#5A7CF5"/>
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="90" height="90" rx="25" fill="#0B0912"/>
    <path d="M69.5 24.5C63.8 18.9 56.2 16 47.8 16C36.1 16 26.3 21.8 21.5 31.1C18.7 36.5 18.8 42.1 21.7 46.7C24.9 51.9 30.4 54 39.8 54H55.8C61.1 54 64.2 55.2 65.7 57.4C67.1 59.4 67 62 65.3 64.8C62.5 69.4 57 72 50 72C42.7 72 36.1 69.5 30.7 64.5L20.3 75.1C28.2 82.1 38.2 86 49.8 86C62.9 86 74 80 79.8 69.8C83.2 63.8 83.1 57.4 79.5 52.3C75.8 47 69.3 44 58.7 44H42.1C36.8 44 33.9 43.1 32.6 41.1C31.5 39.4 31.7 37.1 33 34.9C35.6 30.7 40.8 28 47.4 28C52.1 28 56.4 29.5 59.7 32.7L69.5 24.5Z" fill="url(#studyos-g1)"/>
    <path d="M28.6 19.2L38.1 29.5C41.2 27.7 44.5 26.8 48 26.8C53.1 26.8 57.4 28.3 61.1 31.3L70.3 22.9C64.2 17.2 56.4 14 47.5 14C40.4 14 33.8 15.8 28.6 19.2Z" fill="url(#studyos-g2)" opacity=".92"/>
    <path d="M39 45.3L48 39.8L57 45.3L48 50.8L39 45.3Z" fill="white"/><path d="M48 39.8V50.8" stroke="#D9D4FF" strokeWidth="1.6"/>
  </svg>;
}

export default function StudyOSLogo({compact=false,className=''}:{compact?:boolean;className?:string}) {
  return <span className={'studyos-logo '+className}><StudyOSMark size={compact?30:36}/>{compact?null:<span className="studyos-wordmark"><b>StudyOS</b><em>AI</em></span>}</span>;
}
