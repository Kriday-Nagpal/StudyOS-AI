'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

export type ParticleDriftProps = {
  speed?: number;
  density?: number;
  opacity?: number;
  className?: string;
  style?: CSSProperties;
};

type Node = { x:number; y:number; vy:number; glyph:string; phase:number };
type Beam = { x:number; y:number; length:number; speed:number; alpha:number };

const glyphs='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*'.split('');

export default function ParticleDrift({speed=0.55,density=0.7,opacity=0.72,className,style}:ParticleDriftProps){
  const canvasRef=useRef<HTMLCanvasElement>(null);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const context=canvas.getContext('2d');
    if(!context)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame=0;
    let width=0;
    let height=0;
    let nodes:Node[]=[];
    let beams:Beam[]=[];
    const pointer={x:-1000,y:-1000};

    const seeded=(index:number,offset:number)=>{
      const value=Math.sin(index*9283.31+offset*77.17)*43758.5453;
      return value-Math.floor(value);
    };
    const populate=()=>{
      const nodeCount=Math.max(22,Math.round((width*height/9000)*density));
      const beamCount=Math.max(7,Math.round(nodeCount*.18));
      nodes=Array.from({length:nodeCount},(_,i)=>({
        x:seeded(i,1)*width,y:seeded(i,2)*height,vy:.06+seeded(i,3)*.16,
        glyph:glyphs[Math.floor(seeded(i,4)*glyphs.length)],phase:seeded(i,5)*Math.PI*2,
      }));
      beams=Array.from({length:beamCount},(_,i)=>({
        x:seeded(i,8)*width,y:seeded(i,9)*height,length:42+seeded(i,10)*90,
        speed:.45+seeded(i,11)*1.15,alpha:.08+seeded(i,12)*.2,
      }));
    };
    const resize=()=>{
      const rect=canvas.getBoundingClientRect();
      const dpr=Math.min(window.devicePixelRatio||1,2);
      width=rect.width;height=rect.height;
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      context.setTransform(dpr,0,0,dpr,0,0);
      populate();
    };
    const move=(event:PointerEvent)=>{
      const rect=canvas.getBoundingClientRect();
      pointer.x=event.clientX-rect.left;pointer.y=event.clientY-rect.top;
    };
    const leave=()=>{pointer.x=-1000;pointer.y=-1000};
    const draw=()=>{
      context.clearRect(0,0,width,height);
      beams.forEach(beam=>{
        if(!reduced){beam.y-=beam.speed*speed;if(beam.y+beam.length<0)beam.y=height+beam.length}
        const gradient=context.createLinearGradient(beam.x,beam.y,beam.x,beam.y+beam.length);
        gradient.addColorStop(0,`rgba(114,198,255,${beam.alpha})`);gradient.addColorStop(1,'transparent');
        context.strokeStyle=gradient;context.lineWidth=1;
        context.beginPath();context.moveTo(beam.x,beam.y);context.lineTo(beam.x,beam.y+beam.length);context.stroke();
      });
      for(let i=0;i<nodes.length;i+=1){
        const first=nodes[i];
        for(let j=i+1;j<nodes.length;j+=1){
          const second=nodes[j];
          const distance=Math.hypot(first.x-second.x,first.y-second.y);
          if(distance<92){context.strokeStyle=`rgba(178,170,255,${.11*(1-distance/92)})`;context.lineWidth=.6;context.beginPath();context.moveTo(first.x,first.y);context.lineTo(second.x,second.y);context.stroke()}
        }
      }
      context.font='10px ui-monospace, SFMono-Regular, Menlo, monospace';context.textAlign='center';context.textBaseline='middle';
      nodes.forEach((node,index)=>{
        if(!reduced){node.y+=node.vy*speed;if(node.y>height+12){node.y=-12;node.x=seeded(index,14)*width}}
        const distance=Math.hypot(pointer.x-node.x,pointer.y-node.y);
        if(distance<150){context.strokeStyle=`rgba(111,197,255,${.35*(1-distance/150)})`;context.beginPath();context.moveTo(node.x,node.y);context.lineTo(pointer.x,pointer.y);context.stroke()}
        const shimmer=.52+Math.sin(performance.now()*.0008+node.phase)*.18;
        context.fillStyle=distance<150?'rgba(121,205,255,.92)':`rgba(190,184,231,${shimmer})`;
        context.fillText(node.glyph,node.x,node.y);
      });
      if(!reduced)frame=requestAnimationFrame(draw);
    };
    resize();draw();
    const observer=new ResizeObserver(resize);observer.observe(canvas);
    canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave)};
  },[density,speed]);

  return <canvas ref={canvasRef} aria-hidden className={className} style={{opacity,...style}}/>;
}
