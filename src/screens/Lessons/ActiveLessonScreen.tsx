import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RootState, AppDispatch } from '../../store';
import {
  nextStep,
  previousStep,
  exitLesson,
  completeLessonAsync,
} from '../../store/slices/lessonsSlice';
import {
  getLessonHint,
  celebrateCompletion,
  startVoiceInput,
  stopVoiceInput,
} from '../../store/slices/tutorSlice';
import { voiceService, voiceCommandService, bleDeviceService, brailleService, aiTutorService, conversationalAIService } from '../../services';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { 
  getLessonContent, 
  generateDefaultContent, 
  type LessonContent,
} from '../../data';

type ActiveLessonScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ActiveLesson'>;
type ActiveLessonScreenRouteProp = RouteProp<RootStackParamList, 'ActiveLesson'>;

interface Props {
  navigation: ActiveLessonScreenNavigationProp;
  route: ActiveLessonScreenRouteProp;
}

type LessonMode = 'lesson' | 'quickPractice' | 'challenge';

const EDU_COLORS = {
  primaryBlue: '#3B82F6',
  softPurple: '#8B5CF6',
  vibrantGreen: '#10B981',
  warmOrange: '#F59E0B',
  deepSlate: '#0F172A',
  slateGray: '#1E293B',
  cardDark: '#1A1A2E',
};

