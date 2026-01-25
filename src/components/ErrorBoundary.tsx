// Global Error Boundary Component for Production
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log to error reporting service in production
    if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
      // Sentry integration would go here
      console.error('Error caught by boundary:', error, errorInfo);
    }
    
    // Always log for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              We're sorry, but something unexpected happened. Please try again.
            </Text>
            
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.stackTrace}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  icon: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  message: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.regular as any,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: TYPOGRAPHY.sizes.body * TYPOGRAPHY.lineHeights.normal,
  },
  errorDetails: {
    maxHeight: 200,
    width: '100%',
    backgroundColor: COLORS.background.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: COLORS.error.main,
    fontFamily: 'monospace',
  },
  stackTrace: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: COLORS.text.tertiary,
    fontFamily: 'monospace',
    marginTop: SPACING.sm,
  },
  retryButton: {
    backgroundColor: COLORS.primary.main,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold as any,
    color: COLORS.text.primary,
  },
});

export default ErrorBoundary;
