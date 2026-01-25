// Notification Service for In-App Notifications
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { voiceService } from './voiceService';

export interface AppNotification {
  id: string;
  type: 'achievement' | 'reminder' | 'streak' | 'tip' | 'update' | 'device' | 'lesson';
  title: string;
  message: string;
  icon?: string;
  read: boolean;
  createdAt: Date;
  data?: Record<string, any>;
}

type NotificationCallback = (notifications: AppNotification[]) => void;

class NotificationService {
  private notifications: AppNotification[] = [];
  private listeners: NotificationCallback[] = [];
  private unreadCount: number = 0;

  // Initialize with default notifications
  async initialize(userId?: string): Promise<void> {
    // Load any saved notifications
    if (userId && isSupabaseConfigured()) {
      await this.loadNotifications(userId);
    }
    
    // Add welcome notification if first time
    if (this.notifications.length === 0) {
      this.addNotification({
        type: 'tip',
        title: 'Welcome to Braille Tutor! 🎉',
        message: 'Start your first lesson to begin learning Braille. Say "Help" anytime for voice assistance.',
        icon: 'sparkles',
      });
    }

    // Check for streak notifications
    this.checkStreakNotifications();
  }

  // Load notifications from database
  private async loadNotifications(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        this.notifications = data.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          icon: n.icon,
          read: n.read,
          createdAt: new Date(n.created_at),
          data: n.data,
        }));
        this.updateUnreadCount();
      }
    } catch (error) {
      console.log('Could not load notifications from database');
    }
  }

  // Add a new notification
  addNotification(notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>): AppNotification {
    const newNotification: AppNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      createdAt: new Date(),
    };

    this.notifications.unshift(newNotification);
    this.updateUnreadCount();
    this.notifyListeners();

    return newNotification;
  }

  // Get all notifications
  getNotifications(): AppNotification[] {
    return [...this.notifications];
  }

  // Get unread count
  getUnreadCount(): number {
    return this.unreadCount;
  }

  // Mark notification as read
  markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.updateUnreadCount();
      this.notifyListeners();
    }
  }

  // Mark all as read
  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.unreadCount = 0;
    this.notifyListeners();
  }

  // Clear all notifications
  clearAll(): void {
    this.notifications = [];
    this.unreadCount = 0;
    this.notifyListeners();
  }

  // Delete a notification
  deleteNotification(notificationId: string): void {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.updateUnreadCount();
    this.notifyListeners();
  }

  // Subscribe to notification changes
  subscribe(callback: NotificationCallback): () => void {
    this.listeners.push(callback);
    callback(this.notifications);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Update unread count
  private updateUnreadCount(): void {
    this.unreadCount = this.notifications.filter(n => !n.read).length;
  }

  // Notify all listeners
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener([...this.notifications]);
    }
  }

  // Check for streak notifications
  private checkStreakNotifications(): void {
    // This would normally check the database for streak data
    // For now, we'll just add sample notifications
    const hour = new Date().getHours();
    
    if (hour >= 9 && hour <= 21) {
      // Reminder during active hours
      const hasReminder = this.notifications.some(
        n => n.type === 'reminder' && 
        (new Date().getTime() - n.createdAt.getTime()) < 12 * 60 * 60 * 1000
      );
      
      if (!hasReminder) {
        this.addNotification({
          type: 'reminder',
          title: 'Continue Learning 📚',
          message: 'Keep your streak going! Practice for 5 minutes today.',
          icon: 'flame',
        });
      }
    }
  }

  // Trigger achievement notification
  notifyAchievement(achievement: { name: string; description: string; icon?: string }): void {
    this.addNotification({
      type: 'achievement',
      title: `Achievement Unlocked! 🏆`,
      message: `${achievement.name}: ${achievement.description}`,
      icon: achievement.icon || 'trophy',
    });
  }

  // Trigger lesson completed notification
  notifyLessonComplete(lessonTitle: string, score: number): void {
    this.addNotification({
      type: 'lesson',
      title: 'Lesson Completed! ⭐',
      message: `You finished "${lessonTitle}" with ${score}% score.`,
      icon: 'checkmark-circle',
      data: { lessonTitle, score },
    });
  }

  // Trigger streak notification
  notifyStreak(streakDays: number): void {
    this.addNotification({
      type: 'streak',
      title: `${streakDays} Day Streak! 🔥`,
      message: `Amazing! You've been learning for ${streakDays} days in a row.`,
      icon: 'flame',
      data: { streakDays },
    });
  }

  // Trigger device notification
  notifyDeviceStatus(connected: boolean, deviceName?: string): void {
    this.addNotification({
      type: 'device',
      title: connected ? 'Device Connected 📱' : 'Device Disconnected',
      message: connected 
        ? `${deviceName || 'Braille Device'} is now connected and ready.`
        : 'Your Braille device has been disconnected.',
      icon: connected ? 'bluetooth' : 'bluetooth-outline',
    });
  }

  // Trigger daily tip
  notifyDailyTip(): void {
    const tips = [
      'Try tracing Braille patterns with your finger to build muscle memory.',
      'Practice reading Braille for 10 minutes daily for best results.',
      'Use the voice commands to navigate the app hands-free.',
      'Connect your Braille device for tactile learning practice.',
      'Review completed lessons to reinforce your learning.',
      'The AI tutor is always ready to answer your Braille questions.',
    ];
    
    const tip = tips[Math.floor(Math.random() * tips.length)];
    
    this.addNotification({
      type: 'tip',
      title: '💡 Daily Tip',
      message: tip,
      icon: 'bulb',
    });
  }

  // Read notifications aloud (accessibility)
  async readNotificationsAloud(): Promise<void> {
    const unread = this.notifications.filter(n => !n.read);
    
    if (unread.length === 0) {
      await voiceService.speak('You have no new notifications.');
      return;
    }

    await voiceService.speak(`You have ${unread.length} unread notification${unread.length > 1 ? 's' : ''}.`);
    
    for (const notification of unread.slice(0, 3)) {
      await voiceService.speak(`${notification.title}. ${notification.message}`);
    }

    if (unread.length > 3) {
      await voiceService.speak(`And ${unread.length - 3} more.`);
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
