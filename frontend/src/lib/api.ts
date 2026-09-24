import axios, { InternalAxiosRequestConfig } from 'axios';

const getBaseURL = () => {
  return process.env.NEXT_PUBLIC_API_URL || 'https://driveflow-worker.rupambairagya08.workers.dev/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Offline & Reconnect Queue Handler
const pendingRetryQueue: Array<() => void> = [];

export const notifyNetworkReconnected = () => {
  if (typeof window === 'undefined') return;

  // Flush all queued requests waiting for network recovery
  const toExecute = [...pendingRetryQueue];
  pendingRetryQueue.length = 0;

  toExecute.forEach((retryFn) => {
    try {
      retryFn();
    } catch (e) {
      console.error('Error retrying queued request:', e);
    }
  });

  // Notify all page components that internet has been restored
  window.dispatchEvent(new CustomEvent('app:network-reconnected'));
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyNetworkReconnected();
  });
  window.addEventListener('app:network-reconnected', () => {
    notifyNetworkReconnected();
  });
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    let token = null;

    // Smart Multi-Session: Pick token based on current role path
    if (path.startsWith('/admin')) {
      token = localStorage.getItem('token_admin');
    } else if (path.startsWith('/user')) {
      token = localStorage.getItem('token_user');
    }

    // Fallback to legacy generic token
    if (!token) {
      token = localStorage.getItem('token');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response Interceptor: Handle 401 Expired Token, Render Cold-Start Retries, & Offline Auto-Retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
      const config = error.config;
      const path = window.location.pathname;

      // 1. If 401 Unauthorized (Expired or Invalid JWT Token) -> Auto-Clear Stale Token and Redirect to Login
      if (status === 401 && !path.includes('/login') && !path.includes('/register') && !path.includes('/forgot-password') && !path.includes('/reset-password')) {
        console.warn('Session expired or invalid token detected (401). Clearing auth and redirecting to login...');
        
        localStorage.removeItem('token_user');
        localStorage.removeItem('token_admin');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('admin');
        localStorage.removeItem('role');

        const targetUrl = path.startsWith('/admin') ? '/login?role=admin&expired=true' : '/login?expired=true';
        window.location.href = targetUrl;
        return Promise.reject(error);
      }

      // 2. Handle Render Cold Start / 502/503/504 Auto Retry
      if (config && [502, 503, 504].includes(status) && !(config as any)._retryCount) {
        (config as any)._retryCount = 1;
        console.log('Render backend spinning up (502/503/504). Retrying request in 2s...');
        await new Promise((r) => setTimeout(r, 2000));
        return api(config);
      }

      // 3. Handle Offline / Network Disconnect Auto-Retry
      // If request failed because there is no internet, queue and retry automatically once connection restores
      const isNetworkError = !error.response && (
        error.code === 'ERR_NETWORK' ||
        error.message === 'Network Error' ||
        error.name === 'AxiosError' ||
        (typeof navigator !== 'undefined' && !navigator.onLine)
      );

      if (isNetworkError && config) {
        const retryAttempts = (config as any)._networkRetryCount || 0;
        // Allow up to 5 auto-retries when internet restores
        if (retryAttempts < 5) {
          (config as any)._networkRetryCount = retryAttempts + 1;

          return new Promise((resolve, reject) => {
            const executeRetry = () => {
              api(config).then(resolve).catch(reject);
            };

            // If browser already reports online, give a short 1.2s delay and retry
            if (typeof navigator !== 'undefined' && navigator.onLine && retryAttempts === 0) {
              setTimeout(() => {
                if (navigator.onLine) {
                  executeRetry();
                } else {
                  pendingRetryQueue.push(executeRetry);
                }
              }, 1200);
            } else {
              pendingRetryQueue.push(executeRetry);
            }

            // Safety timeout after 90 seconds so promises don't hang if user abandons app
            setTimeout(() => {
              const idx = pendingRetryQueue.indexOf(executeRetry);
              if (idx !== -1) {
                pendingRetryQueue.splice(idx, 1);
                reject(error);
              }
            }, 90000);
          });
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
