// Offline Support Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import type { OfflineAction } from '../types/database';

const STORAGE_KEYS = {
  OFFLINE_QUEUE: '@braille_tutor:offline_queue',
  CACHED_LESSONS: '@braille_tutor:cached_lessons',
  CACHED_PROGRESS: '@braille_tutor:cached_progress',
  LAST_SYNC: '@braille_tutor:last_sync',
};

export interface OfflineQueueItem {
  id: string;
  action: string;
  table: string;
  data: any;
  createdAt: string;
  retryCount: number;
}

type NetworkCallback = (isConnected: boolean) => void;

class OfflineSyncService {
  private isOnline: boolean = true;
  private networkListeners: NetworkCallback[] = [];
  private syncInProgress: boolean = false;
  private unsubscribeNetInfo: (() => void) | null = null;

  // Initialize network monitoring
  async initialize(): Promise<void> {
    // Check initial network state
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected === true && state.isInternetReachable !== false;

    // Subscribe to network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(this.handleNetworkChange.bind(this));
  }

  // Cleanup
  cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.networkListeners = [];
  }

  // Handle network state changes
  private handleNetworkChange(state: NetInfoState): void {
    const wasOnline = this.isOnline;
    this.isOnline = state.isConnected === true && state.isInternetReachable !== false;

    // Notify listeners
    for (const callback of this.networkListeners) {
      try {
        callback(this.isOnline);
      } catch (err) {
        console.error('Network listener error:', err);
      }
    }

    // Sync when coming back online
    if (!wasOnline && this.isOnline) {
      this.syncOfflineQueue();
    }
  }

  // Add network state listener
  addNetworkListener(callback: NetworkCallback): () => void {
    this.networkListeners.push(callback);
    return () => {
      this.networkListeners = this.networkListeners.filter(cb => cb !== callback);
    };
  }

  // Check if online
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  // Queue an action for later sync
  async queueAction(action: string, table: string, data: any): Promise<void> {
    console.log('[OfflineSyncService] Queueing action:', { action, table });
    const item: OfflineQueueItem = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      table,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const queue = await this.getOfflineQueue();
    queue.push(item);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    console.log('[OfflineSyncService] Action queued, total items:', queue.length);
  }

  // Get offline queue
  async getOfflineQueue(): Promise<OfflineQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Sync offline queue with server
  async syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
    if (!this.isOnline || !isSupabaseConfigured() || this.syncInProgress) {
      return { synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let synced = 0;
    let failed = 0;

    try {
      const queue = await this.getOfflineQueue();
      const remainingItems: OfflineQueueItem[] = [];

      for (const item of queue) {
        try {
          const success = await this.processQueueItem(item);
          if (success) {
            synced++;
          } else {
            item.retryCount++;
            if (item.retryCount < 5) {
              remainingItems.push(item);
            }
            failed++;
          }
        } catch {
          item.retryCount++;
          if (item.retryCount < 5) {
            remainingItems.push(item);
          }
          failed++;
        }
      }

      // Update queue with remaining items
      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_QUEUE,
        JSON.stringify(remainingItems)
      );

      // Update last sync time
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_SYNC,
        new Date().toISOString()
      );
    } finally {
      this.syncInProgress = false;
    }

    return { synced, failed };
  }

  // Process a single queue item
  private async processQueueItem(item: OfflineQueueItem): Promise<boolean> {
    console.log('[OfflineSyncService] Processing queue item:', { action: item.action, table: item.table });
    // Use type assertion for dynamic table access
    const table = supabase.from(item.table as any);
    
    switch (item.action) {
      case 'insert':
        const { error: insertError } = await table.insert(item.data as any);
        if (insertError) console.error('[OfflineSyncService] Insert error:', insertError);
        return !insertError;

      case 'update':
        const { error: updateError } = await table
          .update(item.data.updates as any)
          .match(item.data.match);
        if (updateError) console.error('[OfflineSyncService] Update error:', updateError);
        return !updateError;

      case 'upsert':
        const { error: upsertError } = await table
          .upsert(item.data as any);
        if (upsertError) console.error('[OfflineSyncService] Upsert error:', upsertError);
        return !upsertError;

      case 'delete':
        const { error: deleteError } = await table
          .delete()
          .match(item.data.match);
        if (deleteError) console.error('[OfflineSyncService] Delete error:', deleteError);
        return !deleteError;

      default:
        console.warn('[OfflineSyncService] Unknown action:', item.action);
        return false;
    }
  }

  // Cache lessons for offline use
  async cacheLessons(lessons: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_LESSONS,
        JSON.stringify(lessons)
      );
    } catch (err) {
      console.error('Failed to cache lessons:', err);
    }
  }

  // Get cached lessons
  async getCachedLessons(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_LESSONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Cache user progress for offline use
  async cacheProgress(userId: string, progress: any): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.CACHED_PROGRESS}:${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(progress));
    } catch (err) {
      console.error('Failed to cache progress:', err);
    }
  }

  // Get cached progress
  async getCachedProgress(userId: string): Promise<any | null> {
    try {
      const key = `${STORAGE_KEYS.CACHED_PROGRESS}:${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  // Get last sync time
  async getLastSyncTime(): Promise<Date | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return data ? new Date(data) : null;
    } catch {
      return null;
    }
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  }

  // Get cache size
  async getCacheSize(): Promise<number> {
    try {
      let totalSize = 0;
      for (const key of Object.values(STORAGE_KEYS)) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }
      return totalSize;
    } catch {
      return 0;
    }
  }

  // Save offline action to database for recovery
  async saveOfflineActionToDb(userId: string, item: OfflineQueueItem): Promise<void> {
    if (!isSupabaseConfigured()) return;

    try {
      await supabase.from('offline_queue').insert({
        user_id: userId,
        action_type: item.action,
        payload: item.data,
        synced: false,
      });
    } catch (err) {
      console.error('Failed to save offline action:', err);
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
export default offlineSyncService;
