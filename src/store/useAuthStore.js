import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isHydrated: false,
  active_role: null,         // 'user' | 'admin' | 'super_admin'
  available_roles: [],       // e.g. ['user', 'admin']

  // ---------------------------------------------------------------------------
  // Called once at app startup — reads persisted tokens + role from SecureStore
  // ---------------------------------------------------------------------------
  hydrate: async () => {
    try {
      const token    = await SecureStore.getItemAsync('access_token');
      const userData = await SecureStore.getItemAsync('user_data');
      const roleData = await SecureStore.getItemAsync('active_role');
      const rolesData = await SecureStore.getItemAsync('available_roles');

      if (token && userData) {
        set({
          accessToken: token,
          user: JSON.parse(userData),
          isAuthenticated: true,
          active_role: roleData || 'user',
          available_roles: rolesData ? JSON.parse(rolesData) : [],
        });
      }
    } catch {
      // Corrupted storage — treat as logged out
    } finally {
      set({ isHydrated: true });
    }
  },

  // ---------------------------------------------------------------------------
  // Called after successful login
  // ---------------------------------------------------------------------------
  setAuth: async (user, accessToken, refreshToken, active_role, available_roles) => {
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    await SecureStore.setItemAsync('user_data', JSON.stringify(user));
    await SecureStore.setItemAsync('active_role', active_role);
    await SecureStore.setItemAsync('available_roles', JSON.stringify(available_roles));

    set({
      user,
      accessToken,
      isAuthenticated: true,
      active_role,
      available_roles,
    });
  },

  // ---------------------------------------------------------------------------
  // Switch to a different role — calls backend, swaps tokens
  // Returns { success: true } or throws so the caller can show an error
  // ---------------------------------------------------------------------------
  switchRole: async (requestedRole) => {
    try {
      const response = await apiClient.post('/auth/switch-role', { role: requestedRole });
      const { accessToken, refreshToken, active_role, available_roles, profile } = response.data.data;

      await SecureStore.setItemAsync('access_token', accessToken);
      await SecureStore.setItemAsync('refresh_token', refreshToken);
      await SecureStore.setItemAsync('user_data', JSON.stringify(profile));
      await SecureStore.setItemAsync('active_role', active_role);
      await SecureStore.setItemAsync('available_roles', JSON.stringify(available_roles));

      set({
        accessToken,
        user: profile,
        active_role,
        available_roles,
      });

      return { success: true };
    } catch (err) {
      throw err;
    }
  },

  // ---------------------------------------------------------------------------
  // Logout — clears everything
  // ---------------------------------------------------------------------------
  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_data');
    await SecureStore.deleteItemAsync('active_role');
    await SecureStore.deleteItemAsync('available_roles');

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      active_role: null,
      available_roles: [],
    });
  },
}));
