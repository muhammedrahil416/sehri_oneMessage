// Inside app/(tabs)/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import {useAuthStore} from '../../store/useAuthStore'; // Zustand auth store
import client from '../../api/client'; // Your existing Axios client instance
import { prayersApi } from '../../api/prayers';

// ==========================================
// PRAYER NAMES LIST (Vertical Order Spec)
// ==========================================
const PRAYER_KEYS = [
  { key: 'tahajjud', label: 'Tahajjud' },
  { key: 'imsak', label: 'Imsak' },
  { key: 'fajr', label: 'Fajr' },
  { key: 'sunrise', label: 'Sunrise' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'iftar', label: 'Iftar' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
  { key: 'juma', label: 'Juma' },
];

export default function HomeScreen() {
  const router = useRouter();

  // 1. ZUSTAND STORE: Pull logged-in user details
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // 2. COMPONENT STATES
  const [namazTimings, setNamazTimings] = useState(null);
  const [hijriDate, setHijriDate] = useState(null);
  const [loadingTimings, setLoadingTimings] = useState(true);

  // Poll-related states
  const [pollState, setPollState] = useState('CLOSED'); // 'REGULAR_VOTE' | 'SPECIAL_REQUEST' | 'CLOSED'
  const [userVote, setUserVote] = useState(null); // 'YES' | 'NO' | null
  const [specialRequested, setSpecialRequested] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);

  // ==========================================
  // SECTION A: FETCH NAMAZ TIMINGS VIA AXIOS
  // Executes via client.js whenever user enters/focuses Home screen
  // ==========================================
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchPrayerTimes = async () => {
        try {
          setLoadingTimings(true);

          const result = await prayersApi.getToday();

          if (isMounted && result.success) {
            const { timings, tahajjud_time, imsak_time, date_hijri } = result.data;

            setHijriDate(date_hijri);
            setNamazTimings({
              tahajjud: tahajjud_time,
              imsak:    imsak_time,
              fajr:     timings?.Fajr,
              sunrise:  timings?.Sunrise,
              dhuhr:    timings?.Dhuhr,
              asr:      timings?.Asr,
              iftar:    timings?.Maghrib,   // Iftar = Maghrib time
              maghrib:  timings?.Maghrib,
              isha:     timings?.Isha,
              juma:     null,               // Not in API — Juma is weekly, not daily
            });
          }
        } catch (error) {
          console.error('Error fetching prayer timings:', error);
          if (isMounted) {
            setNamazTimings(null);
          }
        } finally {
          if (isMounted) setLoadingTimings(false);
        }
      };

      fetchPrayerTimes();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  // ==========================================
  // SECTION B: POLL TIME WINDOW & LOGIC
  // Evaluates 10 PM - 10 AM & 5 PM - 6 PM windows
  // ==========================================
  const checkPollWindow = useCallback(() => {
    const now = new Date();
    const hours = now.getHours(); // 0 - 23 format

    // Rule 1: Regular Voting (10 PM [22:00] to 10 AM [10:00] next morning)
    if (hours >= 22 || hours < 10) {
      setPollState('REGULAR_VOTE');
    }
    // Rule 2: Special Case Request Window (5 PM [17:00] to 6 PM [18:00])
    else if (hours >= 17 && hours < 18) {
      setPollState('SPECIAL_REQUEST');
    }
    // Rule 3: Poll Closed outside designated windows
    else {
      setPollState('CLOSED');
    }
  }, []);

  // Check window on mount and monitor every minute
  useEffect(() => {
    checkPollWindow();
    const interval = setInterval(checkPollWindow, 60000);
    return () => clearInterval(interval);
  }, [checkPollWindow]);

  // Fetch current user's existing vote for today via Axios
  useEffect(() => {
    const fetchUserPollStatus = async () => {
      try {
        const response = await client.get('/poll/my-vote');
        setUserVote(response.data?.vote || null);
        setSpecialRequested(response.data?.specialCase || false);
      } catch (error) {
        console.log('No prior vote record found for today');
      }
    };
    fetchUserPollStatus();
  }, []);

  // ==========================================
  // SECTION C: SCHEDULING LOCAL NOTIFICATIONS
  // Sets recurring local alerts for 10 PM and 5 PM
  // ==========================================
  useEffect(() => {
    const setupDailyNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Notifications.cancelAllScheduledNotificationsAsync();

      // Notification for 10 PM regular voting start
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Sehri Poll Open 🌙',
          body: 'Will you be having Sehri food tomorrow? Cast your vote before 10 AM.',
        },
        //@ts-ignore
        trigger: {
          hour: 22,
          minute: 0,
          repeats: true,
        },
      });

      // Notification for 5 PM special case window start
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Special Case Window Open ⏰',
          body: 'Need to update your Sehri food request? Submit a special request between 5 PM - 6 PM.',
        },
        //@ts-ignore
        trigger: {
          hour: 17,
          minute: 0,
          repeats: true,
        },
      });
    };

    setupDailyNotifications();
  }, []);

  // ==========================================
  // SECTION D: POLL ACTION HANDLERS
  // Sends votes or special requests to server via Axios
  // ==========================================
  //@ts-ignore
  const handleVoteSubmit = async (voteValue) => {
    try {
      setSubmittingVote(true);
      // POST vote via client.js
      await client.post('/poll/vote', { vote: voteValue });
      setUserVote(voteValue);
      Alert.alert('Vote Recorded', `You voted '${voteValue}' for tomorrow's Sehri.`);
    } catch (error) {
        //@ts-ignore
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit vote.');
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleSpecialCaseSubmit = async () => {
    try {
      setSubmittingVote(true);
      // POST special case request via client.js
      await client.post('/poll/special-case', { requestFood: true });
      setSpecialRequested(true);
      Alert.alert('Request Sent', 'Your special request for Sehri food was sent to the Super Admin.');
    } catch (error) {
        //@ts-ignore
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit special request.');
    } finally {
      setSubmittingVote(false);
    }
  };

  // ==========================================
  // UI RENDER
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      {/* -------------------------------------- */}
      {/* HEADER: Username (Left), Profile (Right) */}
      {/* -------------------------------------- */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.usernameText}>
            {user?.name || user?.username || 'Resident'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/profile')}
          accessibilityLabel="Open Profile"
        >
          <Ionicons name="person-circle-outline" size={38} color="#1E293B" />
        </TouchableOpacity>

        {/* Temporary logout button for testing */}
        <TouchableOpacity
          onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
          style={{ marginLeft: 8, padding: 6 }}
        >
          <Ionicons name="log-out-outline" size={28} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* -------------------------------------- */}
        {/* NAMAZ TIMINGS BANNER (Vertical Order)  */}
        {/* -------------------------------------- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={22} color="#0D9488" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.cardTitle}>Daily Namaz Timings</Text>
              {hijriDate && (
                <Text style={styles.hijriDate}>{hijriDate}</Text>
              )}
            </View>
          </View>

          {loadingTimings ? (
            <ActivityIndicator size="large" color="#0D9488" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.verticalTimingsContainer}>
              {PRAYER_KEYS.map((item, index) => {
                const timeValue = namazTimings ? (namazTimings[item.key] ?? '--:--') : '--:--';
                const isLast = index === PRAYER_KEYS.length - 1;

                return (
                  <View
                    key={item.key}
                    style={[styles.timingRow, !isLast && styles.timingRowBorder]}
                  >
                    <Text style={styles.prayerLabel}>{item.label}</Text>
                    <Text style={styles.prayerTime}>{timeValue}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* -------------------------------------- */}
        {/* DAILY SEHRI POLL SYSTEM CARD           */}
        {/* -------------------------------------- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="restaurant-outline" size={22} color="#0D9488" />
            <Text style={styles.cardTitle}>Daily Sehri Food Poll</Text>
          </View>

          {/* STATE 1: Regular Voting Window (10 PM - 10 AM) */}
          {pollState === 'REGULAR_VOTE' && (
            <View style={styles.pollSection}>
              <Text style={styles.pollQuestion}>Will you be having Sehri food tomorrow?</Text>
              <Text style={styles.windowInfoText}>Voting ends at 10:00 AM</Text>

              {userVote && (
                <View style={styles.currentVoteBadge}>
                  <Text style={styles.currentVoteText}>Current Vote: {userVote}</Text>
                </View>
              )}

              <View style={styles.voteButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.voteButton,
                    styles.yesButton,
                    userVote === 'YES' && styles.selectedButton,
                  ]}
                  onPress={() => handleVoteSubmit('YES')}
                  disabled={submittingVote}
                >
                  <Text style={styles.voteButtonText}>Yes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.voteButton,
                    styles.noButton,
                    userVote === 'NO' && styles.selectedButton,
                  ]}
                  onPress={() => handleVoteSubmit('NO')}
                  disabled={submittingVote}
                >
                  <Text style={styles.voteButtonText}>No</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STATE 2: Special Case Window (5 PM - 6 PM) */}
          {pollState === 'SPECIAL_REQUEST' && (
            <View style={styles.pollSection}>
              <Text style={styles.pollQuestion}>Changed your mind regarding Sehri food?</Text>
              <Text style={styles.windowInfoText}>
                Special Case Window: Super Admin allots food requests between 5:00 PM – 6:00 PM.
              </Text>

              {specialRequested ? (
                <View style={styles.statusBox}>
                  <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                  <Text style={styles.statusBoxText}>Special case request submitted to Super Admin.</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.specialButton}
                  onPress={handleSpecialCaseSubmit}
                  disabled={submittingVote}
                >
                  {submittingVote ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.specialButtonText}>Request Food (Special Case)</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* STATE 3: Voting Window Closed */}
          {pollState === 'CLOSED' && (
            <View style={styles.closedPollContainer}>
              <Ionicons name="lock-closed-outline" size={24} color="#64748B" />
              <Text style={styles.closedPollTitle}>Poll Currently Closed</Text>
              <Text style={styles.closedPollDescription}>
                • Regular Voting: 10:00 PM – 10:00 AM{'\n'}
                • Special Case Window: 5:00 PM – 6:00 PM
              </Text>

              {userVote && (
                <Text style={styles.recordedVoteText}>Your registered vote: {userVote}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  userInfo: {
    flexDirection: 'column',
  },
  welcomeText: {
    fontSize: 13,
    color: '#64748B',
  },
  usernameText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileButton: {
    padding: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 8,
  },
  hijriDate: {
    fontSize: 12,
    color: '#0D9488',
    marginTop: 2,
    marginLeft: 8,
  },

  /* Vertical Timings Styles */
  verticalTimingsContainer: {
    flexDirection: 'column',
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  timingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  prayerLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  prayerTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D9488',
  },

  /* Poll Styles */
  pollSection: {
    alignItems: 'center',
  },
  pollQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  windowInfoText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    textAlign: 'center',
  },
  currentVoteBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  currentVoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  voteButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  voteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: '#16A34A',
  },
  noButton: {
    backgroundColor: '#DC2626',
  },
  selectedButton: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  voteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  specialButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  specialButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  statusBoxText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '500',
  },
  closedPollContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closedPollTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginTop: 6,
  },
  closedPollDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  recordedVoteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D9488',
    marginTop: 10,
  },
});