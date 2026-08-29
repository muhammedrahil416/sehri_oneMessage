import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isHydrated: false, // true once SecureStore has been checked on startup

  // Called once at app startup — reads persisted tokens from SecureStore
  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const userData = await SecureStore.getItemAsync('user_data');

      if (token && userData) {
        set({
          accessToken: token,
          user: JSON.parse(userData),
          isAuthenticated: true,
        });
      }
    } catch {
      // Corrupted storage — treat as logged out
    } finally {
      set({ isHydrated: true });
    }
  },

  // Save auth details after successful login
  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    await SecureStore.setItemAsync('user_data', JSON.stringify(user));

    set({
      user,
      accessToken,
      isAuthenticated: true,
    });
  },

  // Clear auth details on logout
  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_data');

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  },
}));
