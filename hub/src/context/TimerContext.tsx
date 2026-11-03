import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

export interface TimerContextType {
  mode: 'countdown' | 'stopwatch';
  setMode: (mode: 'countdown' | 'stopwatch') => void;
  timeLeft: number; // in seconds
  totalDuration: number; // in seconds
  isRunning: boolean;
  isCompleted: boolean;
  isFloatingVisible: boolean;
  setIsFloatingVisible: (visible: boolean) => void;
  voiceAnnouncements: boolean;
  setVoiceAnnouncements: (enabled: boolean) => void;
  soundAlert: boolean;
  setSoundAlert: (enabled: boolean) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  setPresetSeconds: (seconds: number) => void;
  addSeconds: (seconds: number) => void;
}

const TimerContext = createContext<TimerContextType | null>(null);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'countdown' | 'stopwatch'>('countdown');
  const [totalDuration, setTotalDuration] = useState<number>(300); // 5 mins default
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isFloatingVisible, setIsFloatingVisible] = useState<boolean>(false);
  const [voiceAnnouncements, setVoiceAnnouncements] = useState<boolean>(true);
  const [soundAlert, setSoundAlert] = useState<boolean>(true);

  const announcedRef = useRef<{ [sec: number]: boolean }>({});

  const speak = (text: string) => {
    if (!voiceAnnouncements || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis error fallback
    }
  };

  useEffect(() => {
    let intervalId: number | null = null;

    if (isRunning) {
      intervalId = window.setInterval(() => {
        if (mode === 'countdown') {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              setIsRunning(false);
              setIsCompleted(true);
              if (soundAlert) {
                audioEngine.playGentleTimerChime();
              }
              speak('Time is up. Class, please finish your activity.');
              return 0;
            }

            const next = prev - 1;

            // Spoken milestone announcements
            if (next === 60 && !announcedRef.current[60]) {
              announcedRef.current[60] = true;
              speak('One minute remaining.');
            } else if (next === 30 && !announcedRef.current[30]) {
              announcedRef.current[30] = true;
              speak('Thirty seconds.');
            } else if (next === 10 && !announcedRef.current[10]) {
              announcedRef.current[10] = true;
              speak('Ten seconds.');
            } else if (next <= 5 && next >= 1 && !announcedRef.current[next]) {
              announcedRef.current[next] = true;
              speak(`${next}`);
            }

            return next;
          });
        } else {
          // Stopwatch
          setTimeLeft((prev) => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [isRunning, mode, soundAlert, voiceAnnouncements]);

  const startTimer = () => {
    audioEngine.unlockAudio();
    setIsCompleted(false);
    setIsRunning(true);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsCompleted(false);
    announcedRef.current = {};
    if (mode === 'countdown') {
      setTimeLeft(totalDuration);
    } else {
      setTimeLeft(0);
    }
  };

  const setPresetSeconds = (seconds: number) => {
    setIsRunning(false);
    setIsCompleted(false);
    announcedRef.current = {};
    setTotalDuration(seconds);
    setTimeLeft(seconds);
  };

  const addSeconds = (seconds: number) => {
    setTimeLeft((prev) => {
      const next = Math.max(0, prev + seconds);
      if (mode === 'countdown') {
        setTotalDuration((td) => Math.max(td, next));
      }
      return next;
    });
    setIsCompleted(false);
  };

  return (
    <TimerContext.Provider
      value={{
        mode,
        setMode,
        timeLeft,
        totalDuration,
        isRunning,
        isCompleted,
        isFloatingVisible,
        setIsFloatingVisible,
        voiceAnnouncements,
        setVoiceAnnouncements,
        soundAlert,
        setSoundAlert,
        startTimer,
        pauseTimer,
        resetTimer,
        setPresetSeconds,
        addSeconds
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useClassroomTimer = (): TimerContextType => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useClassroomTimer must be used within a TimerProvider');
  }
  return context;
};
