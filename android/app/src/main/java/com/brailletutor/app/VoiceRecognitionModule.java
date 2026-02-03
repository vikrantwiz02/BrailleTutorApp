package com.brailletutor.app;

import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;
import java.util.Locale;

public class VoiceRecognitionModule extends ReactContextBaseJavaModule implements RecognitionListener {
    private static final String MODULE_NAME = "VoiceRecognition";
    private ReactApplicationContext reactContext;
    private SpeechRecognizer speechRecognizer;
    private boolean isListening = false;
    private String currentLanguage = "en-US";

    public VoiceRecognitionModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            boolean available = SpeechRecognizer.isRecognitionAvailable(reactContext);
            promise.resolve(available);
        } catch (Exception e) {
            promise.reject("VOICE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void startListening(String language, Promise promise) {
        try {
            if (isListening) {
                promise.resolve(true);
                return;
            }

            // Store language
            this.currentLanguage = language != null ? language : "en-US";
            
            // Create speech recognizer if needed
            if (speechRecognizer == null) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext);
                speechRecognizer.setRecognitionListener(this);
            }

            // Create intent
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, getLocaleFromLanguage(this.currentLanguage));
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactContext.getPackageName());

            // Start listening
            speechRecognizer.startListening(intent);
            isListening = true;
            promise.resolve(true);
        } catch (Exception e) {
            isListening = false;
            promise.reject("VOICE_START_ERROR", "Failed to start listening: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopListening(Promise promise) {
        try {
            if (speechRecognizer != null && isListening) {
                speechRecognizer.stopListening();
                isListening = false;
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("VOICE_STOP_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void cancelListening(Promise promise) {
        try {
            if (speechRecognizer != null && isListening) {
                speechRecognizer.cancel();
                isListening = false;
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("VOICE_CANCEL_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void destroyRecognizer(Promise promise) {
        try {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
                speechRecognizer = null;
                isListening = false;
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("VOICE_DESTROY_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isListeningNow(Promise promise) {
        promise.resolve(isListening);
    }

    // Convert language code to Locale
    private String getLocaleFromLanguage(String language) {
        if (language == null) return "en-US";
        
        switch (language.toLowerCase()) {
            case "hi-in":
            case "hindi":
                return "hi-IN";
            case "es-es":
            case "spanish":
                return "es-ES";
            case "en-us":
            case "english":
            default:
                return "en-US";
        }
    }

    // Send event to JavaScript
    private void sendEvent(String eventName, WritableMap params) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }

    // RecognitionListener implementation
    @Override
    public void onReadyForSpeech(Bundle params) {
        WritableMap event = Arguments.createMap();
        sendEvent("onSpeechStart", event);
    }

    @Override
    public void onBeginningOfSpeech() {
        WritableMap event = Arguments.createMap();
        sendEvent("onSpeechRecognized", event);
    }

    @Override
    public void onRmsChanged(float rmsdB) {
        // Volume changed
    }

    @Override
    public void onBufferReceived(byte[] buffer) {
        // Audio buffer received
    }

    @Override
    public void onEndOfSpeech() {
        isListening = false;
        WritableMap event = Arguments.createMap();
        sendEvent("onSpeechEnd", event);
    }

    @Override
    public void onError(int error) {
        isListening = false;
        WritableMap event = Arguments.createMap();
        
        String errorMessage = "Unknown error";
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                errorMessage = "Audio recording error";
                break;
            case SpeechRecognizer.ERROR_CLIENT:
                errorMessage = "Client side error";
                break;
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                errorMessage = "Insufficient permissions";
                break;
            case SpeechRecognizer.ERROR_NETWORK:
                errorMessage = "Network error";
                break;
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                errorMessage = "Network timeout";
                break;
            case SpeechRecognizer.ERROR_NO_MATCH:
                errorMessage = "No speech match";
                break;
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                errorMessage = "Recognition service busy";
                break;
            case SpeechRecognizer.ERROR_SERVER:
                errorMessage = "Server error";
                break;
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                errorMessage = "No speech input";
                break;
        }
        
        event.putInt("code", error);
        event.putString("message", errorMessage);
        sendEvent("onSpeechError", event);
    }

    @Override
    public void onResults(Bundle results) {
        isListening = false;
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        
        if (matches != null && !matches.isEmpty()) {
            WritableArray resultArray = Arguments.createArray();
            for (String match : matches) {
                resultArray.pushString(match);
            }
            
            WritableMap event = Arguments.createMap();
            event.putArray("value", resultArray);
            sendEvent("onSpeechResults", event);
        }
    }

    @Override
    public void onPartialResults(Bundle partialResults) {
        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        
        if (matches != null && !matches.isEmpty()) {
            WritableArray resultArray = Arguments.createArray();
            for (String match : matches) {
                resultArray.pushString(match);
            }
            
            WritableMap event = Arguments.createMap();
            event.putArray("value", resultArray);
            sendEvent("onSpeechPartialResults", event);
        }
    }

    @Override
    public void onEvent(int eventType, Bundle params) {
        // Additional events
    }
}
