import LearningCompanionCapture from '@/components/learning-companion-capture';

export const metadata = {
  title: 'Capture learning — StudyOS AI',
  description: 'Review and save the current lesson into your private StudyOS workspace.',
};

type CaptureParams = Promise<{url?:string;title?:string;text?:string}>;

export default async function CapturePage({searchParams}:{searchParams:CaptureParams}){
  const params=await searchParams;
  return <LearningCompanionCapture
    initialUrl={(params.url||'').slice(0,2000)}
    initialTitle={(params.title||'').slice(0,300)}
    initialText={(params.text||'').slice(0,12000)}
  />;
}
