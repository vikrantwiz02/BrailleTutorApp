package com.brailletutor.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class BluetoothModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "BluetoothAdapter";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    
    private ReactApplicationContext reactContext;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket bluetoothSocket;
    private List<BluetoothDevice> discoveredDevices;
    private BroadcastReceiver discoveryReceiver;

    public BluetoothModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        this.discoveredDevices = new ArrayList<>();
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void isBluetoothEnabled(Promise promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.resolve(false);
            } else {
                promise.resolve(bluetoothAdapter.isEnabled());
            }
        } catch (Exception e) {
            promise.reject("BT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void enableBluetooth(Promise promise) {
        try {
            if (bluetoothAdapter != null && !bluetoothAdapter.isEnabled()) {
                Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                enableBtIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                reactContext.startActivity(enableBtIntent);
                promise.resolve(true);
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("BT_ENABLE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getBondedDevices(Promise promise) {
        try {
            WritableArray devices = Arguments.createArray();
            if (bluetoothAdapter != null) {
                Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
                for (BluetoothDevice device : pairedDevices) {
                    WritableMap deviceInfo = Arguments.createMap();
                    deviceInfo.putString("id", device.getAddress());
                    deviceInfo.putString("address", device.getAddress());
                    deviceInfo.putString("name", device.getName());
                    deviceInfo.putBoolean("paired", true);
                    devices.pushMap(deviceInfo);
                }
            }
            promise.resolve(devices);
        } catch (Exception e) {
            promise.reject("BT_GET_BONDED_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void startDiscovery(Promise promise) {
        try {
            discoveredDevices.clear();
            
            if (bluetoothAdapter == null) {
                promise.reject("BT_NOT_AVAILABLE", "Bluetooth not available");
                return;
            }

            // Register receiver for device discovery
            if (discoveryReceiver == null) {
                discoveryReceiver = new BroadcastReceiver() {
                    @Override
                    public void onReceive(Context context, Intent intent) {
                        String action = intent.getAction();
                        if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                            BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                            if (device != null && !discoveredDevices.contains(device)) {
                                discoveredDevices.add(device);
                            }
                        }
                    }
                };
                
                IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
                reactContext.registerReceiver(discoveryReceiver, filter);
            }

            // Start discovery
            if (bluetoothAdapter.isDiscovering()) {
                bluetoothAdapter.cancelDiscovery();
            }
            
            boolean started = bluetoothAdapter.startDiscovery();
            
            if (started) {
                // Wait 5 seconds for discovery, then return results
                new Thread(() -> {
                    try {
                        Thread.sleep(5000);
                        bluetoothAdapter.cancelDiscovery();
                        
                        WritableArray devices = Arguments.createArray();
                        for (BluetoothDevice device : discoveredDevices) {
                            WritableMap deviceInfo = Arguments.createMap();
                            deviceInfo.putString("id", device.getAddress());
                            deviceInfo.putString("address", device.getAddress());
                            deviceInfo.putString("name", device.getName() != null ? device.getName() : "Unknown Device");
                            deviceInfo.putInt("rssi", -70); // Approximate RSSI
                            deviceInfo.putBoolean("paired", device.getBondState() == BluetoothDevice.BOND_BONDED);
                            devices.pushMap(deviceInfo);
                        }
                        promise.resolve(devices);
                    } catch (InterruptedException e) {
                        promise.reject("BT_DISCOVERY_ERROR", e.getMessage());
                    }
                }).start();
            } else {
                promise.reject("BT_START_DISCOVERY_ERROR", "Failed to start discovery");
            }
        } catch (Exception e) {
            promise.reject("BT_DISCOVERY_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopDiscovery(Promise promise) {
        try {
            if (bluetoothAdapter != null && bluetoothAdapter.isDiscovering()) {
                bluetoothAdapter.cancelDiscovery();
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("BT_STOP_DISCOVERY_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void pairDevice(String address, Promise promise) {
        try {
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
            if (device != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    device.createBond();
                    promise.resolve(true);
                } else {
                    promise.reject("BT_PAIR_ERROR", "Pairing not supported on this Android version");
                }
            } else {
                promise.reject("BT_DEVICE_NOT_FOUND", "Device not found");
            }
        } catch (Exception e) {
            promise.reject("BT_PAIR_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void connectToDevice(String address, Promise promise) {
        try {
            // Close existing connection if any
            if (bluetoothSocket != null && bluetoothSocket.isConnected()) {
                bluetoothSocket.close();
            }

            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
            bluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            
            // Cancel discovery to improve connection speed
            if (bluetoothAdapter.isDiscovering()) {
                bluetoothAdapter.cancelDiscovery();
            }
            
            bluetoothSocket.connect();
            
            WritableMap result = Arguments.createMap();
            result.putBoolean("connected", true);
            result.putString("deviceId", address);
            result.putString("deviceName", device.getName());
            promise.resolve(result);
        } catch (IOException e) {
            promise.reject("BT_CONNECT_ERROR", "Failed to connect: " + e.getMessage());
        }
    }

    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            if (bluetoothSocket != null) {
                bluetoothSocket.close();
                bluetoothSocket = null;
            }
            promise.resolve(true);
        } catch (IOException e) {
            promise.reject("BT_DISCONNECT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void sendData(String data, Promise promise) {
        try {
            if (bluetoothSocket == null || !bluetoothSocket.isConnected()) {
                promise.reject("BT_NOT_CONNECTED", "Not connected to device");
                return;
            }
            
            OutputStream outputStream = bluetoothSocket.getOutputStream();
            outputStream.write(data.getBytes());
            outputStream.flush();
            promise.resolve(true);
        } catch (IOException e) {
            promise.reject("BT_SEND_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isConnected(Promise promise) {
        try {
            boolean connected = bluetoothSocket != null && bluetoothSocket.isConnected();
            promise.resolve(connected);
        } catch (Exception e) {
            promise.reject("BT_CHECK_CONNECTION_ERROR", e.getMessage());
        }
    }
}
