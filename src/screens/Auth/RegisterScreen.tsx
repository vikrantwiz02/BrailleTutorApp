import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import theme, { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { RootState, AppDispatch } from '../../store';
import { registerUser, clearError } from '../../store/slices/authSlice';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    // Clear any previous errors
    dispatch(clearError());
    
    // Use the real register thunk
    dispatch(registerUser({ email, password, name }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start your Braille learning journey</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={theme.colors.text.secondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.colors.text.secondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.colors.text.secondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={theme.colors.text.secondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading || !name || !email || !password || !confirmPassword}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.text.primary} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.h1,
    fontWeight: theme.typography.weights.bold as any,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.body,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xxl,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: theme.colors.surface.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.body,
    marginBottom: theme.spacing.md,
  },
  button: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semiBold as any,
  },
  linkButton: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.sizes.bodySmall,
  },
  linkTextBold: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.weights.bold as any,
  },
  error: {
    color: theme.colors.error.main,
    fontSize: theme.typography.sizes.bodySmall,
    marginBottom: theme.spacing.sm,
  },
});
