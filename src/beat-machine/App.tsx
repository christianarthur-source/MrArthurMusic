/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { BeatGrid } from './components/BeatGrid';
import { MelodyGrid, PENTATONIC_NOTES, FULL_MAJOR_NOTES, getMelodyNotes } from './components/MelodyGrid';
import { BassGrid, PENTATONIC_BASS_NOTES, FULL_MAJOR_BASS_NOTES, getBassNotes } from './components/BassGrid';
import { SoundExplorer } from './components/SoundExplorer';
import { LivePads } from './components/LivePads';
import { MelodyXylophone } from './components/MelodyXylophone';
import { VoiceRecorderModal } from './components/VoiceRecorderModal';
import { RhythmGameModal } from './components/RhythmGameModal';
import { ExportModal } from './components/ExportModal';
import { ShareModal } from './components/ShareModal';
import { SheetMusicModal } from './components/SheetMusicModal';
import { SecretLightShowModal } from './components/SecretLightShowModal';
import { soundEngine } from './audio/soundEngine';
import { SOUND_PACKS, BEAT_PRESETS, ALL_AVAILABLE_SAMPLES } from './data/soundPacks';
import {
  BeatTrack,
  SoundSample,
  SoundType,
  MelodyTrack,
  MelodyInstrument,
  BassInstrument,
  ScaleMode,
  SharedSongData,
} from './types';
import confetti from 'canvas-confetti';
import { Sparkles, Grid3X3, Compass, Radio, Music2, Layers, Activity, Save, X } from 'lucide-react';
import { extractSongFromLocation } from './utils/songSharing';
import { cleanProfanity } from './utils/profanityFilter';
import { StudentSession, saveStudentProject } from '../utils/classroomApi';

type AppMode = 'both' | 'grid' | 'melody' | 'bass' | 'explorer' | 'pads' | 'xylophone';

export interface BeatMachineAppProps {
  onBackToHub?: () => void;
  studentSession?: StudentSession | null;
  onOpenClassroomModal?: () => void;
  onOpenAvatar?: () => void;
  loadedSongData?: SharedSongData | null;
  onClearLoadedSongData?: () => void;
  currentProjectId?: string | null;
  onProjectSaved?: (projectId: string) => void;
}

