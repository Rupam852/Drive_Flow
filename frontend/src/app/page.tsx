'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check auth status and persist route selection
    const role = localStorage.getItem('role');
    const token = localStorage.getItem(`token_${role}`) || localStorage.getItem('token');
    const targetPath = (role && token) ? (role === 'admin' ? '/admin/dashboard' : '/user/dashboard') : '/login';

    // Instant redirect to keep both web portal and native app super fast and clean
    router.replace(targetPath);
  }, [router]);

  return <LoadingScreen message="Launching DriveFlow..." showSubtext={false} />;
}
