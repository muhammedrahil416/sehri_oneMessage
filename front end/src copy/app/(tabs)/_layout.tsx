import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colorScheme === 'dark' ? '#fff' : '#0D9488',
        headerShown: false,
      }}>
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Track Tab */}
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Donate Tab */}
      <Tabs.Screen
        name="donate"
        options={{
          title: 'Donate',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Dua Tab */}
      <Tabs.Screen
        name="Dua"
        options={{
          title: 'Dua',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Quran Tab */}
      <Tabs.Screen
        name="Quran"
        options={{
          title: 'Quran',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-sharp" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}