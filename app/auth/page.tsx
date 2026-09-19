import StudyOSAuth from '@/components/auth/studyos-auth';

export const metadata = {
  title: 'Sign in or create an account — StudyOS AI',
  description: 'Access your private StudyOS academic workspace or create a new account.',
};

type AuthSearchParams = Promise<{
  mode?: string;
  error?: string;
  error_description?: string;
}>;

export default async function AuthPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  const params = await searchParams;
  const initialMode = params.mode === 'signup' ? 'signup' : 'signin';
  const initialError = params.error_description || params.error || '';
  return <StudyOSAuth initialMode={initialMode} initialError={initialError} />;
}
