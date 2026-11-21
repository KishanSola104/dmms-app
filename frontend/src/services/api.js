import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach school and user auth tokens
api.interceptors.request.use(
  (config) => {
    const userToken = localStorage.getItem('dmms_user_token');
    const schoolToken = localStorage.getItem('dmms_school_token');

    if (userToken) {
      config.headers['Authorization'] = `Bearer ${userToken}`;
    }
    if (schoolToken) {
      config.headers['x-school-token'] = schoolToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to format errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      (error.response && error.response.data && error.response.data.message) ||
      error.message ||
      'An unexpected error occurred. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default api;
