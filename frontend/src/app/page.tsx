'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [showLoading, setShowLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check auth status and persist route selection
    const role = localStorage.getItem('role');
    const token = localStorage.getItem(`token_${role}`) || localStorage.getItem('token');
    const targetPath = (role && token) ? (role === 'admin' ? '/admin/dashboard' : '/user/dashboard') : '/login';

    // Pre-fetch target to speed up transition
    router.prefetch(targetPath);

    let isMounted = true;
    let progressTimer: NodeJS.Timeout;

    // Start a 800ms timeout. If server hasn't responded by then, show the loading screen.
    const delayTimer = setTimeout(() => {
      if (isMounted) {
        setShowLoading(true);
        // Start showing progressive load
        progressTimer = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 95) return 95; // Hold at 95% until server actually responds
            return prev + Math.random() * 8;
          });
        }, 300);
      }
    }, 800);

    // Call the server ping to verify availability
    api.get('/auth/ping')
      .then(() => {
        clearTimeout(delayTimer);
        if (progressTimer) clearInterval(progressTimer);
        
        if (isMounted) {
          setProgress(100);
          setTimeout(() => {
            router.replace(targetPath);
          }, 100);
        }
      })
      .catch(() => {
        // Fallback: even if ping fails, attempt to route to target
        clearTimeout(delayTimer);
        if (progressTimer) clearInterval(progressTimer);
        if (isMounted) {
          router.replace(targetPath);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(delayTimer);
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [router]);

  if (!showLoading) {
    // If the server responded instantly (under 250ms), render nothing and redirect immediately!
    return null;
  }

  // Show loading screen only if server was asleep (>250ms)
  return <LoadingScreen message="Connecting to Server..." progress={progress} showSubtext={true} />;
}
