// BLE Device Service for Braille Printer Communication
import { Platform, PermissionsAndroid } from 'react-native';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { CONFIG } from '../config';
import type { DevicePairing } from '../types/database';

// BLE Manager import (will be lazy loaded)
let BleManager: any = null;
let isBLEAvailable = false;

export interface BrailleDevice {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
  batteryLevel?: number;
  firmwareVersion?: string;
}

export interface DeviceStatus {
  connected: boolean;
  batteryLevel: number;
  paperLoaded: boolean;
  errorCode: number | null;
  errorMessage: string | null;
}

export interface PrintJob {
  id: string;
  text: string;
  brailleData: number[][];
  status: 'queued' | 'printing' | 'completed' | 'error';
  progress: number;
  createdAt: Date;
}

type DeviceEventCallback = (event: string, data: any) => void;

class BLEDeviceService {
  private isInitialized: boolean = false;
  private _connectedDevice: BrailleDevice | null = null;
  private scanTimeout: NodeJS.Timeout | null = null;
  private eventListeners: DeviceEventCallback[] = [];
  private printQueue: PrintJob[] = [];

  // Getter for connected device
  get connectedDevice(): BrailleDevice | null {
    return this._connectedDevice;
  }

  // Check if BLE is available on this device
  isBLESupported(): boolean {
    return isBLEAvailable;
  }

