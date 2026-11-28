import axios from 'axios';

const UNAVAILABLE_MESSAGE = 'DMMS is temporarily unavailable. Please wait while the system reconnects.';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
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
  (error) => Promise.reject(error)
);

// Response interceptor to format errors safely and signal connection failures
api.interceptors.response.use(
  (response) => {
    window.dispatchEvent(new Event('dmms:backend-online'));
    return response.data;
  },
  (error) => {
    const status = error.response?.status || null;
    const isNetworkError = !error.response;
    const isGatewayUnavailable = status === 502 || status === 503 || status === 504;
    const isBackendUnavailable = isNetworkError || isGatewayUnavailable;

    if (isBackendUnavailable) {
      window.dispatchEvent(
        new CustomEvent('dmms:backend-unavailable', {
          detail: { message: UNAVAILABLE_MESSAGE, status }
        })
      );
    }

    const rawServerMessage = error.response?.data?.message;
    const message = isBackendUnavailable
      ? UNAVAILABLE_MESSAGE
      : rawServerMessage || 'Unable to complete the request. Please try again.';

    const formattedError = new Error(message);
    formattedError.status = status;
    formattedError.isNetworkError = isNetworkError;
    formattedError.isBackendUnavailable = isBackendUnavailable;
    return Promise.reject(formattedError);
  }
);

export { UNAVAILABLE_MESSAGE };
export default api;
