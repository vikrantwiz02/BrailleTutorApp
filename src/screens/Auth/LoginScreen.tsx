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
import { loginUser, clearError } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [resendingVerification, setResendingVerification] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;

    // Clear any previous errors
    dispatch(clearError());
    
    // Use the real login thunk
    dispatch(loginUser({ email: normalizedEmail, password: normalizedPassword }));
  };

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    setResendingVerification(true);
    const result = await authService.resendVerificationEmail(normalizedEmail);
    setResendingVerification(false);

    if (result.error) {
      Alert.alert('Resend Failed', result.error);
      return;
    }

    Alert.alert('Verification Sent', 'A new verification email was sent. Check inbox and spam/promotions folders.');
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue learning</Text>

          <View style={styles.form}>
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

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {error?.toLowerCase().includes('verify your email') || error?.toLowerCase().includes('invalid email or password') ? (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleResendVerification}
                disabled={resendingVerification || !email.trim()}
              >
                {resendingVerification ? (
                  <ActivityIndicator color={theme.colors.primary.main} />
                ) : (
                  <Text style={styles.linkTextBold}>Resend verification email</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading || !email || !password}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.text.primary} />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
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
