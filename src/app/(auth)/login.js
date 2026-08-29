import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Form State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');

  // UI State
  const [loading, setLoading] = useState(false);


  // Login Submission Handler
  const handleLogin = async () => {
  if (!phone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.login({ phone, password, role });

      // Save session tokens and navigate
      await setAuth(response.user, response.accessToken, response.refreshToken);
      router.replace('/(app)/home');
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed. Please check your credentials.';
      Alert.alert('Login Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>One Message</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {/* Role Selection */}
        <Text style={styles.label}>Select Role</Text>
        <View style={styles.roleContainer}>
          {['user', 'admin', 'super_admin'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.roleButton, role === item && styles.roleButtonActive]}
              onPress={() => setRole(item)}
            >
              <Text style={[styles.roleText, role === item && styles.roleTextActive]}>
                {item === 'super_admin' ? 'Super Admin' : item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>


        {/* Phone Input */}
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />

        {/* Password Login Mode */}
          
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {/* INSERT FORGOT PASSWORD HERE */}
    <TouchableOpacity 
      style={styles.forgotPasswordContainer}
      onPress={() => router.push('/(auth)/forgot-password')}
    >
      <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
    </TouchableOpacity>
  


       

        {/* Submit Button */}
        <TouchableOpacity
        
          style={styles.submitButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>
              Login
            </Text>
          )}
        </TouchableOpacity>

        {/* Register Link */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.registerText}>
           {" Don't have an account?"} <Text style={styles.boldText}>Register</Text>
          </Text>
        </TouchableOpacity>

        {/* App Description */}
<View style={styles.aboutContainer}>
  <Text style={styles.aboutTitle}>About One Message</Text>
  <Text style={styles.aboutDescription}>
    One Message is a unified platform designed to streamline messaging and 
    administrative access for Users, Admins, and Super Admins.
  </Text>
</View>


      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  roleButtonActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  roleText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  roleTextActive: { color: '#FFF' },
  tabContainer: { flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#2563EB' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  otpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sendOtpLink: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 16,
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  registerLink: { marginTop: 16, alignItems: 'center' },
  registerText: { color: '#64748B', fontSize: 14 },
  boldText: { color: '#2563EB', fontWeight: 'bold' },
  forgotPasswordContainer: {
  alignSelf: 'flex-end',
  marginBottom: 20,
  marginTop: 8,
},
forgotPasswordText: {
  color: '#2563EB',
  fontSize: 14,
  fontWeight: '500',
},
aboutContainer: {
  marginTop: 24,
  paddingHorizontal: 16,
  alignItems: 'center',
},
aboutTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#475569',
  marginBottom: 4,
},
aboutDescription: {
  fontSize: 12,
  color: '#94A3B8',
  textAlign: 'center',
  lineHeight: 18,
},
}
);