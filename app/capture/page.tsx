import LearningCompanionCapture from '@/components/learning-companion-capture';

export const metadata = {
  title: 'Capture learning — StudyOS AI',
  description: 'Review and save the current lesson into your private StudyOS workspace.',
};

type CaptureParams = Promise<{url?:string;title?:string;text?:string;position?:string;duration?:string;source?:string;rate?:string}>;

export default async function CapturePage({searchParams}:{searchParams:CaptureParams}){
  const params=await searchParams;
  return <LearningCompanionCapture
    initialUrl={(params.url||'').slice(0,2000)}
    initialTitle={(params.title||'').slice(0,300)}
    initialText={(params.text||'').slice(0,12000)}
    initialPosition={Math.max(0,Number(params.position||0)||0)}
    initialDuration={Math.max(0,Number(params.duration||0)||0)}
    initialSource={(params.source||'manual').slice(0,30)}
    initialPlaybackRate={Math.max(.25,Math.min(4,Number(params.rate||1)||1))}
  />;
}
