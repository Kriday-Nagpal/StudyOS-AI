import LearningTheater from '@/components/learning-theater';

export const metadata={
  title:'Learning Theater — StudyOS AI',
  description:'Chrome-first learning with exact YouTube progress and Smart Launch for external lessons.'
};

type Params=Promise<{url?:string;title?:string}>;

export default async function TheaterPage({searchParams}:{searchParams:Params}){
  const params=await searchParams;
  return <LearningTheater initialUrl={(params.url||'').slice(0,2000)} initialTitle={(params.title||'').slice(0,400)}/>;
}
