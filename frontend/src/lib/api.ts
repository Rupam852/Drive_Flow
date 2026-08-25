import axios from 'axios';

const getBaseURL = () => {
  return process.env.NEXT_PUBLIC_API_URL || 'https://driveflow-worker.rupambairagya08.workers.dev/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
});

api.interceptors.request.use((config) => {
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

// Response Interceptor: Handle 401 Expired Token & Render Cold-Start Retries
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
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
      const config = error.config;
      if (config && [502, 503, 504].includes(status) && !(config as any)._retryCount) {
        (config as any)._retryCount = 1;
        console.log('Render backend spinning up (502/503/504). Retrying request in 2s...');
        await new Promise((r) => setTimeout(r, 2000));
        return api(config);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
