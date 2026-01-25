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

    // Add tools:overrideLibrary to handle package conflicts from dependencies
    if (!androidManifest.$['tools:overrideLibrary']) {
      androidManifest.$['tools:overrideLibrary'] = 'com.airbnb.android.react.lottie';
    }

    // Find the application element
    if (androidManifest.application && androidManifest.application[0]) {
      const application = androidManifest.application[0];
      
      // Initialize application.$ if it doesn't exist
      if (!application.$) {
        application.$ = {};
      }
      
      // Add tools:replace for appComponentFactory
      if (!application.$['tools:replace']) {
        application.$['tools:replace'] = 'android:appComponentFactory';
      } else if (!application.$['tools:replace'].includes('appComponentFactory')) {
        application.$['tools:replace'] += ',android:appComponentFactory';
      }
      
      // Ensure appComponentFactory uses AndroidX
      application.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
    }

    return config;
  });
};
