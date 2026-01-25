import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { allLessons, getLessonContent, generateDefaultContent } from '../../data';
import { progressService, type UserStats } from '../../services';
import { offlineSyncService } from '../../services';

interface Lesson {
  id: string;
  title: string;
  level: string;
  chapter: string;
  duration_min: number;
  description: string;
  prerequisites: string[];
  completed: boolean;
  score?: number;
  attempts?: number;
  lastAttempt?: string;
}

interface LessonProgress {
  lessonId: string;
  completed: boolean;
  score: number;
  attempts: number;
  timeSpent: number;
  completedAt?: string;
}

interface LessonsState {
  available: Lesson[];
  completed: LessonProgress[];
  completedIds: string[];
  current: Lesson | null;
  currentStep: number;
  totalSteps: number;
  loading: boolean;
  error: string | null;
  stats: UserStats | null;
}

const initialState: LessonsState = {
  available: allLessons,
  completed: [],
  completedIds: [],
  current: null,
  currentStep: 0,
  totalSteps: 0,
  loading: false,
  error: null,
  stats: null,
};

// Async Thunks
export const fetchLessonProgress = createAsyncThunk(
  'lessons/fetchProgress',
  async (userId: string, { rejectWithValue }) => {
    try {
      const progress = await progressService.getLessonProgress(userId);
      const completedIds = await progressService.getCompletedLessonIds(userId);
      return { progress, completedIds };
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const fetchUserStats = createAsyncThunk(
  'lessons/fetchStats',
  async (userId: string, { rejectWithValue }) => {
    try {
      const stats = await progressService.getUserStats(userId);
      return stats;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const completeLessonAsync = createAsyncThunk(
  'lessons/completeAsync',
  async (
    { userId, lessonId, score, timeSpent }: { userId: string; lessonId: string; score: number; timeSpent: number },
    { rejectWithValue }
  ) => {
    console.log('[LessonsSlice] completeLessonAsync called:', { userId, lessonId, score, timeSpent });
    
    if (!userId) {
      console.error('[LessonsSlice] No userId provided!');
      return rejectWithValue('User ID is required to save progress');
    }

    try {
      // Check if online
      if (!offlineSyncService.isNetworkOnline()) {
        console.log('[LessonsSlice] Offline - queuing for later sync');
        // Queue for later sync
        await offlineSyncService.queueAction('upsert', 'lesson_progress', {
          user_id: userId,
          lesson_id: lessonId,
          completed: true,
          score,
          time_spent: timeSpent,
          completed_at: new Date().toISOString(),
        });
        return { lessonId, score, timeSpent, synced: false };
      }

      console.log('[LessonsSlice] Online - saving to database');
      const result = await progressService.completeLesson(userId, lessonId, score, timeSpent);
      if (result.error) {
        console.error('[LessonsSlice] Save error:', result.error);
        return rejectWithValue(result.error);
      }
      console.log('[LessonsSlice] Lesson completed successfully');
      return { lessonId, score, timeSpent, synced: true };
    } catch (err) {
      console.error('[LessonsSlice] Exception:', err);
      return rejectWithValue((err as Error).message);
    }
  }
);

const lessonsSlice = createSlice({
  name: 'lessons',
  initialState,
  reducers: {
    fetchLessonsStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchLessonsSuccess(state, action: PayloadAction<Lesson[]>) {
      state.loading = false;
      state.available = action.payload.length > 0 ? action.payload : allLessons;
    },
    fetchLessonsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      if (state.available.length === 0) {
        state.available = allLessons;
      }
    },
    ensureLessonsLoaded(state) {
      if (state.available.length === 0) {
        state.available = allLessons;
      }
    },
    startLesson(state, action: PayloadAction<Lesson>) {
      state.current = action.payload;
      state.currentStep = 0;
      // Get actual step count from lesson content
      const content = getLessonContent(action.payload.id);
      if (content) {
        state.totalSteps = content.steps.length;
      } else {
        const defaultContent = generateDefaultContent(action.payload);
        state.totalSteps = defaultContent.steps.length;
      }
    },
    setTotalSteps(state, action: PayloadAction<number>) {
      state.totalSteps = action.payload;
    },
    nextStep(state) {
      if (state.currentStep < state.totalSteps - 1) {
        state.currentStep += 1;
      }
    },
    previousStep(state) {
      if (state.currentStep > 0) {
        state.currentStep -= 1;
      }
    },
    goToStep(state, action: PayloadAction<number>) {
      if (action.payload >= 0 && action.payload < state.totalSteps) {
        state.currentStep = action.payload;
      }
    },
    completeLesson(state, action: PayloadAction<LessonProgress>) {
      state.completed.push(action.payload);
      if (!state.completedIds.includes(action.payload.lessonId)) {
        state.completedIds.push(action.payload.lessonId);
      }
      if (state.current) {
        state.current.completed = true;
        state.current.score = action.payload.score;
        state.current.attempts = action.payload.attempts;
      }
      state.current = null;
      state.currentStep = 0;
    },
    exitLesson(state) {
      state.current = null;
      state.currentStep = 0;
    },
    updateLessonProgress(state, action: PayloadAction<Partial<LessonProgress>>) {
      const lessonId = state.current?.id;
      if (lessonId) {
        const existing = state.completed.find((p) => p.lessonId === lessonId);
        if (existing) {
          Object.assign(existing, action.payload);
        }
      }
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Progress
    builder
      .addCase(fetchLessonProgress.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLessonProgress.fulfilled, (state, action) => {
        state.loading = false;
        state.completedIds = action.payload.completedIds;
        state.available = state.available.map(lesson => ({
          ...lesson,
          completed: action.payload.completedIds.includes(lesson.id),
        }));
      })
      .addCase(fetchLessonProgress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch Stats
    builder
      .addCase(fetchUserStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchUserStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Complete Lesson Async
    builder
      .addCase(completeLessonAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(completeLessonAsync.fulfilled, (state, action) => {
        state.loading = false;
        const { lessonId, score, timeSpent } = action.payload;
        
        if (!state.completedIds.includes(lessonId)) {
          state.completedIds.push(lessonId);
        }
        
        state.completed.push({
          lessonId,
          completed: true,
          score,
          attempts: 1,
          timeSpent,
          completedAt: new Date().toISOString(),
        });
        
        const lessonIndex = state.available.findIndex(l => l.id === lessonId);
        if (lessonIndex !== -1) {
          state.available[lessonIndex].completed = true;
          state.available[lessonIndex].score = score;
        }
        
        state.current = null;
        state.currentStep = 0;
      })
      .addCase(completeLessonAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  fetchLessonsStart,
  fetchLessonsSuccess,
  fetchLessonsFailure,
  ensureLessonsLoaded,
  startLesson,
  setTotalSteps,
  nextStep,
  previousStep,
  goToStep,
  completeLesson,
  exitLesson,
  updateLessonProgress,
  clearError,
} = lessonsSlice.actions;

// Selectors
export const selectLessons = (state: { lessons: LessonsState }) => state.lessons.available;
export const selectCompletedLessons = (state: { lessons: LessonsState }) => state.lessons.completedIds;
export const selectCurrentLesson = (state: { lessons: LessonsState }) => state.lessons.current;
export const selectCurrentStep = (state: { lessons: LessonsState }) => state.lessons.currentStep;
export const selectTotalSteps = (state: { lessons: LessonsState }) => state.lessons.totalSteps;
export const selectLessonStats = (state: { lessons: LessonsState }) => state.lessons.stats;
export const selectLessonsLoading = (state: { lessons: LessonsState }) => state.lessons.loading;

export default lessonsSlice.reducer;
