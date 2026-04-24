'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import LoadingScreen from '@/components/LoadingScreen';

export default function Home() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Waking up server...');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // Simulate progress bar moving slowly up to 90% while waiting
    interval = setInterval(() => {
      setProgress(p => {
        if (p < 90) return p + Math.random() * 5;
        return p;
      });
    }, 1000);

    const pingServer = async () => {
      try {
        await api.get('/auth/health'); 
        
        setProgress(100);
        setMessage('Server Connected Successfully!');
        clearInterval(interval);
        
        setTimeout(() => {
          router.push('/login');
        }, 1000);
        
      } catch (e: any) {
        setTimeout(pingServer, 3000);
      }
    };

    pingServer();
    return () => clearInterval(interval);
  }, [router]);

  return <LoadingScreen message={message} progress={progress} />;
}
