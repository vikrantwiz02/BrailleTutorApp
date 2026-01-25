import { createSlice } from '@reduxjs/toolkit';

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    stats: {
      lessonsCompleted: 0,
      averageScore: 0,
      readingSpeed: 0,
      streak: 0,
      currentStreak: 0,
      totalTime: 0,
      totalPracticeMinutes: 0,
      weeklyProgress: [],
      achievements: [],
    },
    timeline: [],
  },
  reducers: {
    updateStats: (state, action) => {
      state.stats = { ...state.stats, ...action.payload };
    },
    addTimelineEvent: (state, action) => {
      state.timeline.push(action.payload);
    },
  },
});

export const { updateStats, addTimelineEvent } = analyticsSlice.actions;
export default analyticsSlice.reducer;
