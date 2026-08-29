import apiClient from './client';

export const authApi = {
  // Password or Role Login
  login: async (data) => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  // Send OTP to user phone number
  sendOtp: async (data) => {
    const response = await apiClient.post('/auth/send-otp', data);
    return response.data;
  },

  // Verify OTP code
  verifyOtp: async (data) => {
    const response = await apiClient.post('/auth/forgot-password/verify-otp', data);
    return response.data;
  },

  // Register new user
  register: async (data) => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },
};