// Babel configuration for React Native with environment variables
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Enable environment variables from .env file
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        blacklist: null,
        whitelist: null,
        safe: false,
        allowUndefined: true,
      }],
      // Enable Reanimated for animations
      'react-native-reanimated/plugin',
    ],
  };
};
