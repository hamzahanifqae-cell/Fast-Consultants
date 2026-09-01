import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';

export default function Index() {
  const token = useAuthStore((state) => state.token);

  return <Redirect href={token ? '/home' : '/welcome'} />;
}