export default function BeatMachineApp({
  onBackToHub,
  studentSession = null,
  onOpenClassroomModal = () => {},
  onOpenAvatar = () => {},
  loadedSongData = null,
  onClearLoadedSongData,
  currentProjectId = null,
  onProjectSaved,
}: BeatMachineAppProps = {}) {
  const [activeMode, setActiveMode] = useState<AppMode>('both');
  const [currentPackId, setCurrentPackId] = useState<string>('space-disco');
  const [bpm, setBpm] = useState<number>(115);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalStepsInMeasure, setTotalStepsInMeasure] = useState<8 | 16>(16);
  const [totalMeasures, setTotalMeasures] = useState<number>(1);
  const [activeMeasure, setActiveMeasure] = useState<number>(0);
  const [isEchoOn, setIsEchoOn] = useState<boolean>(false);
  const [isReverbOn, setIsReverbOn] = useState<boolean>(false);
  const [isBitcrusherOn, setIsBitcrusherOn] = useState<boolean>(false);
  const [isDistortionOn, setIsDistortionOn] = useState<boolean>(false);
  const [isFilterOn, setIsFilterOn] = useState<boolean>(false);

  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isRhythmGameOpen, setIsRhythmGameOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isSheetMusicOpen, setIsSheetMusicOpen] = useState<boolean>(false);
  const [isSecretLightShowOpen, setIsSecretLightShowOpen] = useState<boolean>(false);
  const [recordedSongBlob, setRecordedSongBlob] = useState<Blob | null>(null);
  const [isRecordingSong, setIsRecordingSong] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Save Beat Cloud State
  const [isSaveBeatModalOpen, setIsSaveBeatModalOpen] = useState<boolean>(false);
  const [currentSongTitle, setCurrentSongTitle] = useState<string>('My Beat');
  const [beatTitleInput, setBeatTitleInput] = useState<string>('My Beat');
  const [isSavingBeat, setIsSavingBeat] = useState<boolean>(false);
  const [activeBeatProjectId, setActiveBeatProjectId] = useState<string | null>(
    () => currentProjectId
  );

  // Initial tracks generated from sound pack (up to 64 steps for 4 measures)
  const createTracksFromPack = useCallback((packId: string): BeatTrack[] => {
    const pack = SOUND_PACKS.find((p) => p.id === packId) || SOUND_PACKS[0];
    return pack.tracks.map((t, idx) => {
      const sample =
        ALL_AVAILABLE_SAMPLES.find((s) => s.soundType === t.soundType) ||
        ALL_AVAILABLE_SAMPLES[idx % ALL_AVAILABLE_SAMPLES.length];

      // Start with completely blank grid (no pre-made songs)
      const steps = Array(64).fill(false);

      return {
        id: `track-${idx}-${Date.now()}`,
        sample: {
          ...sample,
          name: t.name,
          icon: t.icon,
        },
        steps,
        volume: 0.9,
        muted: false,
        solo: false,
        pitch: 1.0,
      };
    });
  }, []);

  const [tracks, setTracks] = useState<BeatTrack[]>(() => createTracksFromPack('space-disco'));

  // --- MELODY STATE ---
  const [scaleMode, setScaleMode] = useState<ScaleMode>('pentatonic');
  const [melodyOctaves, setMelodyOctaves] = useState<1 | 2>(1);
  const [melodyInstrument, setMelodyInstrument] = useState<MelodyInstrument>('xylo');
  const [melodyVolume, setMelodyVolume] = useState<number>(0.85);
  const [isMelodyMuted, setIsMelodyMuted] = useState<boolean>(false);

  const initMelodyTracks = useCallback(
    (mode: ScaleMode, octs: 1 | 2 = 1): MelodyTrack[] => {
      const notes = getMelodyNotes(mode, octs);
      return notes.map((note) => {
        // Start with blank grid (no notes pre-filled)
        const steps = Array(64).fill(false);
        return { note, steps };
      });
    },
    []
  );

  const [melodyTracks, setMelodyTracks] = useState<MelodyTrack[]>(() =>
    initMelodyTracks('pentatonic', 1)
  );

  // --- BASS STATE ---
  const [bassScaleMode, setBassScaleMode] = useState<ScaleMode>('pentatonic');
  const [bassOctaves, setBassOctaves] = useState<1 | 2>(1);
  const [bassInstrument, setBassInstrument] = useState<BassInstrument>('bass-guitar');
  const [bassVolume, setBassVolume] = useState<number>(0.85);
  const [isBassMuted, setIsBassMuted] = useState<boolean>(false);

  const initBassTracks = useCallback(
    (mode: ScaleMode, octs: 1 | 2 = 1): MelodyTrack[] => {
      const notes = getBassNotes(mode, octs);
      return notes.map((note) => {
        const steps = Array(64).fill(false);
        return { note, steps };
      });
    },
    []
  );

  const [bassTracks, setBassTracks] = useState<MelodyTrack[]>(() =>
    initBassTracks('pentatonic', 1)
  );

  // Import shared song data with flexible track matching and scale adaptation
  const handleImportSong = useCallback((data: SharedSongData) => {
    if (data.bpm) setBpm(data.bpm);
    if (data.measures) {
      setTotalMeasures(Math.min(4, Math.max(1, data.measures)));
      setActiveMeasure(0);
    }
    if (data.totalStepsInMeasure) setTotalStepsInMeasure(data.totalStepsInMeasure);
    if (data.packId && SOUND_PACKS.some((p) => p.id === data.packId)) {
      setCurrentPackId(data.packId);
    }
    if (data.melodyInstrument) setMelodyInstrument(data.melodyInstrument);
    if (data.melodyScale) setScaleMode(data.melodyScale);
    if (data.melodyOctaves) setMelodyOctaves(data.melodyOctaves);
    if (data.bassInstrument) setBassInstrument(data.bassInstrument);
    if (data.bassScale) setBassScaleMode(data.bassScale);
    if (data.bassOctaves) setBassOctaves(data.bassOctaves);

    // Apply FX settings
    if (data.isEchoOn !== undefined) {
      setIsEchoOn(data.isEchoOn);
      soundEngine.setEcho(data.isEchoOn);
    }
    if (data.isReverbOn !== undefined) {
      setIsReverbOn(data.isReverbOn);
      soundEngine.setReverb(data.isReverbOn);
    }
    if (data.isBitcrusherOn !== undefined) {
      setIsBitcrusherOn(data.isBitcrusherOn);
      soundEngine.setBitcrusher(data.isBitcrusherOn);
    }
    if (data.isDistortionOn !== undefined) {
      setIsDistortionOn(data.isDistortionOn);
      soundEngine.setDistortion(data.isDistortionOn);
    }
    if (data.isFilterOn !== undefined) {
      setIsFilterOn(data.isFilterOn);
      soundEngine.setFilter(data.isFilterOn);
    }

    if (data.drumTracks && Array.isArray(data.drumTracks)) {
      setTracks(() => {
        return data.drumTracks.map((sharedTrack, idx) => {
          const sample = ALL_AVAILABLE_SAMPLES.find((s) => s.soundType === sharedTrack.soundType) ||
            ALL_AVAILABLE_SAMPLES[idx % ALL_AVAILABLE_SAMPLES.length];
          
          const steps = Array(64).fill(false);
          if (Array.isArray(sharedTrack.steps)) {
            sharedTrack.steps.forEach((val, sIdx) => {
              if (sIdx < 64) steps[sIdx] = val;
            });
          }

          return {
            id: `track-${idx}-${Date.now()}-${sharedTrack.soundType}`,
            sample: { ...sample },
            steps,
            volume: 0.9,
            muted: false,
            solo: false,
            pitch: 1.0,
          };
        });
      });
    }

    if (data.melodyTracks && Array.isArray(data.melodyTracks)) {
      const notes = getMelodyNotes(data.melodyScale || 'pentatonic', data.melodyOctaves || 1);
      setMelodyTracks(
        notes.map((note) => {
          const match = data.melodyTracks.find((m) => m.noteId === note.id);
          const steps = Array(64).fill(false);
          if (match && match.steps) {
            match.steps.forEach((val, sIdx) => {
              if (sIdx < 64) steps[sIdx] = val;
            });
          }
          return { note, steps };
        })
      );
    }

    if (data.bassTracks && Array.isArray(data.bassTracks)) {
      const notes = getBassNotes(data.bassScale || 'pentatonic', data.bassOctaves || 1);
      setBassTracks(
        notes.map((note) => {
          const match = data.bassTracks?.find((b) => b.noteId === note.id);
          const steps = Array(64).fill(false);
          if (match && match.steps) {
            match.steps.forEach((val, sIdx) => {
              if (sIdx < 64) steps[sIdx] = val;
            });
          }
          return { note, steps };
        })
      );
    }

    confetti({
      particleCount: 80,
      spread: 80,
    });
  }, []);

  // Check URL query parameters or hash on mount to load shared song if present
  useEffect(() => {
    try {
      const shared = extractSongFromLocation();
      if (shared && shared.drumTracks && shared.melodyTracks) {
        handleImportSong(shared);
        const safeTitle = cleanProfanity(shared.title, "Mr. Arthur's Beat");
        setNotification(`🎉 Loaded shared beat: "${safeTitle}"!`);
        setTimeout(() => setNotification(null), 4500);
      }
    } catch (e) {
      console.warn('Could not load song from URL param', e);
    }
  }, [handleImportSong]);

  // Load song data passed from Classroom Saved Songs list
  useEffect(() => {
    if (loadedSongData) {
      handleImportSong(loadedSongData);
      const title = loadedSongData.title || 'My Beat';
      setCurrentSongTitle(title);
      setBeatTitleInput(title);
      setNotification(`🎉 Loaded "${title}" into Beat Machine! 🥁`);
      setTimeout(() => setNotification(null), 4000);
      if (onClearLoadedSongData) {
        onClearLoadedSongData();
      }
    }
  }, [loadedSongData, handleImportSong, onClearLoadedSongData]);

  useEffect(() => {
    if (currentProjectId) {
      setActiveBeatProjectId(currentProjectId);
    }
  }, [currentProjectId]);

  // Clock references for precision audio scheduler
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const tracksRef = useRef<BeatTrack[]>(tracks);
  tracksRef.current = tracks;

  const melodyTracksRef = useRef<MelodyTrack[]>(melodyTracks);
  melodyTracksRef.current = melodyTracks;

  const melodyInstrumentRef = useRef<MelodyInstrument>(melodyInstrument);
  melodyInstrumentRef.current = melodyInstrument;

  const melodyVolumeRef = useRef<number>(melodyVolume);
  melodyVolumeRef.current = melodyVolume;

  const isMelodyMutedRef = useRef<boolean>(isMelodyMuted);
  isMelodyMutedRef.current = isMelodyMuted;

  const bassTracksRef = useRef<MelodyTrack[]>(bassTracks);
  bassTracksRef.current = bassTracks;

  const bassInstrumentRef = useRef<BassInstrument>(bassInstrument);
  bassInstrumentRef.current = bassInstrument;

  const bassVolumeRef = useRef<number>(bassVolume);
  bassVolumeRef.current = bassVolume;

  const isBassMutedRef = useRef<boolean>(isBassMuted);
  isBassMutedRef.current = isBassMuted;

  const bpmRef = useRef<number>(bpm);
  bpmRef.current = bpm;

  const totalStepsInMeasureRef = useRef<8 | 16>(totalStepsInMeasure);
  totalStepsInMeasureRef.current = totalStepsInMeasure;

  const totalMeasuresRef = useRef<number>(totalMeasures);
  totalMeasuresRef.current = totalMeasures;

  const nextStepTimeRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const timerIdRef = useRef<number | null>(null);

  // Schedule audio steps ahead of time
  const scheduleAheadTime = 0.1; // 100ms
  const lookaheadIntervalMs = 25;

  const scheduleStep = useCallback((stepIdx: number, stepTime: number) => {
    // 1. Play drum beat tracks
    const activeTracks = tracksRef.current;
    const hasAnySolo = activeTracks.some((t) => t.solo);

    activeTracks.forEach((track) => {
      if (track.steps[stepIdx]) {
        if (track.muted) return;
        if (hasAnySolo && !track.solo) return;

        soundEngine.playSound(
          track.sample.soundType,
          stepTime,
          track.volume,
          track.pitch,
          track.sample.customAudioBuffer
        );
      }
    });

    // 2. Play melody grid notes
    if (!isMelodyMutedRef.current) {
      melodyTracksRef.current.forEach((mTrack) => {
        if (mTrack.steps[stepIdx]) {
          soundEngine.playMelodyNote(
            mTrack.note.frequency,
            melodyInstrumentRef.current,
            stepTime,
            melodyVolumeRef.current
          );
        }
      });
    }

    // 3. Play bass grid notes
    if (!isBassMutedRef.current) {
      bassTracksRef.current.forEach((bTrack) => {
        if (bTrack.steps[stepIdx]) {
          soundEngine.playBassNote(
            bTrack.note.frequency,
            bassInstrumentRef.current,
            stepTime,
            bassVolumeRef.current
          );
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (timerIdRef.current !== null) {
        window.clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
      setCurrentStep(0);
      currentStepRef.current = 0;
      return;
    }

    const ctx = soundEngine.ensureAudioContext();
    if (!ctx) return;

    nextStepTimeRef.current = ctx.currentTime + 0.05;
    currentStepRef.current = 0;

    const intervalTimer = window.setInterval(() => {
      const audioCtx = soundEngine.ensureAudioContext();
      if (!audioCtx) return;

      const stepsPerMeasure = totalStepsInMeasureRef.current;
      const secondsPerBeat = 60.0 / bpmRef.current;
      const secondsPerStep = secondsPerBeat * (4.0 / stepsPerMeasure);

      const totalSongSteps = totalMeasuresRef.current * stepsPerMeasure;

      while (nextStepTimeRef.current < audioCtx.currentTime + scheduleAheadTime) {
        const stepToSchedule = currentStepRef.current;
        scheduleStep(stepToSchedule, nextStepTimeRef.current);

        // Update UI step cursor at scheduled time
        const timeUntilStep = Math.max(0, (nextStepTimeRef.current - audioCtx.currentTime) * 1000);
        setTimeout(() => {
          if (isPlayingRef.current) {
            setCurrentStep(stepToSchedule);
          }
        }, timeUntilStep);

        nextStepTimeRef.current += secondsPerStep;
        currentStepRef.current = (currentStepRef.current + 1) % totalSongSteps;
      }
    }, lookaheadIntervalMs);

    timerIdRef.current = intervalTimer;

    return () => {
      window.clearInterval(intervalTimer);
      timerIdRef.current = null;
    };
  }, [isPlaying, scheduleStep]);

  // Handlers
  const handleTogglePlay = useCallback(() => {
    soundEngine.ensureAudioContext();
    setIsPlaying((prev) => !prev);
  }, []);

  // Global Spacebar Play/Pause functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack spacebar if user is typing inside an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Only respond to Space key
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();

        // Avoid toggling background song if game or voice recorder modal is active
        if (isVoiceModalOpen || isRhythmGameOpen) {
          return;
        }

        handleTogglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleTogglePlay, isVoiceModalOpen, isRhythmGameOpen]);

  const handleToggleStep = (trackIdx: number, absoluteStepIdx: number) => {
    setTracks((prev) => {
      const copy = [...prev];
      const track = { ...copy[trackIdx] };
      const steps = [...track.steps];
      steps[absoluteStepIdx] = !steps[absoluteStepIdx];
      track.steps = steps;
      copy[trackIdx] = track;
      return copy;
    });

    if (!tracks[trackIdx].steps[absoluteStepIdx]) {
      soundEngine.playSound(
        tracks[trackIdx].sample.soundType,
        0,
        tracks[trackIdx].volume,
        tracks[trackIdx].pitch
      );
    }
  };

  const handleToggleMute = (trackIdx: number) => {
    setTracks((prev) => {
      const copy = [...prev];
      copy[trackIdx] = { ...copy[trackIdx], muted: !copy[trackIdx].muted };
      return copy;
    });
  };

  const handleToggleSolo = (trackIdx: number) => {
    setTracks((prev) => {
      const copy = [...prev];
      copy[trackIdx] = { ...copy[trackIdx], solo: !copy[trackIdx].solo };
      return copy;
    });
  };

  const handleChangeVolume = (trackIdx: number, volume: number) => {
    setTracks((prev) => {
      const copy = [...prev];
      copy[trackIdx] = { ...copy[trackIdx], volume };
      return copy;
    });
  };

  const handleChangePitch = (trackIdx: number, pitch: number) => {
    setTracks((prev) => {
      const copy = [...prev];
      copy[trackIdx] = { ...copy[trackIdx], pitch };
      return copy;
    });
    soundEngine.playSound(tracks[trackIdx].sample.soundType, 0, tracks[trackIdx].volume, pitch);
  };

  const handleChangeSample = (trackIdx: number, soundType: SoundType) => {
    const newSample = ALL_AVAILABLE_SAMPLES.find((s) => s.soundType === soundType);
    if (!newSample) return;

    setTracks((prev) => {
      const copy = [...prev];
      copy[trackIdx] = {
        ...copy[trackIdx],
        sample: { ...newSample },
      };
      return copy;
    });
  };

  const handleAssignSampleFromExplorer = (trackIdx: number, sample: SoundSample) => {
    setTracks((prev) => {
      const copy = [...prev];
      if (trackIdx < copy.length) {
        copy[trackIdx] = {
          ...copy[trackIdx],
          sample: { ...sample },
        };
      }
      return copy;
    });
  };

  const handleSelectPack = (packId: string) => {
    setCurrentPackId(packId);
    setTracks((prevTracks) => {
      const newPackTracks = createTracksFromPack(packId);
      return newPackTracks.map((newTrack, idx) => {
        if (prevTracks[idx] && prevTracks[idx].steps) {
          return {
            ...newTrack,
            steps: [...prevTracks[idx].steps],
            volume: prevTracks[idx].volume ?? newTrack.volume,
            pitch: prevTracks[idx].pitch ?? newTrack.pitch,
            muted: prevTracks[idx].muted ?? false,
            solo: prevTracks[idx].solo ?? false,
          };
        }
        return newTrack;
      });
    });

    const packObj = SOUND_PACKS.find((p) => p.id === packId);
    if (packObj) {
      setNotification(`🎒 Swapped to ${packObj.name} — drum beat sequence preserved! 🎵`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = BEAT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setCurrentPackId(preset.packId);
    const newTracks = createTracksFromPack(preset.packId);

    newTracks.forEach((track, idx) => {
      track.steps = Array(64).fill(false);
      const activeSteps = preset.patterns[idx];
      if (activeSteps) {
        activeSteps.forEach((s) => {
          if (s < 64) track.steps[s] = true;
        });
      }
    });

    setTracks(newTracks);
    setBpm(preset.bpm);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });
  };

  // --- MELODY HANDLERS ---
  const handleToggleMelodyStep = (noteIdx: number, absoluteStepIdx: number) => {
    setMelodyTracks((prev) => {
      const copy = [...prev];
      const track = { ...copy[noteIdx] };
      const steps = [...track.steps];
      steps[absoluteStepIdx] = !steps[absoluteStepIdx];
      track.steps = steps;
      copy[noteIdx] = track;
      return copy;
    });

    if (!melodyTracks[noteIdx].steps[absoluteStepIdx]) {
      soundEngine.playMelodyNote(
        melodyTracks[noteIdx].note.frequency,
        melodyInstrument,
        0,
        melodyVolume
      );
    }
  };

  const handleChangeScaleMode = (mode: ScaleMode) => {
    setScaleMode(mode);
    const notes = getMelodyNotes(mode, melodyOctaves);
    setMelodyTracks((prev) => {
      return notes.map((note) => {
        const existing = prev.find((t) => t.note.id === note.id);
        return {
          note,
          steps: existing ? existing.steps : Array(64).fill(false),
        };
      });
    });
  };

  const handleChangeMelodyOctaves = (octs: 1 | 2) => {
    setMelodyOctaves(octs);
    const notes = getMelodyNotes(scaleMode, octs);
    setMelodyTracks((prev) => {
      return notes.map((note) => {
        const existing = prev.find((t) => t.note.id === note.id);
        return {
          note,
          steps: existing ? existing.steps : Array(64).fill(false),
        };
      });
    });
  };

  // Measure addition and removal
  const handleAddMeasure = () => {
    if (totalMeasures < 4) {
      const nextMeasures = totalMeasures + 1;
      setTotalMeasures(nextMeasures);
      setActiveMeasure(nextMeasures - 1);
      confetti({ particleCount: 40, spread: 50 });
    }
  };

  const handleRemoveMeasure = () => {
    if (totalMeasures > 1) {
      setTotalMeasures((prev) => prev - 1);
    }
  };

  // --- BASS HANDLERS ---
  const handleToggleBassStep = (noteIdx: number, absoluteStepIdx: number) => {
    setBassTracks((prev) => {
      const copy = [...prev];
      const track = { ...copy[noteIdx] };
      const steps = [...track.steps];
      steps[absoluteStepIdx] = !steps[absoluteStepIdx];
      track.steps = steps;
      copy[noteIdx] = track;
      return copy;
    });

    if (!bassTracks[noteIdx].steps[absoluteStepIdx]) {
      soundEngine.playBassNote(
        bassTracks[noteIdx].note.frequency,
        bassInstrument,
        0,
        bassVolume
      );
    }
  };

  const handleChangeBassScaleMode = (mode: ScaleMode) => {
    setBassScaleMode(mode);
    const notes = getBassNotes(mode, bassOctaves);
    setBassTracks((prev) => {
      return notes.map((note) => {
        const existing = prev.find((t) => t.note.id === note.id);
        return {
          note,
          steps: existing ? existing.steps : Array(64).fill(false),
        };
      });
    });
  };

  const handleChangeBassOctaves = (octs: 1 | 2) => {
    setBassOctaves(octs);
    const notes = getBassNotes(bassScaleMode, octs);
    setBassTracks((prev) => {
      return notes.map((note) => {
        const existing = prev.find((t) => t.note.id === note.id);
        return {
          note,
          steps: existing ? existing.steps : Array(64).fill(false),
        };
      });
    });
  };

  const handleResetBeats = () => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        steps: Array(64).fill(false),
      }))
    );
  };

  const handleResetMelody = () => {
    setMelodyTracks((prev) =>
      prev.map((t) => ({
        ...t,
        steps: Array(64).fill(false),
      }))
    );
  };

  const handleResetBass = () => {
    setBassTracks((prev) =>
      prev.map((t) => ({
        ...t,
        steps: Array(64).fill(false),
      }))
    );
  };

  const handleResetAll = () => {
    handleResetBeats();
    handleResetMelody();
    handleResetBass();
  };

  const handleMagicMelody = () => {
    setMelodyTracks((prev) => {
      const noteCount = prev.length;
      return prev.map((track, trackIdx) => {
        const steps = Array(64).fill(false);
        const stepsToFill = totalMeasures * 16;
        for (let s = 0; s < stepsToFill; s += 2) {
          const targetNoteIdx = (s * 3 + trackIdx * 2) % noteCount;
          if (targetNoteIdx === trackIdx && Math.random() > 0.4) {
            steps[s] = true;
          }
        }
        return { ...track, steps };
      });
    });
  };

  const handleLoadMelodyPreset = (presetId: string) => {
    setMelodyTracks((prev) => {
      const clean = prev.map((t) => ({ ...t, steps: Array(64).fill(false) }));

      const activate = (noteId: string, stepIndices: number[]) => {
        const track = clean.find((t) => t.note.id === noteId);
        if (track) {
          stepIndices.forEach((s) => {
            if (s < 64) track.steps[s] = true;
          });
        }
      };

      if (presetId === 'twinkle') {
        activate('c4', [0, 2]);
        activate('g4', [4, 6]);
        activate('a4', [8, 10]);
        activate('g4', [12]);
      } else if (presetId === 'mary-lamb') {
        activate('e4', [0, 8, 10, 12]);
        activate('d4', [2, 6]);
        activate('c4', [4]);
      } else if (presetId === 'space-arp') {
        activate('c4', [0]);
        activate('e4', [2]);
        activate('g4', [4]);
        activate('a4', [6]);
        activate('c5', [8]);
        activate('a4', [10]);
        activate('g4', [12]);
        activate('e4', [14]);
      } else if (presetId === 'arcade-hero') {
        activate('c5', [0, 14]);
        activate('a4', [3, 12]);
        activate('g4', [6, 10]);
        activate('e4', [8]);
      }

      return clean;
    });

    confetti({
      particleCount: 50,
      spread: 60,
    });
  };

  const handleMagicBass = () => {
    setBassTracks((prev) => {
      const noteCount = prev.length;
      return prev.map((track, trackIdx) => {
        const steps = Array(64).fill(false);
        const stepsToFill = totalMeasures * 16;
        for (let s = 0; s < stepsToFill; s += 4) {
          if (trackIdx === noteCount - 1 && (s % 8 === 0 || Math.random() > 0.5)) {
            steps[s] = true;
          } else if (trackIdx === noteCount - 2 && s % 8 === 4 && Math.random() > 0.4) {
            steps[s] = true;
          } else if (Math.random() > 0.85) {
            steps[s] = true;
          }
        }
        return { ...track, steps };
      });
    });
  };

  const handleLoadBassPreset = (presetId: string) => {
    setBassTracks((prev) => {
      const clean = prev.map((t) => ({ ...t, steps: Array(64).fill(false) }));

      const activate = (noteId: string, stepIndices: number[]) => {
        const track = clean.find((t) => t.note.id === noteId);
        if (track) {
          stepIndices.forEach((s) => {
            if (s < 64) track.steps[s] = true;
          });
        }
      };

      if (presetId === 'root-bounce') {
        activate('c2-bass', [0, 8]);
        activate('g2-bass', [4, 12]);
      } else if (presetId === 'walking-bass') {
        activate('c2-bass', [0]);
        activate('d2-bass', [4]);
        activate('e2-bass', [8]);
        activate('g2-bass', [12]);
      } else if (presetId === 'disco-octaves') {
        activate('c2-bass', [0, 4, 8, 12]);
        activate('c3-bass', [2, 6, 10, 14]);
      } else if (presetId === 'funky-thumb') {
        activate('c2-bass', [0, 3, 8]);
        activate('a2-bass', [6, 14]);
        activate('g2-bass', [10, 12]);
      }

      return clean;
    });

    confetti({
      particleCount: 50,
      spread: 60,
    });
  };

  // Magic Beat Generator: creates instant fun rhythmic grooves!
  const handleMagicBeat = () => {
    const stepsPerMeasure = totalStepsInMeasure;
    setTracks((prev) => {
      return prev.map((track, idx) => {
        const steps = Array(64).fill(false);

        for (let m = 0; m < totalMeasures; m++) {
          const offset = m * stepsPerMeasure;
          if (stepsPerMeasure === 8) {
            if (idx === 0) {
              [0, 4].forEach((s) => (steps[offset + s] = true));
            } else if (idx === 1) {
              [2, 6].forEach((s) => (steps[offset + s] = true));
            } else if (idx === 2) {
              [0, 1, 2, 3, 4, 5, 6, 7].forEach((s) => (steps[offset + s] = true));
            } else {
              if (Math.random() > 0.5) steps[offset + 3] = true;
              if (Math.random() > 0.5) steps[offset + 7] = true;
            }
          } else {
            if (idx === 0) {
              const kickPatterns = [
                [0, 8],
                [0, 6, 8, 14],
                [0, 4, 8, 12],
              ];
              const pattern = kickPatterns[Math.floor(Math.random() * kickPatterns.length)];
              pattern.forEach((s) => (steps[offset + s] = true));
            } else if (idx === 1) {
              [4, 12].forEach((s) => (steps[offset + s] = true));
              if (Math.random() > 0.6) steps[offset + 14] = true;
            } else if (idx === 2) {
              const hatPatterns = [
                [2, 6, 10, 14],
                [0, 2, 4, 6, 8, 10, 12, 14],
                [0, 4, 8, 12],
              ];
              const pattern = hatPatterns[Math.floor(Math.random() * hatPatterns.length)];
              pattern.forEach((s) => (steps[offset + s] = true));
            } else {
              const candidates = [1, 3, 5, 7, 9, 11, 13, 15];
              const hitsCount = Math.floor(Math.random() * 2) + 1;
              for (let i = 0; i < hitsCount; i++) {
                const randomStep = candidates[Math.floor(Math.random() * candidates.length)];
                steps[offset + randomStep] = true;
              }
            }
          }
        }

        return { ...track, steps };
      });
    });

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleToggleEcho = () => {
    const nextEcho = !isEchoOn;
    setIsEchoOn(nextEcho);
    soundEngine.setEcho(nextEcho);
  };

  const handleToggleReverb = () => {
    const nextReverb = !isReverbOn;
    setIsReverbOn(nextReverb);
    soundEngine.setReverb(nextReverb);
  };

  const handleToggleBitcrusher = () => {
    const nextBitcrusher = !isBitcrusherOn;
    setIsBitcrusherOn(nextBitcrusher);
    soundEngine.setBitcrusher(nextBitcrusher);
  };

  const handleToggleDistortion = () => {
    const nextDistortion = !isDistortionOn;
    setIsDistortionOn(nextDistortion);
    soundEngine.setDistortion(nextDistortion);
  };

  const handleToggleFilter = () => {
    const nextFilter = !isFilterOn;
    setIsFilterOn(nextFilter);
    soundEngine.setFilter(nextFilter);
  };

  const handleToggleSongRecord = async () => {
    if (!isRecordingSong) {
      soundEngine.startRecordingSong();
      setIsRecordingSong(true);
      if (!isPlaying) {
        setIsPlaying(true);
      }
    } else {
      const blob = await soundEngine.stopRecordingSong();
      setIsRecordingSong(false);
      if (blob) {
        setRecordedSongBlob(blob);
        setIsExportModalOpen(true);
      }
    }
  };

  const handleVoiceSampleSaved = (buffer: AudioBuffer, pitch: number, sampleName: string) => {
    soundEngine.setCustomBuffer(buffer);

    const safeName = cleanProfanity(sampleName, 'My Silly Voice');

    setTracks((prev) => {
      const copy = [...prev];
      const micTrackIdx = copy.findIndex((t) => t.sample.soundType === 'custom-mic');
      const targetIdx = micTrackIdx >= 0 ? micTrackIdx : copy.length - 1;

      copy[targetIdx] = {
        ...copy[targetIdx],
        sample: {
          ...copy[targetIdx].sample,
          name: safeName,
          icon: '⭐',
          soundType: 'custom-mic',
          customAudioBuffer: buffer,
        },
        pitch,
      };
      return copy;
    });

    confetti({
      particleCount: 80,
      spread: 80,
    });
  };

  // Compile current song data for export/sharing
  const currentSongData: SharedSongData = {
    version: 1,
    title: "Mr. Arthur's Beat",
    bpm,
    measures: totalMeasures,
    totalStepsInMeasure,
    packId: currentPackId,
    drumTracks: tracks.map((t) => ({
      soundType: t.sample.soundType,
      steps: t.steps.slice(0, totalMeasures * 16),
    })),
    melodyInstrument,
    melodyScale: scaleMode,
    melodyOctaves,
    melodyTracks: melodyTracks.map((m) => ({
      noteId: m.note.id,
      steps: m.steps.slice(0, totalMeasures * 16),
    })),
    bassInstrument,
    bassScale: bassScaleMode,
    bassOctaves,
    bassTracks: bassTracks.map((b) => ({
      noteId: b.note.id,
      steps: b.steps.slice(0, totalMeasures * 16),
    })),
    // Include FX flags
    isEchoOn,
    isReverbOn,
    isBitcrusherOn,
    isDistortionOn,
    isFilterOn,
  };

  const handleOpenSaveBeat = () => {
    if (!studentSession) {
      if (onOpenClassroomModal) {
        onOpenClassroomModal();
      }
      return;
    }
    setBeatTitleInput(currentSongTitle || 'My Beat');
    setIsSaveBeatModalOpen(true);
  };

  const handleConfirmSaveBeat = async () => {
    if (!studentSession) return;
    const cleanTitle = (beatTitleInput || '').trim();
    if (!cleanTitle) return;
    setIsSavingBeat(true);
    try {
      const res = await saveStudentProject({
        studentId: studentSession.id,
        pin: studentSession.pin,
        projectId: activeBeatProjectId,
        title: cleanTitle,
        appType: 'beat-machine',
        projectData: {
          ...currentSongData,
          title: cleanTitle,
        },
      });
      if (res.saved && res.project) {
        setActiveBeatProjectId(res.project.id);
        setCurrentSongTitle(cleanTitle);
        setIsSaveBeatModalOpen(false);
        setNotification(`🎉 "${cleanTitle}" saved to your cloud account!`);
        setTimeout(() => setNotification(null), 4000);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        if (onProjectSaved) {
          onProjectSaved(res.project.id);
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save beat.');
    } finally {
      setIsSavingBeat(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 p-3 sm:p-6 lg:p-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Toast Notification */}
        {notification && (
          <div className="flex items-center gap-2 rounded-2xl bg-amber-400 text-slate-950 p-4 font-black shadow-xl animate-bounce-sm">
            <Sparkles className="h-5 w-5" />
            <span>{notification}</span>
          </div>
        )}

        {/* Top App Header with Playback & Controls */}
        <Header
          onBackToHub={onBackToHub}
          studentSession={studentSession}
          onOpenClassroomModal={onOpenClassroomModal}
          onOpenAvatar={onOpenAvatar}
          onSaveSong={handleOpenSaveBeat}
          isSaving={isSavingBeat}
          currentSongTitle={currentSongTitle}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          bpm={bpm}
          onChangeBpm={setBpm}
          onResetAll={handleResetAll}
          isEchoOn={isEchoOn}
          onToggleEcho={handleToggleEcho}
          isReverbOn={isReverbOn}
          onToggleReverb={handleToggleReverb}
          isBitcrusherOn={isBitcrusherOn}
          onToggleBitcrusher={handleToggleBitcrusher}
          isDistortionOn={isDistortionOn}
          onToggleDistortion={handleToggleDistortion}
          isFilterOn={isFilterOn}
          onToggleFilter={handleToggleFilter}
          onOpenVoiceRecorder={() => setIsVoiceModalOpen(true)}
          onOpenRhythmGame={() => setIsRhythmGameOpen(true)}
          onOpenShare={() => setIsShareModalOpen(true)}
          onOpenNotateSong={() => setIsSheetMusicOpen(true)}
          onOpenSecretLightShow={() => setIsSecretLightShowOpen(true)}
          isRecordingSong={isRecordingSong}
          onToggleSongRecord={handleToggleSongRecord}
          totalSteps={totalStepsInMeasure}
          onToggleTotalSteps={setTotalStepsInMeasure}
        />

        {/* Navigation Tabs Bar for Kids */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/90 p-2 border border-slate-800 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveMode('both')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                activeMode === 'both'
                  ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-500 text-slate-950 shadow-md scale-102 ring-2 ring-amber-300/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Full Studio (Beats + Melody + Bass) ✨</span>
            </button>

            <button
              onClick={() => setActiveMode('grid')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                activeMode === 'grid'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md scale-102 ring-2 ring-pink-400/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
              <span>Drum Beat 🥁</span>
            </button>

            <button
              onClick={() => setActiveMode('melody')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                activeMode === 'melody'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md scale-102 ring-2 ring-purple-300/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Music2 className="h-4 w-4" />
              <span>Melody 🎹</span>
              <span className="rounded-full bg-slate-950/40 px-1.5 py-0.5 text-[10px] text-pink-300">
                {melodyInstrument}
              </span>
            </button>

            <button
              onClick={() => setActiveMode('bass')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                activeMode === 'bass'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md scale-102 ring-2 ring-purple-400/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Bass 🎸</span>
              <span className="rounded-full bg-slate-950/40 px-1.5 py-0.5 text-[10px] text-purple-300">
                {bassInstrument}
              </span>
            </button>

            <button
              onClick={() => setActiveMode('explorer')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                activeMode === 'explorer'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-md scale-102 ring-2 ring-amber-300/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>Sound Explorer 🧭</span>
            </button>

            <button
              onClick={() => setActiveMode('pads')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                activeMode === 'pads'
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-md scale-102 ring-2 ring-cyan-300/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Radio className="h-4 w-4" />
              <span>Live Pads</span>
            </button>

            <button
              onClick={() => setActiveMode('xylophone')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                activeMode === 'xylophone'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md scale-102 ring-2 ring-pink-300/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span>🌈 Xylo Bars</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pr-2">
            <span className="text-xs font-bold text-slate-400 hidden md:inline">
              Song Length:
            </span>
            <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs font-black text-amber-300 border border-slate-700">
              {totalMeasures} {totalMeasures === 1 ? 'Measure' : 'Measures'}
            </span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
              }`}
            />
          </div>
        </div>

        {/* View Mode Switching */}
        {activeMode === 'both' && (
          <div className="space-y-6">
            {/* 1. Drum Beat Grid is FIRST */}
            <BeatGrid
              tracks={tracks}
              currentStep={currentStep}
              totalStepsInMeasure={totalStepsInMeasure}
              activeMeasure={activeMeasure}
              totalMeasures={totalMeasures}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onChangeActiveMeasure={setActiveMeasure}
              onAddMeasure={handleAddMeasure}
              onRemoveMeasure={handleRemoveMeasure}
              onToggleStep={handleToggleStep}
              onResetBeats={handleResetBeats}
              onMagicBeat={handleMagicBeat}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onChangeVolume={handleChangeVolume}
              onChangePitch={handleChangePitch}
              onChangeSample={handleChangeSample}
              currentPackId={currentPackId}
              onSelectPack={handleSelectPack}
              onSelectPreset={handleSelectPreset}
            />

            {/* 2. Melody Grid is SECOND */}
            <MelodyGrid
              melodyTracks={melodyTracks}
              currentStep={currentStep}
              totalStepsInMeasure={totalStepsInMeasure}
              activeMeasure={activeMeasure}
              totalMeasures={totalMeasures}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onChangeActiveMeasure={setActiveMeasure}
              onAddMeasure={handleAddMeasure}
              onRemoveMeasure={handleRemoveMeasure}
              instrument={melodyInstrument}
              onChangeInstrument={setMelodyInstrument}
              scaleMode={scaleMode}
              onChangeScaleMode={handleChangeScaleMode}
              octaves={melodyOctaves}
              onChangeOctaves={handleChangeMelodyOctaves}
              onToggleStep={handleToggleMelodyStep}
              onResetMelody={handleResetMelody}
              onMagicMelody={handleMagicMelody}
              onLoadSongPreset={handleLoadMelodyPreset}
              volume={melodyVolume}
              onChangeVolume={setMelodyVolume}
              isMuted={isMelodyMuted}
              onToggleMute={() => setIsMelodyMuted((m) => !m)}
            />

            {/* 3. Bass Grid is THIRD */}
            <BassGrid
              bassTracks={bassTracks}
              currentStep={currentStep}
              totalStepsInMeasure={totalStepsInMeasure}
              activeMeasure={activeMeasure}
              totalMeasures={totalMeasures}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onChangeActiveMeasure={setActiveMeasure}
              onAddMeasure={handleAddMeasure}
              onRemoveMeasure={handleRemoveMeasure}
              instrument={bassInstrument}
              onChangeInstrument={setBassInstrument}
              scaleMode={bassScaleMode}
              onChangeScaleMode={handleChangeBassScaleMode}
              octaves={bassOctaves}
              onChangeOctaves={handleChangeBassOctaves}
              onToggleStep={handleToggleBassStep}
              onResetBass={handleResetBass}
              onMagicBass={handleMagicBass}
              onLoadBassPreset={handleLoadBassPreset}
              volume={bassVolume}
              onChangeVolume={setBassVolume}
              isMuted={isBassMuted}
              onToggleMute={() => setIsBassMuted((m) => !m)}
            />
          </div>
        )}

        {activeMode === 'grid' && (
          <div className="space-y-6">
            <BeatGrid
              tracks={tracks}
              currentStep={currentStep}
              totalStepsInMeasure={totalStepsInMeasure}
              activeMeasure={activeMeasure}
              totalMeasures={totalMeasures}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onChangeActiveMeasure={setActiveMeasure}
              onAddMeasure={handleAddMeasure}
              onRemoveMeasure={handleRemoveMeasure}
              onToggleStep={handleToggleStep}
              onResetBeats={handleResetBeats}
              onMagicBeat={handleMagicBeat}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onChangeVolume={handleChangeVolume}
              onChangePitch={handleChangePitch}
              onChangeSample={handleChangeSample}
              currentPackId={currentPackId}
              onSelectPack={handleSelectPack}
              onSelectPreset={handleSelectPreset}
            />
          </div>
        )}

        {activeMode === 'melody' && (
          <div className="space-y-6">
            <MelodyGrid
              melodyTracks={melodyTracks}
              currentStep={currentStep}
              totalStepsInMeasure={totalStepsInMeasure}
              activeMeasure={activeMeasure}
              totalMeasures={totalMeasures}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onChangeActiveMeasure={setActiveMeasure}
              onAddMeasure={handleAddMeasure}
              onRemoveMeasure={handleRemoveMeasure}
              instrument={melodyInstrument}
              onChangeInstrument={setMelodyInstrument}
              scaleMode={scaleMode}
              onChangeScaleMode={handleChangeScaleMode}
              octaves={melodyOctaves}
              onChangeOctaves={handleChangeMelodyOctaves}
              onToggleStep={handleToggleMelodyStep}
              onResetMelody={handleResetMelody}
              onMagicMelody={handleMagicMelody}
              onLoadSongPreset={handleLoadMelodyPreset}
              volume={melodyVolume}
              onChangeVolume={setMelodyVolume}
              isMuted={isMelodyMuted}
              onToggleMute={() => setIsMelodyMuted((m) => !m)}
            />
          </div>
        )}

        {activeMode === 'bass' && (
          <div className="space-y-6">
            <BassGrid
              bassTracks={bassTracks}
              currentStep={currentStep}
              totalStepsInMeasure={totalStepsInMeasure}
              activeMeasure={activeMeasure}
              totalMeasures={totalMeasures}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onChangeActiveMeasure={setActiveMeasure}
              onAddMeasure={handleAddMeasure}
              onRemoveMeasure={handleRemoveMeasure}
              instrument={bassInstrument}
              onChangeInstrument={setBassInstrument}
              scaleMode={bassScaleMode}
              onChangeScaleMode={handleChangeBassScaleMode}
              octaves={bassOctaves}
              onChangeOctaves={handleChangeBassOctaves}
              onToggleStep={handleToggleBassStep}
              onResetBass={handleResetBass}
              onMagicBass={handleMagicBass}
              onLoadBassPreset={handleLoadBassPreset}
              volume={bassVolume}
              onChangeVolume={setBassVolume}
              isMuted={isBassMuted}
              onToggleMute={() => setIsBassMuted((m) => !m)}
            />
          </div>
        )}

        {activeMode === 'explorer' && (
          <SoundExplorer
            onAssignToTrack={handleAssignSampleFromExplorer}
            trackNames={tracks.map((t) => t.sample.name)}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
          />
        )}

        {activeMode === 'pads' && (
          <div className="space-y-6">
            <LivePads
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
            />
            <BeatGrid
              tracks={tracks}
              currentStep={currentStep}
              totalStepsInMeasure={totalStepsInMeasure}
              activeMeasure={activeMeasure}
              totalMeasures={totalMeasures}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onChangeActiveMeasure={setActiveMeasure}
              onAddMeasure={handleAddMeasure}
              onToggleStep={handleToggleStep}
              onResetBeats={handleResetBeats}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onChangeVolume={handleChangeVolume}
              onChangePitch={handleChangePitch}
              onChangeSample={handleChangeSample}
            />
          </div>
        )}

        {activeMode === 'xylophone' && (
          <div className="space-y-6">
            <MelodyXylophone
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
            />
            <BeatGrid
              tracks={tracks}
              currentStep={currentStep}
              totalStepsInMeasure={totalStepsInMeasure}
              activeMeasure={activeMeasure}
              totalMeasures={totalMeasures}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onChangeActiveMeasure={setActiveMeasure}
              onAddMeasure={handleAddMeasure}
              onToggleStep={handleToggleStep}
              onResetBeats={handleResetBeats}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onChangeVolume={handleChangeVolume}
              onChangePitch={handleChangePitch}
              onChangeSample={handleChangeSample}
            />
          </div>
        )}

        {/* Modals */}
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          songData={currentSongData}
          onImportSong={handleImportSong}
          onExportAudioWav={() => handleToggleSongRecord()}
        />

        <VoiceRecorderModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          onSampleSaved={handleVoiceSampleSaved}
        />

        <RhythmGameModal
          isOpen={isRhythmGameOpen}
          onClose={() => setIsRhythmGameOpen(false)}
        />

        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          audioBlob={recordedSongBlob}
        />

        <SheetMusicModal
          isOpen={isSheetMusicOpen}
          onClose={() => setIsSheetMusicOpen(false)}
          bpm={bpm}
          totalMeasures={totalMeasures}
          totalStepsInMeasure={totalStepsInMeasure}
          tracks={tracks}
          melodyTracks={melodyTracks}
          melodyInstrument={melodyInstrument}
          bassTracks={bassTracks}
          bassInstrument={bassInstrument}
        />

        <SecretLightShowModal
          isOpen={isSecretLightShowOpen}
          onClose={() => setIsSecretLightShowOpen(false)}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          bpm={bpm}
          onChangeBpm={setBpm}
          currentStep={currentStep}
          totalStepsInMeasure={totalStepsInMeasure}
          totalMeasures={totalMeasures}
          tracks={tracks}
          melodyTracks={melodyTracks}
          bassTracks={bassTracks}
        />

        {/* Save Beat Modal */}
        {isSaveBeatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-md rounded-3xl border-3 border-amber-400 bg-slate-900 p-6 text-white shadow-2xl">
              <button
                type="button"
                onClick={() => setIsSaveBeatModalOpen(false)}
                className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-teal-400 text-2xl flex items-center justify-center shadow-lg text-slate-950">
                  ☁️
                </div>
                <div>
                  <h3 className="text-xl font-black font-['Fredoka',sans-serif] text-white">
                    Save Your Beat
                  </h3>
                  <p className="text-xs text-slate-300">
                    Saving to <strong>{studentSession?.firstName}</strong>&apos;s cloud account
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Beat Title / Song Name
                </label>
                <input
                  type="text"
                  value={beatTitleInput}
                  onChange={(e) => setBeatTitleInput(e.target.value)}
                  placeholder="e.g. Space Robot Funk, Lunchtime Jam..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-sm font-bold text-white focus:outline-hidden"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400">
                  Your beat will save to your Music Lab account and can be loaded anytime!
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSaveBeatModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveBeat}
                  disabled={isSavingBeat || !beatTitleInput.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer disabled:opacity-50 flex items-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingBeat ? 'Saving...' : 'Save Beat Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
