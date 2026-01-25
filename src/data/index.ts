// Braille Tutor Lessons Database - Main Index
// Complete collection of 260 comprehensive Braille lessons

import { beginnerLessons } from './lessons-part1';
import { intermediateLessons } from './lessons-part2';
import { advancedLessons } from './lessons-part3';
import { expertLessons } from './lessons-part4';
import { 
  lessonContents, 
  getLessonContent, 
  generateDefaultContent,
  BRAILLE_PATTERNS,
  BRAILLE_UNICODE,
  type LessonContent,
  type LessonStep,
  type QuickPracticeItem,
  type ChallengeItem,
} from './lessonContent';

// Combine all lesson arrays
export const allLessons = [
  ...beginnerLessons,      // L001-L060: Beginner (Alphabet, Numbers, Basic Punctuation)
  ...intermediateLessons,  // L061-L130: Intermediate (Contractions, Formatting, Math)
  ...advancedLessons,      // L131-L200: Advanced (Technical, Music, Foreign Languages)
  ...expertLessons,        // L201-L260: Expert (Scientific, Speed, Professional)
];

// Export individual collections for filtered access
export { beginnerLessons, intermediateLessons, advancedLessons, expertLessons };

// Export lesson content system
export { 
  lessonContents, 
  getLessonContent, 
  generateDefaultContent,
  BRAILLE_PATTERNS,
  BRAILLE_UNICODE,
};
export type { LessonContent, LessonStep, QuickPracticeItem, ChallengeItem };

// Helper functions for lesson management
export const getLessonById = (id: string) => {
  return allLessons.find(lesson => lesson.id === id);
};

export const getLessonsByLevel = (level: string) => {
  return allLessons.filter(lesson => lesson.level === level);
};

export const getLessonsByChapter = (chapter: string) => {
  return allLessons.filter(lesson => lesson.chapter === chapter);
};

export const getNextLesson = (currentId: string) => {
  const currentIndex = allLessons.findIndex(lesson => lesson.id === currentId);
  if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
    return allLessons[currentIndex + 1];
  }
  return null;
};

export const getPreviousLesson = (currentId: string) => {
  const currentIndex = allLessons.findIndex(lesson => lesson.id === currentId);
  if (currentIndex > 0) {
    return allLessons[currentIndex - 1];
  }
  return null;
};

export const getAvailableLessons = (completedLessonIds: string[]) => {
  return allLessons.filter(lesson => {
    // A lesson is available if all prerequisites are completed
    if (lesson.prerequisites.length === 0) return true;
    return lesson.prerequisites.every(prereqId => completedLessonIds.includes(prereqId));
  });
};

export const getLessonProgress = (completedLessonIds: string[]) => {
  const total = allLessons.length;
  const completed = completedLessonIds.length;
  return {
    total,
    completed,
    percentage: Math.round((completed / total) * 100),
  };
};

export const getLevelProgress = (level: string, completedLessonIds: string[]) => {
  const levelLessons = getLessonsByLevel(level);
  const total = levelLessons.length;
  const completed = levelLessons.filter(lesson => 
    completedLessonIds.includes(lesson.id)
  ).length;
  return {
    level,
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
};

export const getChapterProgress = (chapter: string, completedLessonIds: string[]) => {
  const chapterLessons = getLessonsByChapter(chapter);
  const total = chapterLessons.length;
  const completed = chapterLessons.filter(lesson => 
    completedLessonIds.includes(lesson.id)
  ).length;
  return {
    chapter,
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
};

// Get recommended next lesson based on progress
export const getRecommendedLesson = (completedLessonIds: string[]) => {
  const available = getAvailableLessons(completedLessonIds);
  const notCompleted = available.filter(lesson => !completedLessonIds.includes(lesson.id));
  
  // Return the first incomplete lesson that's available
  return notCompleted.length > 0 ? notCompleted[0] : null;
};

// Summary statistics
export const getLessonStats = () => {
  return {
    total: allLessons.length,
    byLevel: {
      Beginner: getLessonsByLevel('Beginner').length,
      Intermediate: getLessonsByLevel('Intermediate').length,
      Advanced: getLessonsByLevel('Advanced').length,
      Expert: getLessonsByLevel('Expert').length,
    },
    totalDuration: allLessons.reduce((sum, lesson) => sum + lesson.duration_min, 0),
    averageDuration: Math.round(
      allLessons.reduce((sum, lesson) => sum + lesson.duration_min, 0) / allLessons.length
    ),
  };
};

export default allLessons;
