import StudyOSAuth from '@/components/auth/studyos-auth';

export const metadata = {
  title: 'Sign in or create an account — StudyOS AI',
  description: 'Access your private StudyOS academic workspace or create a new account.',
};

export default function AuthPage() {
  return <StudyOSAuth />;
}
