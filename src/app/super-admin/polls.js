import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import client from '../../api/client'; // Your Axios client

export default function SuperAdminPollsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Get current date formatted as YYYY-MM-DD for default present day display
  const todayStr = new Date().toISOString().split('T')[0];
  const [inputDate, setInputDate] = useState(todayStr);

  // Poll record state
  const [pollRecord, setPollRecord] = useState(null);

  // Fetch poll data whenever inputDate changes
    const fetchPollHistory = useCallback(async (dateToFetch) => {
    try {
      setLoading(true);
      // Replace with your actual backend endpoint e.g., client.get(`/admin/polls?date=${dateToFetch}`)
      const response = await client.get(`/super-admin/polls`, { params: { date: dateToFetch } });
      setPollRecord(response.data);

      // Temporary mock database lookup simulation based on date
      setTimeout(() => {
        if (dateToFetch === todayStr) {
          setPollRecord({
            id: 'poll-today',
            date: todayStr,
            question: 'Will you be having Sehri food tomorrow?',
            yesCount: 48,
            totalVotes: 60
          });
        } else if (dateToFetch === '2026-09-02') {
          setPollRecord({
            id: 'poll-yesterday',
            date: '2026-09-02',
            question: 'Will you be having Sehri food tomorrow?',
            yesCount: 42,
            totalVotes: 55
          });
        } else {
          setPollRecord(null); // No poll found for that date
        }
        setLoading(false);
      }, 300);
    } catch (_error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to load poll history.');
    }
  }, [todayStr]);

  useEffect(() => {
    fetchPollHistory(inputDate);
  }, [inputDate, fetchPollHistory]);

  // Delete poll history for the selected date
  const handleDeletePoll = () => {
    if (!pollRecord) return;

    Alert.alert(
      'Delete Poll History', 
      `Are you sure you want to delete poll history for ${pollRecord.date}?`, 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // await client.delete(`/admin/polls/${pollRecord.id}`);
              setPollRecord(null);
              Alert.alert('Success', 'Poll history deleted successfully.');
            } catch (_error) {
              Alert.alert('Error', 'Failed to delete poll history.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Poll History</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Date Filter Card */}
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Select Date, Month & Year (YYYY-MM-DD)</Text>
          <View style={styles.inputRow}>
            <TextInput 
              style={styles.input} 
              value={inputDate} 
              onChangeText={setInputDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity 
              style={styles.todayBtn} 
              onPress={() => setInputDate(todayStr)}
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Display Section */}
        {loading ? (
          <ActivityIndicator size="large" color="#0D9488" style={{ marginTop: 40 }} />
        ) : pollRecord ? (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.dateBadge}>Date: {pollRecord.date}</Text>
              <TouchableOpacity onPress={handleDeletePoll} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <Text style={styles.pollQuestion}>{pollRecord.question}</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{pollRecord.yesCount}</Text>
                <Text style={styles.statLabel}>Selected Yes</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{pollRecord.totalVotes}</Text>
                <Text style={styles.statLabel}>Total Responses</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="bar-chart-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No poll history found for {inputDate}.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  backButton: { padding: 4 },
  content: { padding: 16 },
  filterCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 2 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F9FAFB', fontSize: 15, color: '#1F2937' },
  todayBtn: { backgroundColor: '#0D9488', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, marginLeft: 8 },
  todayBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 2 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 8 },
  dateBadge: { fontSize: 12, fontWeight: '600', color: '#0D9488', backgroundColor: '#F0FDFA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  deleteBtn: { padding: 4 },
  pollQuestion: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#0D9488', marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#6B7280' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic', marginTop: 8, textAlign: 'center' }
});