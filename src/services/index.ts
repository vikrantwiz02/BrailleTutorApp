// Services barrel export
export { authService, type AuthUser, type AuthResponse, type RegisterParams, type LoginParams } from './authService';
export { progressService, type LessonProgressUpdate, type UserStats, type WeeklyProgress } from './progressService';
export { aiTutorService, type TutorMessage, type TutorContext } from './aiTutorService';
export { brailleService, type BrailleCell, type TranslationResult, DOT_PATTERNS } from './brailleService';
export { bleDeviceService, type BrailleDevice, type DeviceStatus, type PrintJob } from './bleDeviceService';
export { voiceService, type VoiceSettings, type SpeechResult } from './voiceService';
export { voiceCommandService, type VoiceCommand, type VoiceCommandHandler } from './voiceCommandService';
export { notificationService, type AppNotification } from './notificationService';
export { achievementService, type AchievementDefinition, ACHIEVEMENTS } from './achievementService';
export { offlineSyncService, type OfflineQueueItem } from './offlineSyncService';
export { conversationalAIService, type AppContext, type AICommandResult } from './conversationalAIService';
export { logger } from './loggerService';
