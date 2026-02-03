import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../theme';
import { RootState, AppDispatch } from '../../store';
import { updateSetting, saveSettings } from '../../store/slices/settingsSlice';
import { logout } from '../../store/slices/authSlice';
import { voiceService, voiceCommandService } from '../../services';
import translationService from '../../services/translationService';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';

type SettingsScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Settings'>;

interface Props {
  navigation: SettingsScreenNavigationProp;
}

const EDU_COLORS = {
  primaryBlue: '#3B82F6',
  deepBlue: '#2563EB',
  softPurple: '#8B5CF6',
  richPurple: '#7C3AED',
  vibrantGreen: '#10B981',
  emeraldGreen: '#059669',
  warmOrange: '#F59E0B',
  sunsetOrange: '#F97316',
  deepSlate: '#0F172A',
  slateGray: '#1E293B',
  cardDark: '#1A1A2E',
  accent: '#06B6D4',
};

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state: RootState) => state.auth);
  const settings = useSelector((state: RootState) => state.settings);

  // Voice command support
  useFocusEffect(
    useCallback(() => {
      voiceCommandService.setContext('settings');
      if (settings.autoAnnounce) {
        voiceService.speak('Settings screen. Customize your app experience.');
      }
    }, [settings.autoAnnounce])
  );

  const handleSettingChange = async (key: string, value: any) => {
    dispatch(updateSetting({ [key]: value }));
    // Save to storage
    if (user?.id) {
      dispatch(saveSettings({ settings: { [key]: value }, userId: user.id }));
    }
    
    // Apply voice settings immediately
    if (key === 'voiceSpeed') {
      await voiceService.updateSettings({ rate: value });
    }
    if (key === 'audioVolume') {
      await voiceService.updateSettings({ volume: value });
    }
    if (key === 'language') {
      const langMap: Record<string, string> = { 
        'English': 'en-US', 
        'Hindi': 'hi-IN', 
        'Spanish': 'es-ES' 
      };
      await voiceService.updateSettings({ language: langMap[value] || 'en-US' });
      
      // Update translation service
      translationService.setLanguage(value);
      
      // Test the new voice
      const testPhrases: Record<string, string> = {
        'English': 'Voice changed to English',
        'Hindi': 'आवाज हिंदी में बदल गई',
        'Spanish': 'Voz cambiada a español'
      };
      setTimeout(() => {
        voiceService.speak(testPhrases[value] || testPhrases['English']);
      }, 300);
    }
  };

  const handleToggleVoiceEnabled = (value: boolean) => {
    // Set the voiceService state first
    voiceService.setVoiceEnabled(value);
    handleSettingChange('voiceEnabled', value);
    if (value) {
      voiceService.speak('Voice assistant enabled');
    }
  };

  const handleToggleAutoAnnounce = (value: boolean) => {
    // Set the voiceService state first
    voiceService.setAutoAnnounce(value);
    handleSettingChange('autoAnnounce', value);
    if (value) {
      voiceService.speak('Auto announcements enabled. Screens will be announced automatically.');
    }
  };

  const handleToggleHapticFeedback = async (value: boolean) => {
    handleSettingChange('hapticFeedback', value);
    if (value) {
      // Test haptic feedback immediately
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      voiceService.speak('Haptic feedback enabled');
    } else {
      voiceService.speak('Haptic feedback disabled');
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    handleSettingChange('notificationsEnabled', value);
    if (settings.hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    voiceService.speak(value ? 'Notifications enabled' : 'Notifications disabled');
  };

  const handleToggleHighContrast = async (value: boolean) => {
    handleSettingChange('highContrastMode', value);
    if (settings.hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    voiceService.speak(value ? 'High contrast mode enabled' : 'High contrast mode disabled');
  };

  const handleToggleLargeText = async (value: boolean) => {
    handleSettingChange('largeText', value);
    if (settings.hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    voiceService.speak(value ? 'Large text enabled' : 'Large text disabled');
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => dispatch(logout()),
      },
    ]);
  };

  const handleChangeLanguage = () => {
    Alert.alert(
      'Select Language',
      'Choose your preferred language',
      [
        { text: 'English', onPress: () => handleSettingChange('language', 'English') },
        { text: 'Hindi', onPress: () => handleSettingChange('language', 'Hindi') },
        { text: 'Spanish', onPress: () => handleSettingChange('language', 'Spanish') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleChangeVoiceSpeed = () => {
    Alert.alert(
      'Voice Speed',
      'Select your preferred voice speed',
      [
        { text: '0.5x (Slow)', onPress: () => handleSettingChange('voiceSpeed', 0.5) },
        { text: '0.75x', onPress: () => handleSettingChange('voiceSpeed', 0.75) },
        { text: '1.0x (Normal)', onPress: () => handleSettingChange('voiceSpeed', 1.0) },
        { text: '1.25x', onPress: () => handleSettingChange('voiceSpeed', 1.25) },
        { text: '1.5x (Fast)', onPress: () => handleSettingChange('voiceSpeed', 1.5) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://brailletutor.app/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://brailletutor.app/terms');
  };

  const handleHelpSupport = () => {
    Alert.alert(
      'Help & Support',
      'How can we help you?',
      [
        { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@brailletutor.app') },
        { text: 'Voice Commands Help', onPress: () => voiceCommandService.readAvailableCommands() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['transparent', EDU_COLORS.deepSlate]}
        style={styles.backgroundGlow}
      >
        {/* Floating Orbs */}
        <View style={styles.floatingOrbs}>
          <View style={[styles.orb, styles.orb1]} />
          <View style={[styles.orb, styles.orb2]} />
        </View>

        {/* Header */}
        <LinearGradient
          colors={[EDU_COLORS.slateGray, EDU_COLORS.deepSlate]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Settings</Text>
              <Text style={styles.subtitle}>Customize your experience</Text>
            </View>
            <Ionicons name="settings-sharp" size={28} color={EDU_COLORS.primaryBlue} />
          </View>
        </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <LinearGradient
          colors={[EDU_COLORS.slateGray + '40', EDU_COLORS.deepSlate + '20']}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.profileCard}>
            <LinearGradient
              colors={[EDU_COLORS.primaryBlue, EDU_COLORS.softPurple]}
              style={styles.profileAvatar}
            >
              <Text style={styles.profileAvatarText}>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </LinearGradient>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'user@example.com'}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Voice & Audio Section */}
        <LinearGradient
          colors={[EDU_COLORS.slateGray + '40', EDU_COLORS.deepSlate + '20']}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Voice & Audio</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="mic" size={20} color={EDU_COLORS.vibrantGreen} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Voice Enabled</Text>
                <Text style={styles.settingDescription}>Enable AI voice tutor</Text>
              </View>
            </View>
            <Switch
              value={settings.voiceEnabled}
              onValueChange={handleToggleVoiceEnabled}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: EDU_COLORS.vibrantGreen }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="megaphone" size={20} color={EDU_COLORS.primaryBlue} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Auto Screen Announcements</Text>
                <Text style={styles.settingDescription}>Announce screens when navigating</Text>
              </View>
            </View>
            <Switch
              value={settings.autoAnnounce}
              onValueChange={handleToggleAutoAnnounce}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: EDU_COLORS.primaryBlue }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity style={styles.settingItem} onPress={handleChangeVoiceSpeed}>
            <View style={styles.settingInfo}>
              <Ionicons name="speedometer" size={20} color={EDU_COLORS.warmOrange} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Voice Speed</Text>
                <Text style={styles.settingDescription}>
                  Current: {settings.voiceSpeed}x
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleChangeLanguage}>
            <View style={styles.settingInfo}>
              <Ionicons name="language" size={20} color={EDU_COLORS.accent} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Language</Text>
                <Text style={styles.settingDescription}>
                  Current: {settings.language}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Accessibility Section */}
        <LinearGradient
          colors={[EDU_COLORS.slateGray + '40', EDU_COLORS.deepSlate + '20']}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Accessibility</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="hand-left" size={20} color={EDU_COLORS.softPurple} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Haptic Feedback</Text>
                <Text style={styles.settingDescription}>Vibrate on interactions</Text>
              </View>
            </View>
            <Switch
              value={settings.hapticFeedback}
              onValueChange={handleToggleHapticFeedback}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: EDU_COLORS.softPurple }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="contrast" size={20} color={EDU_COLORS.warmOrange} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>High Contrast Mode</Text>
                <Text style={styles.settingDescription}>Increase visual contrast</Text>
              </View>
            </View>
            <Switch
              value={settings.highContrastMode}
              onValueChange={handleToggleHighContrast}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: EDU_COLORS.warmOrange }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="text" size={20} color={EDU_COLORS.accent} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Large Text</Text>
                <Text style={styles.settingDescription}>Increase text size</Text>
              </View>
            </View>
            <Switch
              value={settings.largeText}
              onValueChange={handleToggleLargeText}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: EDU_COLORS.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </LinearGradient>

        {/* Notifications Section */}
        <LinearGradient
          colors={[EDU_COLORS.slateGray + '40', EDU_COLORS.deepSlate + '20']}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={20} color={EDU_COLORS.vibrantGreen} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Receive learning reminders</Text>
              </View>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: EDU_COLORS.vibrantGreen }}
              thumbColor="#FFFFFF"
            />
          </View>
        </LinearGradient>

        {/* About Section */}
        <LinearGradient
          colors={[EDU_COLORS.slateGray + '40', EDU_COLORS.deepSlate + '20']}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="information-circle" size={20} color={EDU_COLORS.accent} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Version</Text>
                <Text style={styles.settingDescription}>1.0.0</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handlePrivacyPolicy}>
            <View style={styles.settingInfo}>
              <Ionicons name="shield-checkmark" size={20} color={EDU_COLORS.vibrantGreen} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleTermsOfService}>
            <View style={styles.settingInfo}>
              <Ionicons name="document-text" size={20} color={EDU_COLORS.primaryBlue} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleHelpSupport}>
            <View style={styles.settingInfo}>
              <Ionicons name="help-circle" size={20} color={EDU_COLORS.warmOrange} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.logoutButtonGradient}
          >
            <Ionicons name="log-out" size={20} color="#FFFFFF" />
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  backgroundGlow: {
    flex: 1,
  },
  floatingOrbs: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  orb: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.1,
  },
  orb1: {
    width: 200,
    height: 200,
    backgroundColor: EDU_COLORS.softPurple,
    top: -100,
    right: -50,
  },
  orb2: {
    width: 150,
    height: 150,
    backgroundColor: EDU_COLORS.primaryBlue,
    bottom: 100,
    left: -50,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 120,
  },
  section: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: SPACING.md,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  settingArrow: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  logoutButton: {
    borderRadius: RADIUS.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
