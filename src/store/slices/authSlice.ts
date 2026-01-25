import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authService, type AuthUser } from '../../services';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  initialized: false,
};

// Async Thunks
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getSession();
      if (response.error || !response.user) {
        return { user: null, token: null };
      }
      return { user: response.user, token: response.token };
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authService.login({ email, password });
      if (response.error) {
        return rejectWithValue(response.error);
      }
      return { user: response.user!, token: response.token! };
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (
    { email, password, name, age }: { email: string; password: string; name: string; age?: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await authService.register({ email, password, name, age });
      if (response.error) {
        return rejectWithValue(response.error);
      }
      return { user: response.user!, token: response.token! };
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.logout();
      if (response.error) {
        return rejectWithValue(response.error);
      }
      return null;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (
    { userId, updates }: { userId: string; updates: Partial<AuthUser> },
    { rejectWithValue }
  ) => {
    try {
      const response = await authService.updateProfile(userId, updates);
      if (response.error) {
        return rejectWithValue(response.error);
      }
      return updates;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.isAuthenticated = action.payload !== null;
    },
    // Keep legacy actions for backwards compatibility
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Initialize Auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = action.payload.user !== null;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = action.payload as string;
      });

    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Register
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Logout
    builder
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update Profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          state.user = { ...state.user, ...action.payload };
        }
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setUser, loginStart, loginSuccess, loginFailure, logout } =
  authSlice.actions;

// Selectors
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectAuthInitialized = (state: { auth: AuthState }) => state.auth.initialized;

export default authSlice.reducer;
