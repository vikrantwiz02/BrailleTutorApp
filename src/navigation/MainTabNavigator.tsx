import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Screens
import { HomeScreen } from '../screens/Home/HomeScreen';
import { LessonsScreen } from '../screens/Lessons/LessonsScreen';
import { DeviceScreen } from '../screens/Device/DeviceScreen';
import { ProgressScreen } from '../screens/Progress/ProgressScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';

import { COLORS, SPACING, RADIUS } from '../theme';

export type MainTabParamList = {
  Home: undefined;
  Lessons: undefined;
  Device: undefined;
  Progress: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: SPACING.md,
          right: SPACING.md,
          elevation: 0,
          backgroundColor: COLORS.background.card,
          borderTopWidth: 0,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          borderRadius: RADIUS.xl,
          marginBottom: insets.bottom > 0 ? SPACING.sm : SPACING.md,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarActiveTintColor: COLORS.primary.main,
        tabBarInactiveTintColor: COLORS.text.tertiary,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
          marginBottom: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Lessons':
              iconName = focused ? 'book' : 'book-outline';
              break;
            case 'Device':
              iconName = focused ? 'hardware-chip' : 'hardware-chip-outline';
              break;
            case 'Progress':
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'help-circle-outline';
          }

          return (
            <View style={[
              styles.iconContainer,
              focused && styles.activeIconContainer
            ]}>
              <Ionicons name={iconName} size={24} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="Lessons" 
        component={LessonsScreen}
        options={{ tabBarLabel: 'Lessons' }}
      />
      <Tab.Screen 
        name="Device" 
        component={DeviceScreen}
        options={{ tabBarLabel: 'Device' }}
      />
      <Tab.Screen 
        name="Progress" 
        component={ProgressScreen}
        options={{ tabBarLabel: 'Progress' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  activeIconContainer: {
    backgroundColor: `${COLORS.primary.main}15`,
    borderRadius: RADIUS.md,
  },
});

export default MainTabNavigator;
