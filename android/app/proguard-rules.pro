# ─── React Native ─────────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**

# ─── Expo ─────────────────────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }
-dontwarn expo.modules.**

# ─── Reanimated ───────────────────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# ─── BLE ──────────────────────────────────────────────────────────────────────
-keep class it.innove.** { *; }

# ─── @react-native-voice/voice ────────────────────────────────────────────────
# Package com.wenkesj.voice contains the SpeechRecognizer bridge.
# R8 WILL strip it without these rules, causing NativeModules.Voice = undefined.
-keep class com.wenkesj.voice.** { *; }
-keepclassmembers class com.wenkesj.voice.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ─── Kotlin / coroutines ──────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings { <fields>; }

# ─── General Android ──────────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
