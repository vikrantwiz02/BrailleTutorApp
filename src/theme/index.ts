// Theme Configuration - Modern, Professional, Accessible Design System
export const COLORS = {
  // Primary Brand Colors - Professional Blue
  primary: {
    main: '#3B82F6', // Clean blue - trust, professionalism
    light: '#60A5FA',
    dark: '#2563EB',
    gradient: ['#3B82F6', '#2563EB'],
  },
  
  // Secondary/Accent - Vibrant Purple
  secondary: {
    main: '#8B5CF6', // Rich purple - creativity, learning
    light: '#A78BFA',
    dark: '#7C3AED',
    gradient: ['#8B5CF6', '#7C3AED'],
  },
  
  // Success States - Fresh Green
  success: {
    main: '#10B981', // Natural green - achievement, progress
    light: '#34D399',
    dark: '#059669',
    background: 'rgba(16, 185, 129, 0.12)',
  },
  
  // Warning/Info - Warm Orange
  warning: {
    main: '#F59E0B',
    light: '#FBBF24',
    background: 'rgba(245, 158, 11, 0.12)',
  },
  
  // Error States - Soft Red
  error: {
    main: '#EF4444',
    light: '#F87171',
    background: 'rgba(239, 68, 68, 0.12)',
  },
  
  // Accent - Cyan
  accent: {
    main: '#06B6D4',
    light: '#22D3EE',
    dark: '#0891B2',
  },
  
  // Neutral/Background - Clean Dark Mode
  background: {
    primary: '#0F172A', // Slate dark - modern, professional
    secondary: '#1E293B',
    tertiary: '#334155',
    card: '#1E293B',
    modal: 'rgba(15, 23, 42, 0.95)',
  },
  
  // Surface Colors (for cards, sheets)
  surface: {
    elevated: '#1E293B',
    pressed: '#334155',
    hover: '#475569',
  },
  
  // Text Colors
  text: {
    primary: '#F1F5F9',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
    disabled: '#64748B',
    inverse: '#0F172A',
  },
  
  // Border/Divider
  border: {
    light: 'rgba(148, 163, 184, 0.1)',
    medium: 'rgba(148, 163, 184, 0.2)',
    strong: 'rgba(148, 163, 184, 0.3)',
  },
  
  // Special Effects
  overlay: {
    light: 'rgba(0, 0, 0, 0.4)',
    medium: 'rgba(0, 0, 0, 0.7)',
    heavy: 'rgba(0, 0, 0, 0.9)',
  },
  
  // Transparent
  transparent: 'transparent',
};

// Typography System - Accessible & Readable
export const TYPOGRAPHY = {
  // Font Families
  fonts: {
    regular: 'System', // iOS: SF Pro, Android: Roboto
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  
  // Font Sizes (rem-like scaling)
  sizes: {
    h1: 34,
    h2: 28,
    h3: 24,
    h4: 20,
    h5: 18,
    body: 16,
    bodySmall: 14,
    caption: 12,
    tiny: 10,
  },
  
  // Line Heights
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Font Weights
  weights: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
  },
};

// Spacing System (8px grid)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border Radius
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

// Shadows (iOS style elevation)
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
};

// Animation Durations
export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
  verySlow: 800,
  
  // Spring Configurations
  spring: {
    damping: 15,
    stiffness: 200,
    mass: 1,
  },
  
  // Easing Functions
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// Layout Constants
export const LAYOUT = {
  window: {
    width: 0, // Set dynamically
    height: 0, // Set dynamically
  },
  screen: {
    horizontal: 24, // Padding for screen edges
    vertical: 16,
  },
  tabBar: {
    height: 60,
  },
  header: {
    height: 56,
  },
  touchTarget: {
    minSize: 44, // Apple HIG & Material minimum
  },
};

// Accessibility - VoiceOver & TalkBack support
export const ACCESSIBILITY = {
  // Semantic role labels
  roles: {
    button: 'button',
    link: 'link',
    heading: 'header',
    text: 'text',
    image: 'image',
    adjustable: 'adjustable',
  },
  
  // Traits
  traits: {
    button: ['button'],
    link: ['link'],
    header: ['header'],
    selected: ['selected'],
    disabled: ['disabled'],
    adjustable: ['adjustable'],
  },
};

// Export default theme object
export default {
  colors: COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  animation: ANIMATION,
  layout: LAYOUT,
  accessibility: ACCESSIBILITY,
};
