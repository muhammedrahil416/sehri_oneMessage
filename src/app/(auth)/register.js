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

// Cascading Data Mapping
const REGIONS = ['North Bengaluru', 'South Bengaluru', 'West Bengaluru', 'East Bengaluru'];

const ZONES_BY_REGION = {
  'South Bengaluru': ['Girls Zone', 'Masjid Zone', 'Hostel Zone', 'Stanza Zone'],
  'North Bengaluru': [],
  'West Bengaluru': [],
  'East Bengaluru': [],
};

const OPTIONS_BY_ZONE = {
  'Masjid Zone': [
    'Maruti pg',
    'Flat infront of masjid',
    'Malanad apartments',
    'Dupasipallya musalla',
    'RK pal pg',
    'Others',
  ],
  'Hostel Zone': ['Krishna Hostel', 'Cauvery Hostel', 'MV hostel', 'Others'],
  'Stanza Zone': [
    '888 7th Stage 11th Cross Road, Mylasandra Kings and Queens PG',
    'Stanza Living (Cordoba)',
    'Target PG',
    'RR Luxury PG',
    'Krishna Villa Apartments',
    'Balaji PG for Gents',
    'Lasya PG',
    'Shiva Sai PG',
    'Stanza Living (Huelva House)',
    'Global Vista',
    'SS Luxury PG',
    'Good Lands PG',
    'Millenial Blue Opal',
    'Paras Global Kutir',
    'Others',
  ],
  'Girls Zone': [
    'Chaitrashree Comforts',
    'Chiguru PG for ladies',
    'Global Residency',
    'Global Vista Apartment',
    'Goodlands luxury ladies PG',
    'habitat illuminar',
    'JV Queens PG',
    'JV Queens Prime PG',
    'Krishna Global Villaments',
    'New SL Ladies PG',
    'RVCE girls DJ hostel',
    'RVCE girls krishna garden hostel',
    'Sai Ram luxury PG for ladies',
    'Samriddhi PG for ladies',
    'SL grand luxury ladies PG',
    'SL prime PG for ladies',
    'SLN grand',
    'Sri Ladies PG',
    'Sri Sai Durga ladies PG',
    'Sri vengamamba PG',
    'SS Home stay',
    'SSR PG for ladies',
    'Stanza Living Granada House',
    'Stanza Living Nome House',
    'Stay Luxe Inn',
    'The Millennial Topaz 1',
    'The Millennial Topaz 2',
    'Others',
  ],
};

export default function RegisterScreen() {
  const router = useRouter();

  // Basic Form States
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const city = 'Bangalore'; // Built-in & non-editable

  // Cascading Selection States
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedPg, setSelectedPg] = useState('');
  const [customPg, setCustomPg] = useState('');

  // Dropdown Open/Close Visibility States
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [showZoneDropdown, setShowZoneDropdown] = useState(false);
  const [showPgDropdown, setShowPgDropdown] = useState(false);

  const [loading, setLoading] = useState(false);

  // Registration Handler
  const handleRegister = async () => {
    const finalPgName = selectedPg === 'Others' ? customPg : selectedPg;

    if (!firstName || !email || !phone || !password || !selectedRegion || !selectedZone || !finalPgName) {
      Alert.alert('Error', 'Please fill in all mandatory fields.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        firstName,
        email,
        phone,
        password,
        city,
        region: selectedRegion,
        zone: selectedZone,
        pgName: finalPgName,
      };

      await authApi.register(payload);

      Alert.alert('Success', 'Account registered successfully!', [
        { text: 'Login Now', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Create Account</Text>

        {/* First Name */}
        <Text style={styles.label}>First Name *</Text>
        <TextInput style={styles.input} placeholder="Enter your first name" value={firstName} onChangeText={setFirstName} />

        {/* Email */}
        <Text style={styles.label}>Email Address *</Text>
        <TextInput style={styles.input} placeholder="Enter your email" keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />

        {/* Phone */}
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput style={styles.input} placeholder="Enter 10-digit mobile number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={10} />

        {/* Password */}
        <Text style={styles.label}>Password *</Text>
        <TextInput style={styles.input} placeholder="Create password" secureTextEntry value={password} onChangeText={setPassword} />

        {/* Fixed City */}
        <Text style={styles.label}>City</Text>
        <TextInput style={[styles.input, styles.disabledInput]} value={city} editable={false} />

        {/* 1. Region Dropdown */}
        <Text style={styles.label}>Region *</Text>
        <TouchableOpacity style={styles.dropdownPicker} onPress={() => setShowRegionDropdown(!showRegionDropdown)}>
          <Text style={selectedRegion ? styles.pickerText : styles.placeholderText}>
            {selectedRegion || 'Select Region'}
          </Text>
        </TouchableOpacity>
        {showRegionDropdown && (
          <View style={styles.dropdownMenu}>
            {REGIONS.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.dropdownOption}
                onPress={() => {
                  setSelectedRegion(item);
                  setSelectedZone('');
                  setSelectedPg('');
                  setShowRegionDropdown(false);
                }}
              >
                <Text style={styles.optionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 2. Zone Dropdown (Cascaded from Region) */}
        {selectedRegion !== '' && (
          <>
            <Text style={styles.label}>Zone *</Text>
            <TouchableOpacity style={styles.dropdownPicker} onPress={() => setShowZoneDropdown(!showZoneDropdown)}>
              <Text style={selectedZone ? styles.pickerText : styles.placeholderText}>
                {selectedZone || 'Select Zone'}
              </Text>
            </TouchableOpacity>
            {showZoneDropdown && (
              <View style={styles.dropdownMenu}>
                {(ZONES_BY_REGION[selectedRegion] || []).length > 0 ? (
                  ZONES_BY_REGION[selectedRegion].map((zone) => (
                    <TouchableOpacity
                      key={zone}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedZone(zone);
                        setSelectedPg('');
                        setShowZoneDropdown(false);
                      }}
                    >
                      <Text style={styles.optionText}>{zone}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.dropdownOption}>
                    <Text style={styles.placeholderText}>No zones available for this region</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* 3. PG / Hostel Dropdown (Cascaded from Zone) */}
        {selectedZone !== '' && (
          <>
            <Text style={styles.label}>PG / Hostel *</Text>
            <TouchableOpacity style={styles.dropdownPicker} onPress={() => setShowPgDropdown(!showPgDropdown)}>
              <Text style={selectedPg ? styles.pickerText : styles.placeholderText}>
                {selectedPg || 'Select PG or Hostel'}
              </Text>
            </TouchableOpacity>
            {showPgDropdown && (
              <View style={styles.dropdownMenu}>
                {(OPTIONS_BY_ZONE[selectedZone] || []).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setSelectedPg(option);
                      setShowPgDropdown(false);
                    }}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* Custom PG Text Input if "Others" is selected */}
        {selectedPg === 'Others' && (
          <>
            <Text style={styles.label}>Type PG / Hostel Name *</Text>
            <TextInput style={styles.input} placeholder="Enter custom PG/Hostel name" value={customPg} onChangeText={setCustomPg} />
          </>
        )}

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Register</Text>}
        </TouchableOpacity>

        {/* Back to Login Link */}
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16 },
  disabledInput: { backgroundColor: '#E2E8F0', color: '#64748B' },
  dropdownPicker: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12 },
  pickerText: { fontSize: 16, color: '#0F172A' },
  placeholderText: { fontSize: 16, color: '#94A3B8' },
  dropdownMenu: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, marginTop: 4 },
  dropdownOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  optionText: { fontSize: 15, color: '#334155' },
  submitButton: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  backLink: { marginTop: 16, alignItems: 'center' },
  backText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
});