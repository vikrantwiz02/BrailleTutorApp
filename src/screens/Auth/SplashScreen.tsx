import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';

export const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary.main} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
