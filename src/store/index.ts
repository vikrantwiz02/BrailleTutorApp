import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import all slice reducers
import authReducer from './slices/authSlice';
import deviceReducer from './slices/deviceSlice';
import lessonsReducer from './slices/lessonsSlice';
import tutorReducer from './slices/tutorSlice';
import analyticsReducer from './slices/analyticsSlice';
import settingsReducer from './slices/settingsSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['auth', 'settings', 'lessons'], // What to persist
  blacklist: ['device', 'tutor'], // What NOT to persist (transient state)
};

// Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  device: deviceReducer,
  lessons: lessonsReducer,
  tutor: tutorReducer,
  analytics: analyticsReducer,
  settings: settingsReducer,
});

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// Persistor
export const persistor = persistStore(store);

// Types for TypeScript
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export default store;
