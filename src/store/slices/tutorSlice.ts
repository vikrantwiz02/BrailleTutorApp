import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { aiTutorService, type TutorMessage, type TutorContext } from '../../services';
import { voiceService } from '../../services';

interface TutorState {
  chatHistory: TutorMessage[];
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  currentResponse: string;
  sessionId: string | null;
  error: string | null;
  voiceEnabled: boolean;
}

const initialState: TutorState = {
  chatHistory: [],
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  currentResponse: '',
  sessionId: null,
  error: null,
  voiceEnabled: true,
};

// Async Thunks
export const sendMessage = createAsyncThunk(
  'tutor/sendMessage',
  async (
    { message, userId, context }: { message: string; userId: string; context?: TutorContext },
    { rejectWithValue, getState }
  ) => {
    try {
      const response = await aiTutorService.sendMessage(message, userId, context);
      if (response.error) {
        console.warn('AI Tutor error:', response.error);
      }
      
      // Speak response if voice is enabled
      const state = getState() as { tutor: TutorState };
      if (state.tutor.voiceEnabled) {
        await voiceService.speakInterruptible(response.response);
      }
      
      return response;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const getLessonHint = createAsyncThunk(
  'tutor/getLessonHint',
  async (
    { lessonTitle, stepNumber, userId, lessonId }: { lessonTitle: string; stepNumber: number; userId: string; lessonId?: string },
    { rejectWithValue, getState }
  ) => {
    try {
      const hint = await aiTutorService.getLessonHint(lessonTitle, stepNumber, userId, lessonId);
      
      // Speak hint if voice is enabled
      const state = getState() as { tutor: TutorState };
      if (state.tutor.voiceEnabled) {
        await voiceService.speakInterruptible(hint);
      }
      
      return hint;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const celebrateCompletion = createAsyncThunk(
  'tutor/celebrate',
  async (
    { lessonTitle, score, userId, lessonId }: { lessonTitle: string; score: number; userId: string; lessonId?: string },
    { rejectWithValue, getState }
  ) => {
    try {
      const celebration = await aiTutorService.celebrateCompletion(lessonTitle, score, userId, lessonId);
      
      const state = getState() as { tutor: TutorState };
      if (state.tutor.voiceEnabled) {
        await voiceService.speakInterruptible(celebration);
      }
      
      return celebration;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const loadChatHistory = createAsyncThunk(
  'tutor/loadHistory',
  async (userId: string, { rejectWithValue }) => {
    try {
      const history = await aiTutorService.loadChatHistory(userId);
      return history;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const startVoiceInput = createAsyncThunk(
  'tutor/startVoice',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const result = await voiceService.startListening();
      if (!result.success) {
        return rejectWithValue(result.error);
      }
      
      // Set up listener for voice results
      const unsubscribe = voiceService.addEventListener((event, data) => {
        if (event === 'voiceResult' && data.isFinal) {
          dispatch(setVoiceTranscript(data.text));
          dispatch(stopListening());
          unsubscribe();
        }
      });
      
      return true;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const stopVoiceInput = createAsyncThunk(
  'tutor/stopVoice',
  async () => {
    await voiceService.stopListening();
    return true;
  }
);

export const speakText = createAsyncThunk(
  'tutor/speak',
  async (text: string, { rejectWithValue }) => {
    try {
      await voiceService.speak(text);
      return true;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const stopSpeaking = createAsyncThunk(
  'tutor/stopSpeaking',
  async () => {
    await voiceService.stopSpeaking();
    return true;
  }
);

const tutorSlice = createSlice({
  name: 'tutor',
  initialState,
  reducers: {
    startListening: (state) => {
      state.isListening = true;
    },
    stopListening: (state) => {
      state.isListening = false;
    },
    setVoiceTranscript: (state, action: PayloadAction<string>) => {
      // Add user message from voice
      const userMessage: TutorMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: action.payload,
        timestamp: new Date(),
      };
      state.chatHistory.push(userMessage);
    },
    addMessage: (state, action: PayloadAction<TutorMessage>) => {
      state.chatHistory.push(action.payload);
    },
    setResponse: (state, action: PayloadAction<string>) => {
      state.currentResponse = action.payload;
    },
    clearChat: (state) => {
      state.chatHistory = [];
      aiTutorService.clearHistory();
    },
    startNewSession: (state) => {
      state.sessionId = aiTutorService.startNewSession();
      state.chatHistory = [];
    },
    setVoiceEnabled: (state, action: PayloadAction<boolean>) => {
      state.voiceEnabled = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Send Message
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isProcessing = false;
        state.currentResponse = action.payload.response;
        
        // Add assistant message to history
        const assistantMessage: TutorMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: action.payload.response,
          timestamp: new Date(),
        };
        state.chatHistory.push(assistantMessage);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload as string;
      });

    // Get Lesson Hint
    builder
      .addCase(getLessonHint.pending, (state) => {
        state.isProcessing = true;
      })
      .addCase(getLessonHint.fulfilled, (state, action) => {
        state.isProcessing = false;
        state.currentResponse = action.payload;
      })
      .addCase(getLessonHint.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload as string;
      });

    // Load Chat History
    builder
      .addCase(loadChatHistory.fulfilled, (state, action) => {
        state.chatHistory = action.payload;
      });

    // Voice Input
    builder
      .addCase(startVoiceInput.pending, (state) => {
        state.isListening = true;
      })
      .addCase(startVoiceInput.fulfilled, (state) => {
        state.isListening = true;
      })
      .addCase(startVoiceInput.rejected, (state, action) => {
        state.isListening = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(stopVoiceInput.fulfilled, (state) => {
        state.isListening = false;
      });

    // Speaking
    builder
      .addCase(speakText.pending, (state) => {
        state.isSpeaking = true;
      })
      .addCase(speakText.fulfilled, (state) => {
        state.isSpeaking = false;
      })
      .addCase(speakText.rejected, (state) => {
        state.isSpeaking = false;
      });

    builder
      .addCase(stopSpeaking.fulfilled, (state) => {
        state.isSpeaking = false;
      });
  },
});

export const {
  startListening,
  stopListening,
  setVoiceTranscript,
  addMessage,
  setResponse,
  clearChat,
  startNewSession,
  setVoiceEnabled,
  clearError,
} = tutorSlice.actions;

// Selectors
export const selectChatHistory = (state: { tutor: TutorState }) => state.tutor.chatHistory;
export const selectIsListening = (state: { tutor: TutorState }) => state.tutor.isListening;
export const selectIsSpeaking = (state: { tutor: TutorState }) => state.tutor.isSpeaking;
export const selectIsProcessing = (state: { tutor: TutorState }) => state.tutor.isProcessing;
export const selectCurrentResponse = (state: { tutor: TutorState }) => state.tutor.currentResponse;
export const selectVoiceEnabled = (state: { tutor: TutorState }) => state.tutor.voiceEnabled;

export default tutorSlice.reducer;
