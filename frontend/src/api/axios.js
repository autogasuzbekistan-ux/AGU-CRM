import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — token qo'shish
api.interceptors.request.use((config) => {
  // Zustand store dan token olish
  const auth = JSON.parse(localStorage.getItem('agu-crm-auth') || '{}');
  const token = auth?.state?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — token yangilash
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const auth = JSON.parse(localStorage.getItem('agu-crm-auth') || '{}');
        const refreshToken = auth?.state?.refreshToken;

        if (!refreshToken) {
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefresh } = data.data;

        // Store yangilash
        const stored = JSON.parse(localStorage.getItem('agu-crm-auth') || '{}');
        stored.state.accessToken = accessToken;
        stored.state.refreshToken = newRefresh;
        localStorage.setItem('agu-crm-auth', JSON.stringify(stored));

        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    const message = error.response?.data?.message || 'Xato yuz berdi';
    if (error.response?.status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