  // Initialize BLE Manager
  async initialize(): Promise<{ success: boolean; error: string | null }> {
    if (this.isInitialized) {
      return { success: true, error: null };
    }

    try {
      // Check if we're running in a proper React Native environment
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        console.log('BLE not supported on this platform');
        isBLEAvailable = false;
        return { success: false, error: 'BLE only supported on Android and iOS devices' };
      }

      // Dynamically import BLE Manager
      const BleModule = await import('react-native-ble-manager');
      BleManager = BleModule.default;

      // Check if BleManager module loaded properly
      if (!BleManager) {
        console.log('BLE Manager module is null - native module not linked');
        isBLEAvailable = false;
        return { 
          success: false, 
          error: 'BLE native module not available. Try rebuilding the app.' 
        };
      }

      // Check if start function exists
      if (typeof BleManager.start !== 'function') {
        console.log('BLE Manager.start is not a function - module may not be properly linked');
        isBLEAvailable = false;
        return { 
          success: false, 
          error: 'BLE module not properly installed. Please rebuild the app.' 
        };
      }

      // Try to start BLE Manager
      await BleManager.start({ showAlert: false });
      this.isInitialized = true;
      isBLEAvailable = true;

      // Set up event listeners
      this.setupEventListeners();

      console.log('BLE initialized successfully');
      return { success: true, error: null };
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      
      // Specific error handling
      if (errorMessage.includes('null') || errorMessage.includes('undefined')) {
        console.log('BLE native module not linked - this is expected in Expo Go or development builds without native modules');
        isBLEAvailable = false;
        return { 
          success: false, 
          error: 'BLE requires a native build. Please use expo prebuild and rebuild the app.' 
        };
      }

      console.log('BLE initialization error:', errorMessage);
      isBLEAvailable = false;
      return { 
        success: false, 
        error: `Bluetooth initialization failed: ${errorMessage}` 
      };
    }
  }

  // Request necessary permissions
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;
        
        if (typeof apiLevel === 'number' && apiLevel >= 31) {
          // Android 12+
          const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
          
          return (
            results['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
            results['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Android 11 and below
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return result === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (err) {
        console.error('Permission request failed:', err);
        return false;
      }
    }
    
    // iOS permissions are handled automatically
    return true;
  }

  // Start scanning for devices
  async startScan(duration: number = 10000): Promise<BrailleDevice[]> {
    if (!this.isInitialized) {
      const init = await this.initialize();
      if (!init.success) {
        throw new Error(init.error || 'BLE not initialized');
      }
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Bluetooth permissions not granted');
    }

    const devices: BrailleDevice[] = [];

    return new Promise((resolve, reject) => {
      try {
        // Start scanning
        BleManager.scan(
          [CONFIG.BLE.SERVICE_UUID], // Filter by our service UUID
          Math.floor(duration / 1000),
          true
        );

        // Set timeout to stop scan and return results
        this.scanTimeout = setTimeout(async () => {
          await this.stopScan();
          
          // Get discovered peripherals
          const peripherals = await BleManager.getDiscoveredPeripherals();
          
          for (const peripheral of peripherals) {
            if (peripheral.name?.includes('Braille') || 
                peripheral.advertising?.serviceUUIDs?.includes(CONFIG.BLE.SERVICE_UUID)) {
              devices.push({
                id: peripheral.id,
                name: peripheral.name || 'Unknown Device',
                rssi: peripheral.rssi || -100,
                isConnected: false,
              });
            }
          }
          
          resolve(devices);
        }, duration);

        this.emitEvent('scanStarted', {});
      } catch (err) {
        reject(err);
      }
    });
  }

  // Stop scanning
  async stopScan(): Promise<void> {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    try {
      await BleManager?.stopScan();
      this.emitEvent('scanStopped', {});
    } catch (err) {
      console.error('Stop scan error:', err);
    }
  }

  // Connect to a device
  async connect(deviceId: string): Promise<{ success: boolean; error: string | null }> {
    if (!this.isInitialized) {
      return { success: false, error: 'BLE not initialized' };
    }

    try {
      await BleManager.connect(deviceId);
      
      // Discover services and characteristics
      await BleManager.retrieveServices(deviceId);

      // Read device info
      const deviceInfo = await this.readDeviceInfo(deviceId);

      this._connectedDevice = {
        id: deviceId,
        name: deviceInfo.name || 'Braille Printer',
        rssi: -50,
        isConnected: true,
        batteryLevel: deviceInfo.batteryLevel,
        firmwareVersion: deviceInfo.firmwareVersion,
      };

      // Enable notifications for status updates
      await this.enableNotifications(deviceId);

      this.emitEvent('connected', this._connectedDevice);
      return { success: true, error: null };
    } catch (err) {
      console.error('Connection failed:', err);
      return { 
        success: false, 
        error: `Failed to connect: ${(err as Error).message}` 
      };
    }
  }

  // Disconnect from device
  async disconnect(): Promise<void> {
    if (!this._connectedDevice) return;

    try {
      await BleManager.disconnect(this._connectedDevice.id);
      const deviceId = this._connectedDevice.id;
      this._connectedDevice = null;
      this.emitEvent('disconnected', { deviceId });
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  }

  // Get device status
  async getDeviceStatus(): Promise<DeviceStatus> {
    if (!this._connectedDevice) {
      return {
        connected: false,
        batteryLevel: 0,
        paperLoaded: false,
        errorCode: null,
        errorMessage: null,
      };
    }

    try {
      const data = await BleManager.read(
        this._connectedDevice.id,
        CONFIG.BLE.SERVICE_UUID,
        CONFIG.BLE.CHARACTERISTICS.STATUS
      );

      // Parse status bytes
      return {
        connected: true,
        batteryLevel: data[0] || 100,
        paperLoaded: data[1] === 1,
        errorCode: data[2] || null,
        errorMessage: this.getErrorMessage(data[2]),
      };
    } catch (err) {
      console.error('Status read error:', err);
      return {
        connected: true,
        batteryLevel: this._connectedDevice.batteryLevel || 100,
        paperLoaded: true,
        errorCode: null,
        errorMessage: null,
      };
    }
  }

  // Print Braille pattern
  async printBraille(
    dotSequence: number[][],
    text: string
  ): Promise<{ success: boolean; jobId: string; error: string | null }> {
    if (!this._connectedDevice) {
      return { success: false, jobId: '', error: 'No device connected' };
    }

    const jobId = `print-${Date.now()}`;
    const job: PrintJob = {
      id: jobId,
      text,
      brailleData: dotSequence,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
    };

    this.printQueue.push(job);

    try {
      job.status = 'printing';
      this.emitEvent('printStarted', { jobId });

      // Send print data in chunks
      const chunkSize = 20; // BLE MTU limit
      const totalCells = dotSequence.length;
      
      for (let i = 0; i < totalCells; i += chunkSize) {
        const chunk = dotSequence.slice(i, i + chunkSize);
        const data = this.encodePrintData(chunk);
        
        await BleManager.write(
          this._connectedDevice.id,
          CONFIG.BLE.SERVICE_UUID,
          CONFIG.BLE.CHARACTERISTICS.PRINT,
          data
        );

        job.progress = Math.round(((i + chunk.length) / totalCells) * 100);
        this.emitEvent('printProgress', { jobId, progress: job.progress });
        
        // Small delay between chunks
        await this.delay(50);
      }

      // Send print command
      await BleManager.write(
        this._connectedDevice.id,
        CONFIG.BLE.SERVICE_UUID,
        CONFIG.BLE.CHARACTERISTICS.COMMAND,
        [0x01] // Print command
      );

      job.status = 'completed';
      job.progress = 100;
      this.emitEvent('printCompleted', { jobId });

      return { success: true, jobId, error: null };
    } catch (err) {
      job.status = 'error';
      console.error('Print error:', err);
      return { 
        success: false, 
        jobId, 
        error: `Print failed: ${(err as Error).message}` 
      };
    }
  }

  // Save device pairing to database
  async savePairing(
    userId: string,
    device: BrailleDevice
  ): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('device_pairings')
        .upsert({
          user_id: userId,
          device_id: device.id,
          device_name: device.name,
          mac_address: device.id, // Using device ID as mac_address
          last_connected: new Date().toISOString(),
        } as any);

      return { error: error?.message || null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // Get saved pairings
  async getSavedPairings(userId: string): Promise<DevicePairing[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('device_pairings')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_connected', { ascending: false });

      return error ? [] : data || [];
    } catch {
      return [];
    }
  }

  // Add event listener
  addEventListener(callback: DeviceEventCallback): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
    };
  }

  // Remove event listener
  removeEventListener(callback: DeviceEventCallback): void {
    this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
  }

  // Get connected device
  getConnectedDevice(): BrailleDevice | null {
    return this._connectedDevice;
  }

  // Get print queue
  getPrintQueue(): PrintJob[] {
    return [...this.printQueue];
  }

  // Private methods
  private setupEventListeners(): void {
    // Note: In a real implementation, these would be native event emitter listeners
    // from react-native-ble-manager
  }

  private async readDeviceInfo(deviceId: string): Promise<{
    name?: string;
    batteryLevel?: number;
    firmwareVersion?: string;
  }> {
    try {
      // Read battery level
      const batteryData = await BleManager.read(
        deviceId,
        '180F', // Battery Service UUID
        '2A19'  // Battery Level Characteristic
      );

      return {
        batteryLevel: batteryData[0],
      };
    } catch {
      return {};
    }
  }

  private async enableNotifications(deviceId: string): Promise<void> {
    try {
      await BleManager.startNotification(
        deviceId,
        CONFIG.BLE.SERVICE_UUID,
        CONFIG.BLE.CHARACTERISTICS.STATUS
      );
    } catch (err) {
      console.error('Enable notifications failed:', err);
    }
  }

  private encodePrintData(cells: number[][]): number[] {
    // Encode cell data as bytes
    // Each cell's dots (1-6) are encoded in a single byte
    return cells.map(dots => {
      let byte = 0;
      for (const dot of dots) {
        byte |= (1 << (dot - 1));
      }
      return byte;
    });
  }

  private getErrorMessage(code: number | null): string | null {
    if (code === null) return null;
    
    const errors: Record<number, string> = {
      1: 'Paper jam detected',
      2: 'Out of paper',
      3: 'Overheating - please wait',
      4: 'Low battery',
      5: 'Communication error',
    };
    
    return errors[code] || `Unknown error (${code})`;
  }

  private emitEvent(event: string, data: any): void {
    for (const callback of this.eventListeners) {
      try {
        callback(event, data);
      } catch (err) {
        console.error('Event listener error:', err);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const bleDeviceService = new BLEDeviceService();
export default bleDeviceService;
