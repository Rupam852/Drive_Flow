'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('role');
    const token = localStorage.getItem(`token_${role}`) || localStorage.getItem('token');
    const targetPath = (role && token) ? (role === 'admin' ? '/admin/dashboard' : '/user/dashboard') : '/login';

    // Instant 0ms routing to target destination without connecting screens or popups
    router.replace(targetPath);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080711]" />
  );
}
