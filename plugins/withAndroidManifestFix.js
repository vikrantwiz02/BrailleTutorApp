const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Add tools namespace if not present
    if (!androidManifest.$['xmlns:tools']) {
      androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Find the application element
    const application = androidManifest.application[0];
    
    // Add tools:replace for appComponentFactory
    if (application) {
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
