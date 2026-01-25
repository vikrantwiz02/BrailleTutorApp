import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { RootState, AppDispatch } from '../../store';
import {
  scanForDevices,
  connectToDevice,
  disconnectDevice,
  initializeBLE,
  printBrailleText,
  clearError,
} from '../../store/slices/deviceSlice';
import { brailleService, voiceCommandService, voiceService } from '../../services';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';

type DeviceScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Device'>;

interface Props {
  navigation: DeviceScreenNavigationProp;
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

export const DeviceScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    connected,
    deviceInfo,
    availableDevices,
    scanning,
    connecting,
    currentJob,
    status,
    error,
  } = useSelector((state: RootState) => state.device);

  const [connectionHealth, setConnectionHealth] = useState<'good' | 'warning' | 'error'>('good');
  const [textToPrint, setTextToPrint] = useState('');
  const [braillePreview, setBraillePreview] = useState('');

  // Initialize BLE on mount
  useEffect(() => {
    dispatch(initializeBLE());
  }, [dispatch]);

  // Voice command support for device screen
  useFocusEffect(
    useCallback(() => {
      voiceCommandService.setContext('device');
      const statusMsg = connected 
        ? `Device connected. ${deviceInfo?.name || 'Braille device'} is ready.`
        : 'No device connected. Say connect to scan for devices.';
      voiceService.speak(`Device screen. ${statusMsg}`);
      
      voiceCommandService.setHandlers({
        onDeviceAction: (action) => {
          switch (action) {
            case 'connect':
            case 'scan':
              dispatch(scanForDevices(10000));
              voiceService.speak('Scanning for devices');
              break;
            case 'disconnect':
              if (connected) {
                dispatch(disconnectDevice());
                voiceService.speak('Device disconnected');
              }
              break;
            case 'status':
              const status = connected 
                ? `Connected to ${deviceInfo?.name}. Battery at ${deviceInfo?.batteryLevel || 'unknown'} percent.`
                : 'No device connected.';
              voiceService.speak(status);
              break;
          }
        },
      });
    }, [connected, deviceInfo])
  );

  // Update connection health based on status
  useEffect(() => {
    if (!connected) {
      setConnectionHealth('error');
    } else if (status?.errorCode) {
      setConnectionHealth('warning');
    } else {
      setConnectionHealth('good');
    }
  }, [connected, status]);

  // Update Braille preview when text changes
  useEffect(() => {
    if (textToPrint) {
      const translation = brailleService.textToBraille(textToPrint);
      setBraillePreview(translation.brailleUnicode);
    } else {
      setBraillePreview('');
    }
  }, [textToPrint]);

  // Show error alerts
  useEffect(() => {
    if (error) {
      Alert.alert('Device Error', error, [
        { text: 'OK', onPress: () => dispatch(clearError()) }
      ]);
    }
  }, [error, dispatch]);

  const handleScan = () => {
    dispatch(scanForDevices(10000));
  };

  const handleConnect = (deviceId: string) => {
    dispatch(connectToDevice(deviceId));
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Device?', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => dispatch(disconnectDevice()) },
    ]);
  };

  const handlePrint = () => {
    if (textToPrint.trim()) {
      dispatch(printBrailleText(textToPrint));
    } else {
      Alert.alert('No Text', 'Please enter text to print');
    }
  };

  const getHealthColor = () => {
    switch (connectionHealth) {
      case 'good':
        return COLORS.success.main;
      case 'warning':
        return COLORS.warning.main;
      case 'error':
        return COLORS.error.main;
    }
  };

  const getHealthIcon = () => {
    switch (connectionHealth) {
      case 'good':
        return '🟢';
      case 'warning':
        return '🟡';
      case 'error':
        return '🔴';
    }
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
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Device Manager</Text>
              <Text style={styles.subtitle}>
                {connected ? 'Device connected' : 'Pair your Braille device'}
              </Text>
            </View>
            <Ionicons 
              name={connected ? "bluetooth" : "bluetooth-outline"} 
              size={28} 
              color={connected ? EDU_COLORS.vibrantGreen : EDU_COLORS.primaryBlue} 
            />
          </View>
        </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Connected Device Card */}
        {connected && deviceInfo ? (
          <>
          <LinearGradient
            colors={[EDU_COLORS.slateGray + '40', EDU_COLORS.deepSlate + '20']}
            style={styles.connectedCard}
          >
            <View style={styles.deviceHeader}>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{deviceInfo.name}</Text>
                <Text style={styles.deviceId}>{deviceInfo.id}</Text>
              </View>
              <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectButton}>
                <Ionicons name="close-circle" size={24} color={EDU_COLORS.warmOrange} />
              </TouchableOpacity>
            </View>

            {/* Connection Health */}
            <View style={styles.healthContainer}>
              <Text style={styles.healthLabel}>Connection Health</Text>
              <View style={styles.healthIndicator}>
                <Ionicons 
                  name={connectionHealth === 'good' ? 'radio-button-on' : connectionHealth === 'warning' ? 'warning' : 'close-circle'} 
                  size={20} 
                  color={connectionHealth === 'good' ? EDU_COLORS.vibrantGreen : connectionHealth === 'warning' ? EDU_COLORS.warmOrange : '#EF4444'} 
                />
                <Text style={[styles.healthText, { 
                  color: connectionHealth === 'good' ? EDU_COLORS.vibrantGreen : connectionHealth === 'warning' ? EDU_COLORS.warmOrange : '#EF4444' 
                }]}>
                  {connectionHealth === 'good'
                    ? 'Excellent'
                    : connectionHealth === 'warning'
                    ? 'Weak Signal'
                    : 'Disconnected'}
                </Text>
              </View>
            </View>

            {/* Device Status */}
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusValue}>{status}</Text>
            </View>

            {/* Print Job Progress */}
            {currentJob && (
              <View style={styles.printJobCard}>
                <Text style={styles.printJobTitle}>Current Print Job</Text>
                
                <View style={styles.progressContainer}>
                  <View style={styles.progressInfo}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressPercentage}>
                      {currentJob.progress.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${currentJob.progress}%` },
                      ]}
                    >
                      <LinearGradient
                        colors={[EDU_COLORS.primaryBlue, EDU_COLORS.softPurple]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.progressGradient}
                      />
                    </View>
                  </View>
                  <Text style={styles.progressDetails}>
                    {currentJob.dotsCompleted} / {currentJob.totalDots} dots
                  </Text>
                </View>

                {currentJob.currentPosition && (
                  <View style={styles.positionContainer}>
                    <Text style={styles.positionLabel}>Current Position</Text>
                    <Text style={styles.positionValue}>
                      X: {currentJob.currentPosition.x}, Y:{' '}
                      {currentJob.currentPosition.y}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </LinearGradient>

          {/* Device Statistics Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statRow}>
              <LinearGradient
                colors={[EDU_COLORS.primaryBlue + '30', EDU_COLORS.primaryBlue + '10']}
                style={styles.statCard}
              >
                <Ionicons name="time" size={24} color={EDU_COLORS.primaryBlue} />
                <Text style={styles.statValue}>2.5h</Text>
                <Text style={styles.statLabel}>Session Time</Text>
              </LinearGradient>

              <LinearGradient
                colors={[EDU_COLORS.vibrantGreen + '30', EDU_COLORS.vibrantGreen + '10']}
                style={styles.statCard}
              >
                <Ionicons name="battery-full" size={24} color={EDU_COLORS.vibrantGreen} />
                <Text style={styles.statValue}>87%</Text>
                <Text style={styles.statLabel}>Battery</Text>
              </LinearGradient>
            </View>

            <View style={styles.statRow}>
              <LinearGradient
                colors={[EDU_COLORS.softPurple + '30', EDU_COLORS.softPurple + '10']}
                style={styles.statCard}
              >
                <Ionicons name="hardware-chip" size={24} color={EDU_COLORS.softPurple} />
                <Text style={styles.statValue}>v2.1.4</Text>
                <Text style={styles.statLabel}>Firmware</Text>
              </LinearGradient>

              <LinearGradient
                colors={[EDU_COLORS.warmOrange + '30', EDU_COLORS.warmOrange + '10']}
                style={styles.statCard}
              >
                <Ionicons name="pulse" size={24} color={EDU_COLORS.warmOrange} />
                <Text style={styles.statValue}>Good</Text>
                <Text style={styles.statLabel}>Performance</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Device Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
                <LinearGradient
                  colors={[EDU_COLORS.primaryBlue + '20', EDU_COLORS.primaryBlue + '08']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="settings-outline" size={28} color={EDU_COLORS.primaryBlue} />
                  <Text style={styles.actionTitle}>Calibrate</Text>
                  <Text style={styles.actionSubtitle}>Adjust pins</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
                <LinearGradient
                  colors={[EDU_COLORS.vibrantGreen + '20', EDU_COLORS.vibrantGreen + '08']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="medical" size={28} color={EDU_COLORS.vibrantGreen} />
                  <Text style={styles.actionTitle}>Diagnostics</Text>
                  <Text style={styles.actionSubtitle}>Run test</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
                <LinearGradient
                  colors={[EDU_COLORS.softPurple + '20', EDU_COLORS.softPurple + '08']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="cloud-download-outline" size={28} color={EDU_COLORS.softPurple} />
                  <Text style={styles.actionTitle}>Update</Text>
                  <Text style={styles.actionSubtitle}>Firmware</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
                <LinearGradient
                  colors={[EDU_COLORS.warmOrange + '20', EDU_COLORS.warmOrange + '08']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="document-text-outline" size={28} color={EDU_COLORS.warmOrange} />
                  <Text style={styles.actionTitle}>Logs</Text>
                  <Text style={styles.actionSubtitle}>View history</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Connection History */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={20} color={EDU_COLORS.accent} />
              <Text style={styles.sectionTitle}>Recent Connections</Text>
            </View>
            <View style={styles.historyCard}>
              <View style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle}>Session completed</Text>
                  <Text style={styles.historyTime}>Today, 4:30 PM • 45 min</Text>
                </View>
              </View>
              <View style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle}>Device connected</Text>
                  <Text style={styles.historyTime}>Today, 3:45 PM</Text>
                </View>
              </View>
              <View style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle}>Firmware updated to v2.1.4</Text>
                  <Text style={styles.historyTime}>Yesterday, 2:15 PM</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Device Health Report */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="analytics-outline" size={20} color={EDU_COLORS.vibrantGreen} />
              <Text style={styles.sectionTitle}>Device Health</Text>
            </View>
            <LinearGradient
              colors={[EDU_COLORS.vibrantGreen + '15', EDU_COLORS.vibrantGreen + '05']}
              style={styles.healthReport}
            >
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricLabel}>Pin Response</Text>
                <View style={styles.healthBar}>
                  <View style={[styles.healthBarFill, { width: '95%', backgroundColor: EDU_COLORS.vibrantGreen }]} />
                </View>
                <Text style={styles.healthMetricValue}>95%</Text>
              </View>
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricLabel}>Connection Stability</Text>
                <View style={styles.healthBar}>
                  <View style={[styles.healthBarFill, { width: '88%', backgroundColor: EDU_COLORS.vibrantGreen }]} />
                </View>
                <Text style={styles.healthMetricValue}>88%</Text>
              </View>
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricLabel}>Response Time</Text>
                <View style={styles.healthBar}>
                  <View style={[styles.healthBarFill, { width: '92%', backgroundColor: EDU_COLORS.vibrantGreen }]} />
                </View>
                <Text style={styles.healthMetricValue}>92%</Text>
              </View>
            </LinearGradient>
          </View>
          </>
        ) : (
          /* Scan for Devices */
          <View style={styles.scanSection}>
            {/* Device Setup Guide */}
            <View style={[styles.section, { marginTop: SPACING.lg }]}>
              <Text style={[styles.sectionTitle, { marginBottom: SPACING.md }]}>Getting Started</Text>
              <View style={styles.setupGrid}>
                <View style={styles.setupStep}>
                  <LinearGradient
                    colors={[EDU_COLORS.primaryBlue + '30', EDU_COLORS.primaryBlue + '10']}
                    style={styles.setupStepGradient}
                  >
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Ionicons name="power" size={28} color={EDU_COLORS.primaryBlue} />
                    <Text style={styles.setupStepTitle}>Power On</Text>
                    <Text style={styles.setupStepText}>Turn on device</Text>
                  </LinearGradient>
                </View>

                <View style={styles.setupStep}>
                  <LinearGradient
                    colors={[EDU_COLORS.vibrantGreen + '30', EDU_COLORS.vibrantGreen + '10']}
                    style={styles.setupStepGradient}
                  >
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Ionicons name="bluetooth" size={28} color={EDU_COLORS.vibrantGreen} />
                    <Text style={styles.setupStepTitle}>Bluetooth</Text>
                    <Text style={styles.setupStepText}>Enable on phone</Text>
                  </LinearGradient>
                </View>

                <View style={styles.setupStep}>
                  <LinearGradient
                    colors={[EDU_COLORS.softPurple + '30', EDU_COLORS.softPurple + '10']}
                    style={styles.setupStepGradient}
                  >
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Ionicons name="search" size={28} color={EDU_COLORS.softPurple} />
                    <Text style={styles.setupStepTitle}>Scan</Text>
                    <Text style={styles.setupStepText}>Find your device</Text>
                  </LinearGradient>
                </View>

                <View style={styles.setupStep}>
                  <LinearGradient
                    colors={[EDU_COLORS.warmOrange + '30', EDU_COLORS.warmOrange + '10']}
                    style={styles.setupStepGradient}
                  >
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>4</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={28} color={EDU_COLORS.warmOrange} />
                    <Text style={styles.setupStepTitle}>Connect</Text>
                    <Text style={styles.setupStepText}>Start learning!</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.scanButton, scanning && styles.scanButtonActive]}
              onPress={handleScan}
            >
              <LinearGradient
                colors={scanning ? [EDU_COLORS.deepBlue, EDU_COLORS.richPurple] : [EDU_COLORS.primaryBlue, EDU_COLORS.softPurple]}
                style={styles.scanButtonGradient}
              >
              {scanning ? (
                <>
                  <ActivityIndicator color="#FFFFFF" style={styles.scanIcon} />
                  <Text style={styles.scanButtonText}>Scanning...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="search" size={24} color="#FFFFFF" style={styles.scanIcon} />
                  <Text style={styles.scanButtonText}>Scan for Devices</Text>
                </>
              )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Available Devices List */}
            {availableDevices.length > 0 && (
              <View style={styles.devicesContainer}>
                <Text style={styles.devicesTitle}>Available Devices</Text>
                {availableDevices.map((device: any) => (
                  <TouchableOpacity
                    key={device.id}
                    style={styles.deviceItem}
                    onPress={() => handleConnect(device.id)}
                  >
                    <LinearGradient
                      colors={[EDU_COLORS.slateGray + '40', EDU_COLORS.deepSlate + '20']}
                      style={styles.deviceItemGradient}
                    >
                    <View style={styles.deviceItemInfo}>
                      <Text style={styles.deviceItemName}>{device.name}</Text>
                      <Text style={styles.deviceItemId}>{device.id}</Text>
                    </View>
                    {device.rssi && (
                      <View style={styles.rssiContainer}>
                        <Ionicons name="cellular" size={16} color={EDU_COLORS.accent} />
                        <Text style={styles.deviceItemRssi}> {device.rssi} dBm</Text>
                      </View>
                    )}
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Device Compatibility */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="shield-checkmark" size={20} color={EDU_COLORS.vibrantGreen} />
                <Text style={styles.sectionTitle}>Compatible Devices</Text>
              </View>
              <View style={styles.compatibilityGrid}>
                <LinearGradient
                  colors={[EDU_COLORS.primaryBlue + '20', EDU_COLORS.primaryBlue + '08']}
                  style={styles.compatibilityCard}
                >
                  <Ionicons name="hardware-chip" size={24} color={EDU_COLORS.primaryBlue} />
                  <Text style={styles.compatibilityTitle}>BrailleTutor Pro</Text>
                  <Text style={styles.compatibilitySubtitle}>Full featured</Text>
                </LinearGradient>

                <LinearGradient
                  colors={[EDU_COLORS.vibrantGreen + '20', EDU_COLORS.vibrantGreen + '08']}
                  style={styles.compatibilityCard}
                >
                  <Ionicons name="cube" size={24} color={EDU_COLORS.vibrantGreen} />
                  <Text style={styles.compatibilityTitle}>BrailleTutor Mini</Text>
                  <Text style={styles.compatibilitySubtitle}>Compact model</Text>
                </LinearGradient>

                <LinearGradient
                  colors={[EDU_COLORS.softPurple + '20', EDU_COLORS.softPurple + '08']}
                  style={styles.compatibilityCard}
                >
                  <Ionicons name="grid" size={24} color={EDU_COLORS.softPurple} />
                  <Text style={styles.compatibilityTitle}>Standard Displays</Text>
                  <Text style={styles.compatibilitySubtitle}>Generic support</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Help Section */}
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.1)', 'rgba(59, 130, 246, 0.1)']}
              style={styles.helpCard}
            >
              <Ionicons name="bulb" size={28} color={EDU_COLORS.warmOrange} style={styles.helpIcon} />
              <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>Connection Tips</Text>
                <Text style={styles.helpText}>
                  • Make sure your device is powered on{'\n'}
                  • Keep the device within 10 meters{'\n'}
                  • Enable Bluetooth on your phone{'\n'}
                  • Restart the device if it doesn't appear
                </Text>
              </View>
            </LinearGradient>

            {/* Quick Stats Preview */}
            <View style={[styles.section, { marginTop: SPACING.lg, paddingBottom: SPACING.xl }]}>
              <Text style={[styles.sectionTitle, { marginBottom: SPACING.md }]}>Why Connect a Device?</Text>
              <View style={styles.benefitsGrid}>
                <View style={styles.benefitItem}>
                  <Ionicons name="hand-left" size={20} color={EDU_COLORS.vibrantGreen} />
                  <Text style={styles.benefitText}>Tactile learning experience</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="trending-up" size={20} color={EDU_COLORS.primaryBlue} />
                  <Text style={styles.benefitText}>Track your progress</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="sync" size={20} color={EDU_COLORS.softPurple} />
                  <Text style={styles.benefitText}>Real-time feedback</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="trophy" size={20} color={EDU_COLORS.warmOrange} />
                  <Text style={styles.benefitText}>Achieve mastery faster</Text>
                </View>
              </View>
            </View>
          </View>
        )}
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
    backgroundColor: EDU_COLORS.primaryBlue,
    top: -100,
    right: -50,
  },
  orb2: {
    width: 150,
    height: 150,
    backgroundColor: EDU_COLORS.vibrantGreen,
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
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  connectedCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  deviceId: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  disconnectButton: {
    padding: SPACING.xs,
  },
  disconnectText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  healthContainer: {
    marginBottom: SPACING.lg,
  },
  healthLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: SPACING.xs,
  },
  healthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  healthIcon: {
    marginRight: SPACING.sm,
  },
  healthText: {
    fontSize: 16,
    fontWeight: '600',
  },
  rssiText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  rssiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  statusLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  printJobCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  printJobTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: SPACING.md,
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: EDU_COLORS.primaryBlue,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: '100%',
  },
  progressGradient: {
    flex: 1,
  },
  progressDetails: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  positionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  positionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  positionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  etaText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  scanSection: {},
  scanButton: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    marginTop: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  scanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  scanButtonActive: {
    opacity: 0.8,
  },
  scanIcon: {
    marginRight: SPACING.sm,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  devicesContainer: {
    marginBottom: SPACING.lg,
  },
  devicesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.md,
  },
  deviceItem: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  deviceItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  deviceItemInfo: {
    flex: 1,
  },
  deviceItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  deviceItemId: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  deviceItemRssi: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  helpCard: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  helpIcon: {
    marginRight: SPACING.sm,
  },
  helpContent: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  helpText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
  },
  statsGrid: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: SPACING.sm,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: SPACING.xs,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionCard: {
    width: '48%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionGradient: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: SPACING.sm,
  },
  actionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: SPACING.xs,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EDU_COLORS.accent,
    marginTop: 6,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  historyTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  healthReport: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  healthMetric: {
    marginBottom: SPACING.md,
  },
  healthMetricLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: SPACING.xs,
  },
  healthBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  healthBarFill: {
    height: '100%',
  },
  healthMetricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: EDU_COLORS.vibrantGreen,
  },
  setupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.md,
  },
  setupStep: {
    width: '48%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  setupStepGradient: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.md,
  },
  stepNumber: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  setupStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  setupStepText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
    textAlign: 'center',
  },
  compatibilityGrid: {
    gap: SPACING.md,
  },
  compatibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: SPACING.sm,
  },
  compatibilityTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compatibilitySubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  benefitsGrid: {
    gap: SPACING.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
});
