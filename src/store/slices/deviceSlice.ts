import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { bleDeviceService, BrailleDevice } from '../../services/bleDeviceService';
import { brailleService } from '../../services/brailleService';

interface DeviceInfo {
  id: string;
  name: string;
  macAddress: string;
  firmwareVersion: string;
  batteryLevel?: number;
}

interface PrintJob {
  id: string;
  name: string;
  type: 'text' | 'image' | 'lesson';
  status: 'queued' | 'printing' | 'completed' | 'failed' | 'paused';
  progress: number;
  totalDots: number;
  dotsCompleted: number;
  currentPosition: { x: number; y: number };
  estimatedTimeRemaining: number;
  startTime?: number;
  lastUpdate?: number;
}

interface DeviceState {
  connected: boolean;
  connecting: boolean;
  scanning: boolean;
  deviceInfo: DeviceInfo | null;
  availableDevices: DeviceInfo[];
  currentJob: PrintJob | null;
  queue: PrintJob[];
  status: 'idle' | 'ready' | 'printing' | 'error' | 'homing';
  error: string | null;
  lastAcknowledgment: number | null;
  connectionStrength: number; // RSSI value
}

const initialState: DeviceState = {
  connected: false,
  connecting: false,
  scanning: false,
  deviceInfo: null,
  availableDevices: [],
  currentJob: null,
  queue: [],
  status: 'idle',
  error: null,
  lastAcknowledgment: null,
  connectionStrength: 0,
};

// Async thunks for BLE operations
export const initializeBLE = createAsyncThunk(
  'device/initializeBLE',
  async (_, { rejectWithValue }) => {
    try {
      const result = await bleDeviceService.initialize();
      if (!result.success) {
        // Not a critical error - BLE may not be available in simulator
        console.log('BLE not available:', result.error);
        return { available: false, error: result.error };
      }
      return { available: true, error: null };
    } catch (error) {
      // Gracefully handle - BLE is optional for core app functionality
      console.log('BLE init error (non-critical):', (error as Error).message);
      return { available: false, error: (error as Error).message };
    }
  }
);