export const ActiveLessonScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { current: currentLesson, currentStep } = useSelector((state: RootState) => state.lessons);
  const { user } = useSelector((state: RootState) => state.auth);
  const { isListening, voiceEnabled } = useSelector((state: RootState) => state.tutor);
  const { connected: deviceConnected } = useSelector((state: RootState) => state.device);
  const settings = useSelector((state: RootState) => state.settings);
  
  const lessonStartTime = useRef(Date.now());
  // Use route.params.mode if provided, otherwise default to 'lesson'
  const [mode, setMode] = useState<LessonMode>(route.params?.mode || 'lesson');
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [waitingForBrailleInput, setWaitingForBrailleInput] = useState(false);
  const [brailleInputBuffer, setBrailleInputBuffer] = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (currentLesson) {
      const content = getLessonContent(currentLesson.id);
      setLessonContent(content || generateDefaultContent(currentLesson));
    }
  }, [currentLesson]);

  useEffect(() => {
    if (lessonContent && voiceEnabled && mode === 'lesson') {
      const step = lessonContent.steps[currentStep];
      if (step?.audioScript) voiceService.speak(step.audioScript);
    }
  }, [currentStep, lessonContent, voiceEnabled, mode]);

  const animateTransition = useCallback(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => { animateTransition(); }, [currentStep, mode, practiceIndex, challengeIndex, animateTransition]);

  // Handle missing lesson - redirect back (must be in useEffect to avoid setState during render)
  useEffect(() => {
    if (!currentLesson) {
      navigation.goBack();
    }
  }, [currentLesson, navigation]);

  // Set up voice command handlers for lesson navigation
  useFocusEffect(
    useCallback(() => {
      voiceCommandService.setContext('activeLesson');
      voiceCommandService.setHandlers({
        onLessonAction: (action) => {
          switch (action) {
            case 'next':
              if (mode === 'lesson') dispatch(nextStep());
              else if (mode === 'quickPractice') handleNextPracticeVoice();
              else if (mode === 'challenge' && showResult) handleNextChallengeVoice();
              break;
            case 'previous':
              if (mode === 'lesson') dispatch(previousStep());
              break;
            case 'repeat':
              if (lessonContent && mode === 'lesson') {
                const step = lessonContent.steps[currentStep];
                if (step?.audioScript) voiceService.speak(step.audioScript);
              }
              break;
            case 'hint':
              handleGetHintVoice();
              break;
            case 'practice':
              if (lessonContent && lessonContent.quickPractice.length > 0) {
                setMode('quickPractice');
                setPracticeIndex(0);
                setShowResult(false);
              }
              break;
            case 'challenge':
              if (lessonContent && lessonContent.challenge.length > 0) {
                setMode('challenge');
                setChallengeIndex(0);
                setScore(0);
                setCorrectAnswers(0);
              }
              break;
            case 'complete':
              handleCompleteLessonVoice();
              break;
          }
        },
        onSpeechAction: async (action) => {
          if (action === 'stop') await voiceService.stopSpeaking();
          else if (action === 'pause') await voiceService.pauseSpeaking();
          else if (action === 'resume') await voiceService.resumeSpeaking();
        },
        onHelpRequested: () => {
          voiceCommandService.readAvailableCommands();
        },
      });

      // Register global lesson action handler for conversational AI
      global.lessonActionHandler = (action: string, params?: Record<string, any>) => {
        switch (action) {
          case 'next':
            if (mode === 'lesson') dispatch(nextStep());
            else if (mode === 'quickPractice') handleNextPracticeVoice();
            else if (mode === 'challenge' && showResult) handleNextChallengeVoice();
            break;
          case 'previous':
            if (mode === 'lesson') dispatch(previousStep());
            break;
          case 'repeat':
            if (lessonContent && mode === 'lesson') {
              const step = lessonContent.steps[currentStep];
              if (step?.audioScript) voiceService.speak(step.audioScript);
            }
            break;
          case 'hint':
            handleGetHintVoice();
            break;
          case 'start':
          case 'teach':
            // Start teaching from current step
            if (lessonContent && mode === 'lesson') {
              const step = lessonContent.steps[currentStep];
              if (step?.audioScript) voiceService.speak(step.audioScript);
            }
            break;
          case 'practice':
            if (lessonContent && lessonContent.quickPractice.length > 0) {
              setMode('quickPractice');
              setPracticeIndex(0);
              setShowResult(false);
              voiceService.speak("Starting quick practice. Let's test what you've learned.");
            }
            break;
          case 'challenge':
            if (lessonContent && lessonContent.challenge.length > 0) {
              setMode('challenge');
              setChallengeIndex(0);
              setScore(0);
              setCorrectAnswers(0);
              voiceService.speak("Challenge mode started. Let's see how well you know this!");
            }
            break;
          case 'complete':
          case 'finish':
            handleCompleteLessonVoice();
            break;
          case 'exit':
          case 'quit':
            navigation.goBack();
            break;
          case 'status':
            // Tell user current position
            if (lessonContent) {
              const total = lessonContent.steps.length;
              voiceService.speak(`You are on step ${currentStep + 1} of ${total} in ${currentLesson?.title || 'this lesson'}.`);
            }
            break;
        }
      };

      // Update conversational AI context
      if (lessonContent && currentLesson) {
        conversationalAIService.updateContext({
          currentScreen: 'activeLesson',
          currentLesson: {
            id: currentLesson.id,
            title: currentLesson.title,
            level: currentLesson.level,
            stepNumber: currentStep + 1,
            totalSteps: lessonContent.steps.length,
            content: lessonContent.steps[currentStep]?.audioScript,
          },
        });
      }
      
      return () => {
        voiceCommandService.setContext('home');
        global.lessonActionHandler = undefined;
      };
    }, [mode, currentStep, showResult, lessonContent, currentLesson])
  );

  // Voice-compatible handlers (to avoid reference issues)
  const handleNextPracticeVoice = () => {
    if (!lessonContent) return;
    if (practiceIndex < lessonContent.quickPractice.length - 1) {
      setPracticeIndex(p => p + 1);
      setShowResult(false);
    }
  };
  
  const handleNextChallengeVoice = () => {
    if (!lessonContent) return;
    if (challengeIndex < lessonContent.challenge.length - 1) {
      setChallengeIndex(c => c + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };
  
  const handleGetHintVoice = () => {
    if (!lessonContent) return;
    const step = lessonContent.steps[currentStep];
    if (step?.hint) {
      voiceService.speak(step.hint);
    } else if (user?.id && currentLesson) {
      dispatch(getLessonHint({ lessonTitle: currentLesson.title, stepNumber: currentStep + 1, userId: user.id, lessonId: currentLesson.id }));
    }
  };
  
  const handleCompleteLessonVoice = async () => {
    if (!lessonContent || !currentLesson) return;
    const timeSpent = Math.floor((Date.now() - lessonStartTime.current) / 1000);
    const finalScore = mode === 'challenge' && lessonContent.challenge.length > 0 ? Math.round((correctAnswers / lessonContent.challenge.length) * 100) : 85;
    if (user?.id) {
      dispatch(completeLessonAsync({ userId: user.id, lessonId: currentLesson.id, score: finalScore, timeSpent }));
      dispatch(celebrateCompletion({ lessonTitle: currentLesson.title, score: finalScore, userId: user.id }));
    }
    navigation.goBack();
  };

  // ===== BRAILLE DEVICE INTEGRATION =====
  
  // Set up Braille device event listener for reading user input
  useEffect(() => {
    if (!deviceConnected) return;

    const handleBrailleInput = async (event: string, data: any) => {
      if (event === 'brailleInput' && waitingForBrailleInput) {
        const inputPattern = data.pattern as number[];
        const inputChar = brailleService.dotsToCharacter(inputPattern);
        
        setBrailleInputBuffer(prev => prev + inputChar);
        
        // Provide audio feedback
        if (voiceEnabled) {
          await voiceService.speak(inputChar);
        }
      }
    };

    bleDeviceService.addEventListener(handleBrailleInput);
    
    return () => {
      bleDeviceService.removeEventListener(handleBrailleInput);
    };
  }, [deviceConnected, waitingForBrailleInput, voiceEnabled]);

  // Print challenge question to Braille device
  const printChallengeToDevice = async (question: string, requiresBrailleAnswer: boolean) => {
    if (!deviceConnected) return;
    
    try {
      // Speak the question first
      await voiceService.speak(question);
      
      if (requiresBrailleAnswer) {
        // Translate question to braille and print
        const translation = brailleService.textToBraille(question);
        await bleDeviceService.printBraille(translation.dotSequence, question);
        
        // Wait for user to punch on paper
        setWaitingForBrailleInput(true);
        setBrailleInputBuffer('');
        await voiceService.speak('Please punch your answer on the Braille device. Say "done" when finished.');
      }
    } catch (error) {
      console.error('Print to device error:', error);
    }
  };

  // Verify user's Braille input using AI
  const verifyBrailleAnswer = async (expectedAnswer: string) => {
    if (!brailleInputBuffer) {
      await voiceService.speak('No input detected. Please try again.');
      return false;
    }

    setWaitingForBrailleInput(false);
    
    // Use AI to verify the answer with context
    try {
      const response = await aiTutorService.sendMessage(
        `The student was asked to write "${expectedAnswer}" in Braille. They typed: "${brailleInputBuffer}". 
         Is this correct? Respond with "Correct!" if right, or explain what was wrong and the correct answer if incorrect.
         Keep response brief for voice output.`,
        user?.id || 'anonymous',
        { currentLesson: currentLesson?.title }
      );
      
      await voiceService.speak(response.response);
      
      const isCorrect = brailleInputBuffer.toLowerCase() === expectedAnswer.toLowerCase() || 
                       response.response.toLowerCase().includes('correct');
      
      setBrailleInputBuffer('');
      return isCorrect;
    } catch (error) {
      // Fallback to simple comparison
      const isCorrect = brailleInputBuffer.toLowerCase() === expectedAnswer.toLowerCase();
      if (isCorrect) {
        await voiceService.speak('Correct! Great job.');
      } else {
        await voiceService.speak(`Incorrect. You typed ${brailleInputBuffer}, but the answer is ${expectedAnswer}.`);
      }
      setBrailleInputBuffer('');
      return isCorrect;
    }
  };

  // Voice-based question and answer for MCQ challenges
  const speakChallengeQuestion = async (challenge: any) => {
    const { question, options, type } = challenge;
    
    // Speak the question
    await voiceService.speak(question);
    
    // For MCQ, speak all options
    if (type === 'mcq' && options && options.length > 0) {
      await voiceService.speak('Your options are:');
      for (let i = 0; i < options.length; i++) {
        await voiceService.speak(`Option ${i + 1}: ${options[i]}`);
      }
      await voiceService.speak('Say the option number or the answer.');
    } else if (type === 'braille') {
      // For Braille typing challenges, print to device if connected
      if (deviceConnected) {
        await printChallengeToDevice(question, true);
      } else {
        await voiceService.speak('Speak your answer or type on your Braille device.');
      }
    }
  };

  // Auto-announce challenge questions
  useEffect(() => {
    if (mode === 'challenge' && lessonContent && voiceEnabled) {
      const challenge = lessonContent.challenge[challengeIndex];
      if (challenge && !showResult) {
        speakChallengeQuestion(challenge);
      }
    }
  }, [mode, challengeIndex, lessonContent, voiceEnabled, showResult]);

  // Handle voice answer for challenges
  useEffect(() => {
    if (mode === 'challenge' && !showResult && lessonContent) {
      const handleVoiceAnswer = async (event: string, data: any) => {
        if (event !== 'voiceResult' || !data.isFinal) return;
        
        const challenge = lessonContent.challenge[challengeIndex];
        if (!challenge) return;
        
        const spokenText = data.text.toLowerCase().trim();
        const correctAnswer = challenge.correctAnswer.toLowerCase();
        
        // Check if user said an option number
        const optionMatch = spokenText.match(/option\s*(\d+)|(\d+)/);
        if (optionMatch && challenge.options) {
          const optionNum = parseInt(optionMatch[1] || optionMatch[2]) - 1;
          if (optionNum >= 0 && optionNum < challenge.options.length) {
            handleChallengeAnswer(challenge.options[optionNum]);
            return;
          }
        }
        
        // Check if user said the answer directly
        if (spokenText === correctAnswer || spokenText.includes(correctAnswer)) {
          handleChallengeAnswer(challenge.correctAnswer);
        } else if (challenge.options?.some((opt: string) => spokenText.includes(opt.toLowerCase()))) {
          const matchedOption = challenge.options.find((opt: string) => 
            spokenText.includes(opt.toLowerCase())
          );
          if (matchedOption) {
            handleChallengeAnswer(matchedOption);
          }
        }
      };
      
      voiceService.addEventListener(handleVoiceAnswer);
      return () => {
        voiceService.removeEventListener(handleVoiceAnswer);
      };
    }
  }, [mode, challengeIndex, showResult, lessonContent]);

  // Early return without navigation call
  if (!currentLesson || !lessonContent) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[EDU_COLORS.deepSlate, EDU_COLORS.slateGray]} style={styles.background}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>Loading lesson...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const currentStepData = lessonContent.steps[currentStep];
  const progress = ((currentStep + 1) / lessonContent.steps.length) * 100;
  const isLastStep = currentStep === lessonContent.steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      Alert.alert('🎉 Lesson Complete!', 'What would you like to do next?', [
        { text: 'Quick Practice', onPress: () => lessonContent.quickPractice.length > 0 ? (setMode('quickPractice'), setPracticeIndex(0)) : Alert.alert('Not Available', 'Quick practice coming soon!') },
        { text: 'Challenge', onPress: () => lessonContent.challenge.length > 0 ? (setMode('challenge'), setChallengeIndex(0), setScore(0), setCorrectAnswers(0)) : Alert.alert('Not Available', 'Challenge coming soon!') },
        { text: 'Finish', style: 'default', onPress: handleCompleteLesson },
      ]);
    } else dispatch(nextStep());
  };

  const handlePrevious = () => { if (!isFirstStep) dispatch(previousStep()); };

  const handleCompleteLesson = async () => {
    const timeSpent = Math.floor((Date.now() - lessonStartTime.current) / 1000);
    const finalScore = mode === 'challenge' && lessonContent.challenge.length > 0 ? Math.round((correctAnswers / lessonContent.challenge.length) * 100) : 85;
    if (user?.id) {
      dispatch(completeLessonAsync({ userId: user.id, lessonId: currentLesson.id, score: finalScore, timeSpent }));
      dispatch(celebrateCompletion({ lessonTitle: currentLesson.title, score: finalScore, userId: user.id }));
    }
    navigation.goBack();
  };

  const handleExit = () => {
    Alert.alert('Exit Lesson?', 'Your progress will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit', style: 'destructive', onPress: () => { voiceService.stopSpeaking(); dispatch(exitLesson()); navigation.goBack(); } },
    ]);
  };

  const handleVoiceAssistant = () => dispatch(isListening ? stopVoiceInput() : startVoiceInput());

  const handleGetHint = () => {
    if (currentStepData?.hint) { Alert.alert('💡 Hint', currentStepData.hint); if (voiceEnabled) voiceService.speak(currentStepData.hint); }
    else if (user?.id && currentLesson) dispatch(getLessonHint({ lessonTitle: currentLesson.title, stepNumber: currentStep + 1, userId: user.id, lessonId: currentLesson.id }));
  };

  const handleNextPractice = () => {
    if (practiceIndex < lessonContent.quickPractice.length - 1) { setPracticeIndex(p => p + 1); setShowResult(false); }
    else Alert.alert('Practice Complete!', 'Great job!', [
      { text: 'Finish', onPress: handleCompleteLesson },
      { text: 'Challenge', onPress: () => lessonContent.challenge.length > 0 ? (setMode('challenge'), setChallengeIndex(0), setScore(0), setCorrectAnswers(0)) : handleCompleteLesson() },
    ]);
  };

  const handleShowPracticeAnswer = () => {
    setShowResult(true);
    if (voiceEnabled) voiceService.speak(`The answer is: ${lessonContent.quickPractice[practiceIndex].answer}`);
  };

  const handleChallengeAnswer = (answer: string) => {
    const challenge = lessonContent.challenge[challengeIndex];
    setSelectedAnswer(answer); setShowResult(true);
    if (answer === challenge.correctAnswer) { setScore(s => s + challenge.points); setCorrectAnswers(c => c + 1); if (voiceEnabled) voiceService.speak('Correct!'); }
    else if (voiceEnabled) voiceService.speak(`Incorrect. The answer is ${challenge.correctAnswer}`);
  };

  const handleNextChallenge = () => {
    if (challengeIndex < lessonContent.challenge.length - 1) { setChallengeIndex(c => c + 1); setSelectedAnswer(null); setShowResult(false); }
    else Alert.alert('Challenge Complete!', `Score: ${score} pts\nCorrect: ${correctAnswers}/${lessonContent.challenge.length}`, [{ text: 'Finish', onPress: handleCompleteLesson }]);
  };

  const renderBrailleDisplay = (pattern?: number[], unicode?: string, size = 80) => (
    <View style={[styles.brailleDisplay, { width: size + 40, height: size + 40 }]}>
      <Text style={[styles.brailleText, { fontSize: size }]}>{unicode || '⠀'}</Text>
      {pattern && pattern.length > 0 && <Text style={styles.dotNumbers}>Dots: {pattern.join(', ')}</Text>}
    </View>
  );

  const getStepIcon = (type: string) => ({ introduction: 'book-outline', instruction: 'school-outline', demonstration: 'eye-outline', practice: 'hand-left-outline', quiz: 'help-circle-outline', summary: 'checkmark-circle-outline' }[type] || 'document-outline');

  const renderStepContent = () => currentStepData && (
    <Animated.View style={[styles.lessonCard, { opacity: fadeAnim }]}>
      <View style={styles.stepBadge}><Ionicons name={getStepIcon(currentStepData.type) as any} size={16} color={EDU_COLORS.primaryBlue} /><Text style={styles.stepBadgeText}>{currentStepData.type.charAt(0).toUpperCase() + currentStepData.type.slice(1)}</Text></View>
      <Text style={styles.lessonTitle}>{currentStepData.title}</Text>
      {currentStepData.letter && <View style={styles.letterHighlight}><Text style={styles.letterText}>Letter: {currentStepData.letter}</Text></View>}
      <View style={styles.instructionContainer}><Text style={styles.instructionText}>{currentStepData.content}</Text></View>
      {(currentStepData.braillePattern || currentStepData.brailleUnicode) && <View style={styles.practiceArea}><Text style={styles.practiceTitle}>Braille Pattern</Text>{renderBrailleDisplay(currentStepData.braillePattern, currentStepData.brailleUnicode)}</View>}
      {currentStepData.practicePrompt && <View style={styles.promptContainer}><Ionicons name="hand-right" size={20} color={EDU_COLORS.warmOrange} /><Text style={styles.promptText}>{currentStepData.practicePrompt}</Text></View>}
      {currentStepData.hint && <TouchableOpacity style={styles.hintButton} onPress={handleGetHint}><Ionicons name="bulb-outline" size={20} color={EDU_COLORS.warmOrange} /><Text style={styles.hintButtonText}>Need a hint?</Text></TouchableOpacity>}
    </Animated.View>
  );

  const renderQuickPractice = () => {
    if (lessonContent.quickPractice.length === 0) return <View style={styles.emptyState}><Ionicons name="clipboard-outline" size={64} color={EDU_COLORS.slateGray} /><Text style={styles.emptyText}>No practice items yet.</Text><TouchableOpacity style={styles.backButton} onPress={() => setMode('lesson')}><Text style={styles.backButtonText}>Back to Lesson</Text></TouchableOpacity></View>;
    const practice = lessonContent.quickPractice[practiceIndex];
    return (
      <Animated.View style={[styles.lessonCard, { opacity: fadeAnim }]}>
        <View style={styles.modeHeader}><View style={styles.modeBadge}><Ionicons name="flash" size={16} color={EDU_COLORS.warmOrange} /><Text style={styles.modeBadgeText}>Quick Practice</Text></View><Text style={styles.progressText}>{practiceIndex + 1} / {lessonContent.quickPractice.length}</Text></View>
        <Text style={styles.practiceQuestion}>{practice.prompt}</Text>
        {renderBrailleDisplay(practice.braillePattern, practice.brailleUnicode, 100)}
        {showResult ? <View style={styles.answerReveal}><Ionicons name="checkmark-circle" size={24} color={EDU_COLORS.vibrantGreen} /><Text style={styles.answerText}>Answer: {practice.answer}</Text></View> : <TouchableOpacity style={styles.revealButton} onPress={handleShowPracticeAnswer}><Text style={styles.revealButtonText}>Show Answer</Text></TouchableOpacity>}
      </Animated.View>
    );
  };

  const renderChallenge = () => {
    if (lessonContent.challenge.length === 0) return <View style={styles.emptyState}><Ionicons name="trophy-outline" size={64} color={EDU_COLORS.slateGray} /><Text style={styles.emptyText}>No challenges yet.</Text><TouchableOpacity style={styles.backButton} onPress={() => setMode('lesson')}><Text style={styles.backButtonText}>Back to Lesson</Text></TouchableOpacity></View>;
    const challenge = lessonContent.challenge[challengeIndex];
    return (
      <Animated.View style={[styles.lessonCard, { opacity: fadeAnim }]}>
        <View style={styles.modeHeader}><View style={[styles.modeBadge, { backgroundColor: EDU_COLORS.softPurple + '20' }]}><Ionicons name="trophy" size={16} color={EDU_COLORS.softPurple} /><Text style={[styles.modeBadgeText, { color: EDU_COLORS.softPurple }]}>Challenge</Text></View><View style={styles.scoreContainer}><Ionicons name="star" size={16} color={EDU_COLORS.warmOrange} /><Text style={styles.scoreText}>{score} pts</Text></View></View>
        <Text style={styles.challengeProgress}>Question {challengeIndex + 1} of {lessonContent.challenge.length}</Text>
        <Text style={styles.challengeQuestion}>{challenge.prompt}</Text>
        {challenge.braillePattern && renderBrailleDisplay(challenge.braillePattern)}
        <Text style={styles.pointsLabel}>Worth {challenge.points} points</Text>
        {challenge.options && <View style={styles.optionsContainer}>{challenge.options.map((opt, i) => {
          const isSelected = selectedAnswer === opt, isCorrect = opt === challenge.correctAnswer, showCorrect = showResult && isCorrect, showIncorrect = showResult && isSelected && !isCorrect;
          return <TouchableOpacity key={i} style={[styles.optionButton, isSelected && styles.optionSelected, showCorrect && styles.optionCorrect, showIncorrect && styles.optionIncorrect]} onPress={() => !showResult && handleChallengeAnswer(opt)} disabled={showResult}><Text style={[styles.optionText, (showCorrect || isSelected) && styles.optionTextSelected]}>{opt}</Text>{showCorrect && <Ionicons name="checkmark-circle" size={20} color="#fff" />}{showIncorrect && <Ionicons name="close-circle" size={20} color="#fff" />}</TouchableOpacity>;
        })}</View>}
        {!challenge.options && <View style={styles.writeChallenge}><Text style={styles.writeChallengeHint}>Use your Braille device to write the answer</Text></View>}
        {showResult && <View style={styles.resultFeedback}>{selectedAnswer === challenge.correctAnswer ? <><Ionicons name="checkmark-circle" size={32} color={EDU_COLORS.vibrantGreen} /><Text style={styles.correctText}>Correct! +{challenge.points} pts</Text></> : <><Ionicons name="close-circle" size={32} color="#EF4444" /><Text style={styles.incorrectText}>Incorrect. Answer: {challenge.correctAnswer}</Text></>}</View>}
      </Animated.View>
    );
  };

  const renderFooter = () => {
    if (mode === 'lesson') return <View style={styles.footer}><TouchableOpacity style={[styles.navButton, isFirstStep && styles.navButtonDisabled]} onPress={handlePrevious} disabled={isFirstStep}><Ionicons name="arrow-back" size={20} color={isFirstStep ? '#666' : '#fff'} /><Text style={[styles.navButtonText, isFirstStep && { color: '#666' }]}>Previous</Text></TouchableOpacity><TouchableOpacity style={styles.nextButton} onPress={handleNext}><Text style={styles.nextButtonText}>{isLastStep ? 'Complete' : 'Next'}</Text><Ionicons name={isLastStep ? "checkmark-circle" : "arrow-forward"} size={20} color="#fff" /></TouchableOpacity></View>;
    if (mode === 'quickPractice') return <View style={styles.footer}><TouchableOpacity style={styles.navButton} onPress={() => setMode('lesson')}><Ionicons name="arrow-back" size={20} color="#fff" /><Text style={styles.navButtonText}>Back</Text></TouchableOpacity><TouchableOpacity style={styles.nextButton} onPress={handleNextPractice}><Text style={styles.nextButtonText}>{practiceIndex < lessonContent.quickPractice.length - 1 ? 'Next' : 'Finish'}</Text><Ionicons name="arrow-forward" size={20} color="#fff" /></TouchableOpacity></View>;
    if (mode === 'challenge') return <View style={styles.footer}><TouchableOpacity style={styles.navButton} onPress={() => setMode('lesson')}><Ionicons name="arrow-back" size={20} color="#fff" /><Text style={styles.navButtonText}>Exit</Text></TouchableOpacity>{showResult && <TouchableOpacity style={styles.nextButton} onPress={handleNextChallenge}><Text style={styles.nextButtonText}>{challengeIndex < lessonContent.challenge.length - 1 ? 'Next' : 'Results'}</Text><Ionicons name="arrow-forward" size={20} color="#fff" /></TouchableOpacity>}</View>;
    return null;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[EDU_COLORS.deepSlate, EDU_COLORS.slateGray]} style={styles.background}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleExit} style={styles.exitButton}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.lessonName} numberOfLines={1}>{currentLesson.title}</Text>
            {mode === 'lesson' && <><Text style={styles.stepText}>Step {currentStep + 1} of {lessonContent.steps.length}</Text><View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` as any }]} /></View></>}
          </View>
          <TouchableOpacity onPress={handleVoiceAssistant} style={styles.voiceButton}><Ionicons name={isListening ? "mic" : "mic-outline"} size={24} color={isListening ? EDU_COLORS.vibrantGreen : '#fff'} /></TouchableOpacity>
        </View>
        <View style={styles.modeTabs}>
          <TouchableOpacity style={[styles.modeTab, mode === 'lesson' && styles.modeTabActive]} onPress={() => setMode('lesson')}><Ionicons name="book" size={18} color={mode === 'lesson' ? EDU_COLORS.primaryBlue : '#888'} /><Text style={[styles.modeTabText, mode === 'lesson' && styles.modeTabTextActive]}>Lesson</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modeTab, mode === 'quickPractice' && styles.modeTabActive]} onPress={() => lessonContent.quickPractice.length > 0 && (setMode('quickPractice'), setPracticeIndex(0), setShowResult(false))} disabled={lessonContent.quickPractice.length === 0}><Ionicons name="flash" size={18} color={lessonContent.quickPractice.length === 0 ? '#444' : (mode === 'quickPractice' ? EDU_COLORS.warmOrange : '#888')} /><Text style={[styles.modeTabText, mode === 'quickPractice' && styles.modeTabTextActive, lessonContent.quickPractice.length === 0 && { color: '#444' }]}>Practice</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modeTab, mode === 'challenge' && styles.modeTabActive]} onPress={() => lessonContent.challenge.length > 0 && (setMode('challenge'), setChallengeIndex(0), setScore(0), setCorrectAnswers(0), setSelectedAnswer(null), setShowResult(false))} disabled={lessonContent.challenge.length === 0}><Ionicons name="trophy" size={18} color={lessonContent.challenge.length === 0 ? '#444' : (mode === 'challenge' ? EDU_COLORS.softPurple : '#888')} /><Text style={[styles.modeTabText, mode === 'challenge' && styles.modeTabTextActive, lessonContent.challenge.length === 0 && { color: '#444' }]}>Challenge</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {mode === 'lesson' && renderStepContent()}
          {mode === 'quickPractice' && renderQuickPractice()}
          {mode === 'challenge' && renderChallenge()}
          <TouchableOpacity style={styles.tutorCard} onPress={handleGetHint}><LinearGradient colors={[EDU_COLORS.primaryBlue + '20', EDU_COLORS.softPurple + '20']} style={styles.tutorGradient}><View style={styles.tutorIcon}><Ionicons name="sparkles" size={24} color={EDU_COLORS.primaryBlue} /></View><View style={styles.tutorContent}><Text style={styles.tutorTitle}>AI Tutor</Text><Text style={styles.tutorText}>Tap for hints or say "Help"</Text></View><Ionicons name="chevron-forward" size={20} color="#888" /></LinearGradient></TouchableOpacity>
        </ScrollView>
        {renderFooter()}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
  exitButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  lessonName: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  stepText: { fontSize: 12, color: '#888', marginBottom: 6 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
  voiceButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  modeTabs: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, gap: 6 },
  modeTabActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  modeTabText: { fontSize: 13, color: '#888', fontWeight: '500' },
  modeTabTextActive: { color: '#fff' },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  lessonCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20, marginBottom: 16 },
  stepBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16, gap: 6 },
  stepBadgeText: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },
  lessonTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  letterHighlight: { backgroundColor: 'rgba(16,185,129,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 16 },
  letterText: { fontSize: 16, color: '#10B981', fontWeight: '600' },
  instructionContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 20 },
  instructionText: { fontSize: 16, color: '#ddd', lineHeight: 26 },
  practiceArea: { alignItems: 'center', marginBottom: 20 },
  practiceTitle: { fontSize: 14, fontWeight: '600', color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  brailleDisplay: { backgroundColor: '#fff', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  brailleText: { color: '#000' },
  dotNumbers: { fontSize: 11, color: '#666', marginTop: 4 },
  promptContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.2)', padding: 12, borderRadius: 10, gap: 10 },
  promptText: { flex: 1, fontSize: 14, color: '#F59E0B' },
  hintButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8, marginTop: 12 },
  hintButtonText: { fontSize: 14, color: '#F59E0B', fontWeight: '500' },
  modeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  modeBadgeText: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  progressText: { fontSize: 14, color: '#888' },
  practiceQuestion: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 24, textAlign: 'center' },
  answerReveal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,185,129,0.2)', padding: 16, borderRadius: 12, gap: 10, marginTop: 16 },
  answerText: { fontSize: 18, color: '#10B981', fontWeight: '600' },
  revealButton: { backgroundColor: '#3B82F6', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  revealButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreText: { fontSize: 16, color: '#F59E0B', fontWeight: '700' },
  challengeProgress: { fontSize: 12, color: '#888', marginBottom: 12 },
  challengeQuestion: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 20, textAlign: 'center' },
  pointsLabel: { fontSize: 12, color: '#8B5CF6', textAlign: 'center', marginBottom: 20 },
  optionsContainer: { gap: 12 },
  optionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  optionSelected: { borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.3)' },
  optionCorrect: { backgroundColor: '#10B981', borderColor: '#10B981' },
  optionIncorrect: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  optionText: { fontSize: 16, color: '#ddd' },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
  writeChallenge: { alignItems: 'center', padding: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#444' },
  writeChallengeHint: { fontSize: 14, color: '#888', textAlign: 'center' },
  resultFeedback: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 20, gap: 12 },
  correctText: { fontSize: 18, color: '#10B981', fontWeight: '600' },
  incorrectText: { fontSize: 16, color: '#EF4444', fontWeight: '500' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 16, marginBottom: 24 },
  backButton: { backgroundColor: '#3B82F6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  backButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  tutorCard: { marginTop: 8 },
  tutorGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12 },
  tutorIcon: { width: 44, height: 44, backgroundColor: 'rgba(59,130,246,0.3)', borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  tutorContent: { flex: 1 },
  tutorTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  tutorText: { fontSize: 13, color: '#888' },
  footer: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: 'rgba(0,0,0,0.3)' },
  navButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 14, gap: 8 },
  navButtonDisabled: { opacity: 0.4 },
  navButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  nextButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14, gap: 8 },
  nextButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});