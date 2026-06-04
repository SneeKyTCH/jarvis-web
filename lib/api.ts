import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: async (email: string, password: string) => {
    const res = await api.post('/api/v1/auth/login', { email, password });
    return res.data;
  },

  register: async (email: string, username: string, password: string) => {
    const res = await api.post('/api/v1/auth/register', { email, username, password });
    return res.data;
  },
};

export const chatAPI = {
  send: async (message: string, conversationId: string | null = null) => {
    const res = await api.post('/api/v1/chat/send', {
      message,
      conversation_id: conversationId,
      language: 'en',
    });
    return res.data;
  },
};

export default api;
