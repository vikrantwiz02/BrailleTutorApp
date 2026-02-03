// Notifications Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { notificationService, voiceService, type AppNotification } from '../../services';

type NotificationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notifications'>;

interface Props {
  navigation: NotificationsScreenNavigationProp;
}

const EDU_COLORS = {
  primaryBlue: '#3B82F6',
  softPurple: '#8B5CF6',
  vibrantGreen: '#10B981',
  warmOrange: '#F59E0B',
  deepSlate: '#0F172A',
  slateGray: '#1E293B',
  cardDark: '#1A1A2E',
};

const getNotificationIcon = (type: string): { name: string; color: string } => {
  switch (type) {
    case 'achievement':
      return { name: 'trophy', color: EDU_COLORS.warmOrange };
    case 'streak':
      return { name: 'flame', color: '#EF4444' };
    case 'lesson':
      return { name: 'checkmark-circle', color: EDU_COLORS.vibrantGreen };
    case 'reminder':
      return { name: 'time', color: EDU_COLORS.primaryBlue };
    case 'tip':
      return { name: 'bulb', color: EDU_COLORS.warmOrange };
    case 'device':
      return { name: 'bluetooth', color: EDU_COLORS.softPurple };
    case 'update':
      return { name: 'download', color: EDU_COLORS.primaryBlue };
    default:
      return { name: 'notifications', color: EDU_COLORS.primaryBlue };
  }
};

const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {  const insets = useSafeAreaInsets();  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // Subscribe to notifications
    const unsubscribe = notificationService.subscribe(setNotifications);

    // Animate in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Announce for accessibility
    voiceService.speak(`Notifications screen. You have ${notificationService.getUnreadCount()} unread notifications.`);

    return unsubscribe;
  }, []);

  const handleNotificationPress = (notification: AppNotification) => {
    notificationService.markAsRead(notification.id);
    
    // Speak the notification
    voiceService.speak(`${notification.title}. ${notification.message}`);
  };

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead();
    voiceService.speak('All notifications marked as read.');
  };

  const handleClearAll = () => {
    notificationService.clearAll();
    voiceService.speak('All notifications cleared.');
  };

  const handleReadAloud = () => {
    notificationService.readNotificationsAloud();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[EDU_COLORS.deepSlate, EDU_COLORS.slateGray]}
        style={styles.background}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity 
            onPress={handleReadAloud} 
            style={styles.speakButton}
            accessibilityLabel="Read notifications aloud"
          >
            <Ionicons name="volume-high" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Text style={styles.unreadText}>
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notifications List */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={64} color="#444" />
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySubtext}>
                  You'll see updates about your progress, achievements, and more here.
                </Text>
              </View>
            ) : (
              notifications.map((notification) => {
                const icon = getNotificationIcon(notification.type);
                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationCard,
                      !notification.read && styles.unreadCard,
                    ]}
                    onPress={() => handleNotificationPress(notification)}
                    accessibilityLabel={`${notification.title}. ${notification.message}`}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
                      <Ionicons name={icon.name as any} size={24} color={icon.color} />
                    </View>
                    <View style={styles.notificationContent}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        {!notification.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                      <Text style={styles.notificationTime}>{formatTime(notification.createdAt)}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => notificationService.deleteNotification(notification.id)}
                      accessibilityLabel="Delete notification"
                    >
                      <Ionicons name="close" size={18} color="#666" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}

            {notifications.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
                <Ionicons name="trash-outline" size={18} color="#888" />
                <Text style={styles.clearText}>Clear All Notifications</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  speakButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  unreadBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: EDU_COLORS.primaryBlue + '20',
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  unreadText: {
    fontSize: 14,
    color: EDU_COLORS.primaryBlue,
    fontWeight: '600',
  },
  markAllText: {
    fontSize: 14,
    color: EDU_COLORS.primaryBlue,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: EDU_COLORS.cardDark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: EDU_COLORS.primaryBlue,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EDU_COLORS.primaryBlue,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    padding: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  clearText: {
    fontSize: 14,
    color: '#888',
  },
});

export default NotificationsScreen;