export const scanForDevices = createAsyncThunk(
  'device/scanForDevices',
  async (timeout: number = 10000, { dispatch, rejectWithValue }) => {
    try {
      const devices = await bleDeviceService.startScan(timeout);
      // Add discovered devices to state
      for (const device of devices) {
        dispatch(deviceDiscovered({
          id: device.id,
          name: device.name,
          macAddress: device.id,
          firmwareVersion: device.firmwareVersion || '',
        }));
      }
      return devices;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const connectToDevice = createAsyncThunk(
  'device/connectToDevice',
  async (deviceId: string, { rejectWithValue }) => {
    try {
      const result = await bleDeviceService.connect(deviceId);
      if (!result.success) {
        return rejectWithValue(result.error);
      }
      const status = await bleDeviceService.getDeviceStatus();
      const device = bleDeviceService.connectedDevice;
      return {
        id: deviceId,
        name: device?.name || 'Braille Device',
        macAddress: deviceId,
        firmwareVersion: device?.firmwareVersion || 'Unknown',
        batteryLevel: status.batteryLevel,
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const disconnectDevice = createAsyncThunk(
  'device/disconnectDevice',
  async (_, { rejectWithValue }) => {
    try {
      await bleDeviceService.disconnect();
      return true;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const printBrailleText = createAsyncThunk(
  'device/printBrailleText',
  async (text: string, { dispatch, rejectWithValue }) => {
    try {
      // Convert text to braille cells
      const result = brailleService.textToBraille(text);
      
      // Convert BrailleCell array to number[][] for the print function
      const dotSequence: number[][] = result.cells.map(cell => cell.dots);
      
      // Create print job
      const jobId = `print-${Date.now()}`;
      dispatch(startPrintJob({
        id: jobId,
        name: `Print: ${text.substring(0, 20)}...`,
        type: 'text',
        status: 'printing',
        progress: 0,
        totalDots: dotSequence.length,
        dotsCompleted: 0,
        currentPosition: { x: 0, y: 0 },
        estimatedTimeRemaining: dotSequence.length * 100,
        startTime: Date.now(),
      }));

      // Send print commands
      const printResult = await bleDeviceService.printBraille(dotSequence, text);
      
      if (!printResult.success) {
        throw new Error(printResult.error || 'Print failed');
      }

      dispatch(jobComplete({ jobId, duration: Date.now() }));
      return { success: true, jobId };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    startScanning(state) {
      state.scanning = true;
      state.availableDevices = [];
    },
    stopScanning(state) {
      state.scanning = false;
    },
    deviceDiscovered(state, action: PayloadAction<DeviceInfo>) {
      const exists = state.availableDevices.find(
        (d) => d.id === action.payload.id
      );
      if (!exists) {
        state.availableDevices.push(action.payload);
      }
    },
    connectStart(state) {
      state.connecting = true;
      state.error = null;
    },
    connectSuccess(state, action: PayloadAction<DeviceInfo>) {
      state.connecting = false;
      state.connected = true;
      state.deviceInfo = action.payload;
      state.status = 'ready';
    },
    connectFailure(state, action: PayloadAction<string>) {
      state.connecting = false;
      state.error = action.payload;
    },
    disconnect(state) {
      state.connected = false;
      state.deviceInfo = null;
      state.currentJob = null;
      state.queue = [];
      state.status = 'idle';
    },
    addToQueue(state, action: PayloadAction<PrintJob>) {
      state.queue.push(action.payload);
    },
    startPrintJob(state, action: PayloadAction<PrintJob>) {
      state.currentJob = action.payload;
      state.status = 'printing';
    },
    updateJobProgress(state, action: PayloadAction<{
      dotIndex: number;
      position: { x: number; y: number };
    }>) {
      if (state.currentJob) {
        state.currentJob.dotsCompleted = action.payload.dotIndex + 1;
        state.currentJob.progress =
          (state.currentJob.dotsCompleted / state.currentJob.totalDots) * 100;
        state.currentJob.currentPosition = action.payload.position;
        state.currentJob.lastUpdate = Date.now();
        state.lastAcknowledgment = Date.now();
      }
    },
    jobComplete(state, action: PayloadAction<{ jobId: string; duration: number }>) {
      if (state.currentJob && state.currentJob.id === action.payload.jobId) {
        state.currentJob.status = 'completed';
        state.currentJob.progress = 100;
        // Move to next job in queue or return to ready
        state.currentJob = null;
        state.status = state.queue.length > 0 ? 'ready' : 'idle';
      }
    },
    jobError(state, action: PayloadAction<{ jobId: string; error: string }>) {
      if (state.currentJob && state.currentJob.id === action.payload.jobId) {
        state.currentJob.status = 'failed';
        state.error = action.payload.error;
        state.status = 'error';
      }
    },
    pauseJob(state) {
      if (state.currentJob) {
        state.currentJob.status = 'paused';
        state.status = 'ready';
      }
    },
    resumeJob(state) {
      if (state.currentJob) {
        state.currentJob.status = 'printing';
        state.status = 'printing';
      }
    },
    cancelJob(state, action: PayloadAction<string>) {
      if (state.currentJob && state.currentJob.id === action.payload) {
        state.currentJob = null;
        state.status = 'ready';
      }
      state.queue = state.queue.filter((job) => job.id !== action.payload);
    },
    updateConnectionStrength(state, action: PayloadAction<number>) {
      state.connectionStrength = action.payload;
    },
    setDeviceStatus(state, action: PayloadAction<DeviceState['status']>) {
      state.status = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Scan for devices
      .addCase(scanForDevices.pending, (state) => {
        state.scanning = true;
        state.availableDevices = [];
        state.error = null;
      })
      .addCase(scanForDevices.fulfilled, (state) => {
        state.scanning = false;
      })
      .addCase(scanForDevices.rejected, (state, action) => {
        state.scanning = false;
        state.error = action.payload as string;
      })
      // Connect to device
      .addCase(connectToDevice.pending, (state) => {
        state.connecting = true;
        state.error = null;
      })
      .addCase(connectToDevice.fulfilled, (state, action) => {
        state.connecting = false;
        state.connected = true;
        state.deviceInfo = action.payload;
        state.status = 'ready';
      })
      .addCase(connectToDevice.rejected, (state, action) => {
        state.connecting = false;
        state.error = action.payload as string;
      })
      // Disconnect
      .addCase(disconnectDevice.fulfilled, (state) => {
        state.connected = false;
        state.deviceInfo = null;
        state.currentJob = null;
        state.queue = [];
        state.status = 'idle';
      })
      // Print
      .addCase(printBrailleText.rejected, (state, action) => {
        state.error = action.payload as string;
        state.status = 'error';
      });
  },
});

export const {
  startScanning,
  stopScanning,
  deviceDiscovered,
  connectStart,
  connectSuccess,
  connectFailure,
  disconnect,
  addToQueue,
  startPrintJob,
  updateJobProgress,
  jobComplete,
  jobError,
  pauseJob,
  resumeJob,
  cancelJob,
  updateConnectionStrength,
  setDeviceStatus,
  clearError,
} = deviceSlice.actions;

export default deviceSlice.reducer;
