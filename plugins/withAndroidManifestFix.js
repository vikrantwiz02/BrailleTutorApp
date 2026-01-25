const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Ensure manifest has proper structure
    if (!androidManifest) {
      return config;
    }

    // Initialize $ if it doesn't exist
    if (!androidManifest.$) {
      androidManifest.$ = {};
    }

    // Add tools namespace if not present
    if (!androidManifest.$['xmlns:tools']) {
      androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Add tools:overrideLibrary to allow all library manifests to merge despite package conflicts
    const overrideLibraries = [
      'com.airbnb.android.react.lottie',
      'com.reactnativecommunity.asyncstorage',
      'it.innove',
      'com.reactnativecommunity.netinfo',
      'com.th3rdwave.safeareacontext',
      'com.oblador.vectoricons',
      'com.wenkesj.voice'
    ];
    androidManifest.$['tools:overrideLibrary'] = overrideLibraries.join(',');

    // Find the application element
    if (androidManifest.application && androidManifest.application[0]) {
      const application = androidManifest.application[0];
      
      // Initialize application.$ if it doesn't exist
      if (!application.$) {
        application.$ = {};
      }
      
      // Add tools:replace for appComponentFactory at application level
      application.$['tools:replace'] = 'android:appComponentFactory';
      
      // Ensure appComponentFactory uses AndroidX
      application.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
    }

    return config;
  });
};
