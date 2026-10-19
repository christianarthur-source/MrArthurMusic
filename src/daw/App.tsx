import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Cloud,
  Download,
  HelpCircle,
  Music,
  Plus,
  Sliders,
  Sparkles,
  UserCheck,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  DawClip,
  DawFxSettings,
  DawLoopItem,
  DawMidiNote,
  DawProject,
  DawSnapGrid,
  DawTrack,
  DEFAULT_DAW_FX,
  TRACK_COLOR_PALETTE,
} from './types';
import { dawAudioEngine } from './audio/dawAudioEngine';
import { decodeUploadedAudio, getOrGenerateLoopAudio } from './audio/loopGenerator';
import { dawMidiManager } from './audio/midiManager';
import { TransportBar } from './components/TransportBar';
import { TrackHeaderList } from './components/TrackHeaderList';
import { TimelineArranger } from './components/TimelineArranger';
import { LoopBrowser } from './components/LoopBrowser';
import { PianoRollModal } from './components/PianoRollModal';
import { MixerModal } from './components/MixerModal';
import { InstrumentPickerModal, DawInstrumentOption } from './components/InstrumentPickerModal';
import { VirtualPianoKeyboard } from './components/VirtualPianoKeyboard';
import {
  saveStudentProject,
  StudentSession,
} from '../utils/classroomApi';
import { containsProfanity } from '../utils/profanityFilter';
import { soundEngine } from '../audio/soundEngine';

interface DawAppProps {
  onBackToHub: () => void;
  studentSession: StudentSession | null;
  loadedProjectData?: any;
  onClearLoadedProjectData?: () => void;
  currentProjectId: string | null;
  onProjectSaved?: (projectId: string) => void;
  onOpenClassroomModal: () => void;
  onOpenAvatar: () => void;
}

const DEFAULT_DAW_PROJECT: DawProject = {
  id: 'proj_new',
  title: 'My Studio Beat',
  bpm: 120,
  timeSignature: [4, 4],
  masterVolume: 1.0,
  snapGrid: '1bar',
  loopRegion: {
    enabled: false,
    startBeat: 0,
    endBeat: 16,
  },
  tracks: [
    {
      id: 'track_drums',
      name: 'Drums',
      type: 'audio',
      color: '#F59E0B',
      icon: '🥁',
      muted: false,
      solo: false,
      armRecord: true,
      clips: [],
      fx: { ...DEFAULT_DAW_FX },
    },
    {
      id: 'track_bass',
      name: 'Bass',
      type: 'audio',
      color: '#EC4899',
      icon: '🎸',
      muted: false,
      solo: false,
      armRecord: false,
      clips: [],
      fx: { ...DEFAULT_DAW_FX },
    },
    {
      id: 'track_chords',
      name: 'Keys & Chords',
      type: 'instrument',
      color: '#38BDF8',
      icon: '🎹',
      muted: false,
      solo: false,
      armRecord: false,
      instrumentId: 'piano_treble',
      clips: [],
      fx: { ...DEFAULT_DAW_FX },
    },
    {
      id: 'track_vocals',
      name: 'Lead / Vocal',
      type: 'audio',
      color: '#10B981',
      icon: '🎤',
      muted: false,
      solo: false,
      armRecord: false,
      clips: [],
      fx: { ...DEFAULT_DAW_FX },
    },
  ],
};

export const DawApp: React.FC<DawAppProps> = ({
  onBackToHub,
  studentSession,
  loadedProjectData,
  onClearLoadedProjectData,
  currentProjectId,
  onProjectSaved,
  onOpenClassroomModal,
  onOpenAvatar,
}) => {
  const [project, setProject] = useState<DawProject>(() => {
    if (loadedProjectData && loadedProjectData.tracks) {
      return {
        ...DEFAULT_DAW_PROJECT,
        ...loadedProjectData,
        loopRegion: { ...DEFAULT_DAW_PROJECT.loopRegion, ...(loadedProjectData.loopRegion || {}) },
        tracks: (loadedProjectData.tracks || []).map((t: any) => ({
          ...t,
          clips: (t.clips || []).map((c: any) => ({ ...c })),
          fx: { ...DEFAULT_DAW_FX, ...(t.fx || {}) },
        })),
      };
    }
    return DEFAULT_DAW_PROJECT;
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(currentProjectId);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(project.tracks[0]?.id || null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clipClipboard, setClipClipboard] = useState<DawClip | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'loops' | 'virtual-piano' | 'piano-roll' | 'mixer' | null>('loops');
  const [activePianoRollClipId, setActivePianoRollClipId] = useState<string | null>(null);

  // Virtual Instrument Selection Modal
  const [isInstrumentPickerOpen, setIsInstrumentPickerOpen] = useState<boolean>(false);
  const [instrumentPickerTrackId, setInstrumentPickerTrackId] = useState<string | null>(null);

  // Cloud Save Modal & Notifications
  const [isCloudSaveOpen, setIsCloudSaveOpen] = useState<boolean>(false);
  const [saveTitleInput, setSaveTitleInput] = useState<string>(project.title);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Undo / Redo history stacks
  const historyRef = useRef<DawProject[]>([]);
  const redoRef = useRef<DawProject[]>([]);

  const pushState = useCallback((nextProject: DawProject) => {
    historyRef.current.push(project);
    redoRef.current = [];
    setProject(nextProject);
  }, [project]);

  // Load project passed from Classroom Saved Songs list
  useEffect(() => {
    if (loadedProjectData && loadedProjectData.tracks) {
      const merged: DawProject = {
        ...DEFAULT_DAW_PROJECT,
        ...loadedProjectData,
        loopRegion: { ...DEFAULT_DAW_PROJECT.loopRegion, ...(loadedProjectData.loopRegion || {}) },
        tracks: (loadedProjectData.tracks || []).map((t: any) => ({
          ...t,
          clips: (t.clips || []).map((c: any) => ({ ...c })),
          fx: { ...DEFAULT_DAW_FX, ...(t.fx || {}) },
        })),
      };
      setProject(merged);
      setSaveTitleInput(merged.title || 'My Studio Beat');
      setNotification(`🎉 Loaded "${merged.title || 'Studio Song'}" into DAW! 🎛️`);
      setTimeout(() => setNotification(null), 4000);
      if (onClearLoadedProjectData) {
        onClearLoadedProjectData();
      }
    }
  }, [loadedProjectData, onClearLoadedProjectData]);

  // Sync Audio Engine Playhead
  useEffect(() => {
    dawAudioEngine.onPlayheadTick = (b) => {
      setCurrentBeat(b);
    };
    dawAudioEngine.onPlaybackEnded = () => {
      setIsPlaying(false);
      setCurrentBeat(0);
    };

    // Initialize Web MIDI listeners
    dawMidiManager.init().catch(() => {});

    return () => {
      dawAudioEngine.stop();
    };
  }, []);

  // Sync track channel strip volumes / FX whenever project changes
  useEffect(() => {
    dawAudioEngine.syncTracks(project.tracks, project.masterVolume);
  }, [project.tracks, project.masterVolume]);

  // Play / Pause toggle
  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      dawAudioEngine.pause();
      setIsPlaying(false);
    } else {
      dawAudioEngine.play(project);
      setIsPlaying(true);
    }
  }, [isPlaying, project]);

  const handleStop = useCallback(() => {
    dawAudioEngine.stop();
    setIsPlaying(false);
    setCurrentBeat(0);
  }, []);

  const handleSeek = useCallback((beat: number) => {
    dawAudioEngine.seek(beat);
    setCurrentBeat(beat);
    if (isPlaying) {
      dawAudioEngine.play(project);
    }
  }, [isPlaying, project]);

  // Move clip (beat position and track)
  const handleMoveClip = useCallback((clipId: string, newStartBeat: number, newTrackId?: string) => {
    let clipToMove: DawClip | null = null;
    let fromTrackId: string | null = null;

    for (const t of project.tracks) {
      const found = t.clips.find((c) => c.id === clipId);
      if (found) {
        clipToMove = found;
        fromTrackId = t.id;
        break;
      }
    }

    if (!clipToMove) return;
    const targetTrackId = newTrackId || fromTrackId;

    if (targetTrackId === fromTrackId) {
      const nextTracks = project.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.id === clipId ? { ...c, startBeat: Math.max(0, newStartBeat) } : c)),
      }));
      setProject((prev) => ({ ...prev, tracks: nextTracks }));
    } else {
      const targetTrack = project.tracks.find((t) => t.id === targetTrackId);
      if (!targetTrack) return;

      const updatedClip: DawClip = {
        ...clipToMove,
        trackId: targetTrackId,
        startBeat: Math.max(0, newStartBeat),
        color: targetTrack.color,
      };

      const nextTracks = project.tracks.map((t) => {
        if (t.id === fromTrackId) {
          return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
        }
        if (t.id === targetTrackId) {
          return { ...t, clips: [...t.clips, updatedClip] };
        }
        return t;
      });
      setProject((prev) => ({ ...prev, tracks: nextTracks }));
    }
  }, [project.tracks]);

  // Trim clip
  const handleTrimClip = useCallback((clipId: string, newStartBeat: number, newDurationBeats: number) => {
    const nextTracks = project.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) =>
        c.id === clipId ? { ...c, startBeat: newStartBeat, durationBeats: newDurationBeats } : c
      ),
    }));
    setProject((prev) => ({ ...prev, tracks: nextTracks }));
  }, [project.tracks]);

  // Delete clip
  const handleDeleteClip = useCallback((clipId: string) => {
    const nextTracks = project.tracks.map((t) => ({
      ...t,
      clips: t.clips.filter((c) => c.id !== clipId),
    }));
    pushState({ ...project, tracks: nextTracks });
    if (selectedClipId === clipId) setSelectedClipId(null);
  }, [project, pushState, selectedClipId]);

  // Copy clip to clipboard
  const handleCopyClip = useCallback(
    (clipId: string) => {
      for (const t of project.tracks) {
        const c = t.clips.find((clip) => clip.id === clipId);
        if (c) {
          setClipClipboard({ ...c });
          setNotification(`Copied "${c.name}" to clipboard 📋`);
          setTimeout(() => setNotification(null), 2000);
          return;
        }
      }
    },
    [project.tracks]
  );

  // Cut clip
  const handleCutClip = useCallback(
    (clipId: string) => {
      handleCopyClip(clipId);
      handleDeleteClip(clipId);
      setNotification('Cut clip ✂️');
      setTimeout(() => setNotification(null), 2000);
    },
    [handleCopyClip, handleDeleteClip]
  );

  // Duplicate clip
  const handleDuplicateClip = useCallback((clipId: string) => {
    let duplicated = false;
    const nextTracks = project.tracks.map((t) => {
      const clip = t.clips.find((c) => c.id === clipId);
      if (!clip) return t;

      const newClip: DawClip = {
        ...clip,
        id: `clip_${Date.now()}_dup`,
        startBeat: clip.startBeat + clip.durationBeats,
      };
      duplicated = true;
      return { ...t, clips: [...t.clips, newClip] };
    });

    if (duplicated) {
      pushState({ ...project, tracks: nextTracks });
      setNotification('Duplicated clip! 📋');
      setTimeout(() => setNotification(null), 2500);
    }
  }, [project, pushState]);

  // Split clip at playhead
  const handleSplitClip = useCallback((clipId: string, splitBeat: number) => {
    let splitted = false;
    const nextTracks = project.tracks.map((t) => {
      const clipIdx = t.clips.findIndex((c) => c.id === clipId);
      if (clipIdx === -1) return t;

      const orig = t.clips[clipIdx];
      const firstDur = splitBeat - orig.startBeat;
      const secondDur = orig.durationBeats - firstDur;
      if (firstDur <= 0.25 || secondDur <= 0.25) return t;

      const firstClip: DawClip = { ...orig, durationBeats: firstDur };
      const secondClip: DawClip = {
        ...orig,
        id: `clip_${Date.now()}_split`,
        startBeat: splitBeat,
        durationBeats: secondDur,
        name: `${orig.name} (Part 2)`,
      };

      splitted = true;
      const newClips = [...t.clips];
      newClips.splice(clipIdx, 1, firstClip, secondClip);
      return { ...t, clips: newClips };
    });

    if (splitted) {
      pushState({ ...project, tracks: nextTracks });
      setNotification('Sliced clip into two parts! ✂️');
      setTimeout(() => setNotification(null), 2500);
    }
  }, [project, pushState]);

  // Paste clip at current playhead
  const handlePasteClip = useCallback(() => {
    if (!clipClipboard) {
      setNotification('Clipboard is empty! Select a clip to copy first.');
      setTimeout(() => setNotification(null), 2000);
      return;
    }

    let targetTrack = project.tracks.find((t) => t.id === selectedTrackId);
    if (!targetTrack) {
      targetTrack = project.tracks.find((t) => t.id === clipClipboard.trackId) || project.tracks[0];
    }

    const pasteBeat = Math.max(0, Math.round(currentBeat));
    const pastedClip: DawClip = {
      ...clipClipboard,
      id: `clip_${Date.now()}_paste`,
      trackId: targetTrack.id,
      startBeat: pasteBeat,
    };

    const nextTracks = project.tracks.map((t) =>
      t.id === targetTrack!.id ? { ...t, clips: [...t.clips, pastedClip] } : t
    );

    pushState({ ...project, tracks: nextTracks });
    setSelectedClipId(pastedClip.id);
    setNotification(`Pasted "${pastedClip.name}" at Bar ${Math.floor(pasteBeat / 4) + 1}! 📥`);
    setTimeout(() => setNotification(null), 2500);
  }, [clipClipboard, currentBeat, project, pushState, selectedTrackId]);

  // Keyboard shortcuts: Spacebar, Copy, Cut, Paste, Duplicate, Delete, Split
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Space: Toggle Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
        return;
      }

      // Cmd / Ctrl combinations
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl) {
        if (e.key === 'c' || e.key === 'C') {
          if (selectedClipId) {
            e.preventDefault();
            handleCopyClip(selectedClipId);
          }
        } else if (e.key === 'x' || e.key === 'X') {
          if (selectedClipId) {
            e.preventDefault();
            handleCutClip(selectedClipId);
          }
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          handlePasteClip();
        } else if (e.key === 'd' || e.key === 'D') {
          if (selectedClipId) {
            e.preventDefault();
            handleDuplicateClip(selectedClipId);
          }
        }
        return;
      }

      // Single key actions on selected clip
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          handleDeleteClip(selectedClipId);
          setNotification('Deleted clip 🗑️');
          setTimeout(() => setNotification(null), 2000);
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (selectedClipId) {
          e.preventDefault();
          handleSplitClip(selectedClipId, currentBeat);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentBeat,
    handleCopyClip,
    handleCutClip,
    handleDuplicateClip,
    handleDeleteClip,
    handlePasteClip,
    handleSplitClip,
    handleTogglePlay,
    selectedClipId,
  ]);


  // Add loop from loop browser to project timeline
  const handleAddLoopToTimeline = (loop: DawLoopItem, buffer: AudioBuffer, waveform: number[]) => {
    // Find armed audio track or default to first audio track
    let targetTrack = project.tracks.find((t) => t.armRecord && t.type === 'audio');
    if (!targetTrack) {
      targetTrack = project.tracks.find((t) => t.type === 'audio');
    }
    if (!targetTrack) {
      targetTrack = project.tracks[0];
    }

    const newClip: DawClip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      trackId: targetTrack.id,
      name: loop.name,
      type: 'audio',
      startBeat: Math.round(currentBeat),
      durationBeats: loop.durationBeats,
      color: loop.color,
      loopId: loop.id,
      audioBuffer: buffer,
      waveform,
      isLooping: true,
      gain: 1.0,
    };

    const nextTracks = project.tracks.map((t) => {
      if (t.id === targetTrack!.id) {
        return { ...t, clips: [...t.clips, newClip] };
      }
      return t;
    });

    pushState({ ...project, tracks: nextTracks });
    setSelectedClipId(newClip.id);
    setNotification(`Added "${loop.name}" to ${targetTrack.name}! 🎵`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Upload custom audio file
  const handleUploadAudioFile = async (file: File) => {
    try {
      const audioCtx = dawAudioEngine.ensureContext();
      const { buffer, waveform, durationBeats } = await decodeUploadedAudio(file, audioCtx);

      const targetTrack = project.tracks.find((t) => t.type === 'audio') || project.tracks[0];
      const clipName = file.name.replace(/\.[^/.]+$/, '');

      const newClip: DawClip = {
        id: `clip_${Date.now()}`,
        trackId: targetTrack.id,
        name: clipName,
        type: 'audio',
        startBeat: Math.round(currentBeat),
        durationBeats,
        color: '#06B6D4',
        audioBuffer: buffer,
        waveform,
        gain: 1.0,
      };

      const nextTracks = project.tracks.map((t) => {
        if (t.id === targetTrack.id) {
          return { ...t, clips: [...t.clips, newClip] };
        }
        return t;
      });

      pushState({ ...project, tracks: nextTracks });
      setSelectedClipId(newClip.id);
      setNotification(`Imported "${clipName}"! 📁`);
      setTimeout(() => setNotification(null), 3500);
    } catch {
      setNotification('Could not read audio file. Please try a WAV or MP3.');
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Add Track
  const handleAddTrack = (type: 'audio' | 'instrument') => {
    if (type === 'instrument') {
      // Prompt instrument selection menu
      setInstrumentPickerTrackId(null);
      setIsInstrumentPickerOpen(true);
      return;
    }

    const color = TRACK_COLOR_PALETTE[project.tracks.length % TRACK_COLOR_PALETTE.length];
    const newTrack: DawTrack = {
      id: `track_${Date.now()}`,
      name: `Audio Track ${project.tracks.length + 1}`,
      type: 'audio',
      color,
      icon: '🎧',
      muted: false,
      solo: false,
      armRecord: false,
      clips: [],
      fx: { ...DEFAULT_DAW_FX },
    };

    pushState({ ...project, tracks: [...project.tracks, newTrack] });
    setSelectedTrackId(newTrack.id);
  };

  // Confirm instrument selection from modal
  const handleSelectInstrument = (inst: DawInstrumentOption) => {
    if (instrumentPickerTrackId) {
      // Changing instrument on existing track
      const nextTracks = project.tracks.map((t) =>
        t.id === instrumentPickerTrackId
          ? {
              ...t,
              instrumentId: inst.id,
              name: inst.name,
              icon: inst.icon,
            }
          : t
      );
      pushState({ ...project, tracks: nextTracks });
      setNotification(`Changed track sound to ${inst.name}! 🎹`);
    } else {
      // Creating a new virtual instrument track
      const color = TRACK_COLOR_PALETTE[project.tracks.length % TRACK_COLOR_PALETTE.length];
      const newTrack: DawTrack = {
        id: `track_${Date.now()}`,
        name: inst.name,
        type: 'instrument',
        color,
        icon: inst.icon,
        muted: false,
        solo: false,
        armRecord: true,
        instrumentId: inst.id,
        clips: [],
        fx: { ...DEFAULT_DAW_FX },
      };

      pushState({ ...project, tracks: [...project.tracks, newTrack] });
      setSelectedTrackId(newTrack.id);
      setActiveDrawerTab('virtual-piano');
      setNotification(`Added "${inst.name}" track! You can play it live with your keyboard. 🎹`);
    }

    setTimeout(() => setNotification(null), 3500);
    setIsInstrumentPickerOpen(false);
    setInstrumentPickerTrackId(null);
  };

  // Live note recording from Virtual Piano Keyboard
  const handleRecordPianoNote = (noteData: {
    midi: number;
    pitch: Pitch;
    startBeat: number;
    durationBeats: number;
  }) => {
    const armedTrack =
      project.tracks.find((t) => t.armRecord && t.type === 'instrument') ||
      project.tracks.find((t) => t.id === selectedTrackId && t.type === 'instrument') ||
      project.tracks.find((t) => t.type === 'instrument');

    if (!armedTrack) return;

    // Check if an existing MIDI clip covers this beat
    const targetClip = armedTrack.clips.find(
      (c) => noteData.startBeat >= c.startBeat && noteData.startBeat < c.startBeat + c.durationBeats
    );

    if (targetClip) {
      const newNote: DawMidiNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        midi: noteData.midi,
        startBeat: Math.max(0, noteData.startBeat - targetClip.startBeat),
        durationBeats: noteData.durationBeats,
        velocity: 0.85,
      };

      const updatedClips = armedTrack.clips.map((c) =>
        c.id === targetClip.id ? { ...c, midiNotes: [...(c.midiNotes || []), newNote] } : c
      );

      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === armedTrack.id ? { ...t, clips: updatedClips } : t)),
      }));
    } else {
      // Create a 4-bar MIDI clip
      const clipStart = Math.floor(noteData.startBeat / 4) * 4;
      const newClip: DawClip = {
        id: `midi_${Date.now()}`,
        trackId: armedTrack.id,
        name: `${armedTrack.name} Live Take`,
        type: 'midi',
        startBeat: clipStart,
        durationBeats: 8,
        color: armedTrack.color,
        midiNotes: [
          {
            id: `note_${Date.now()}`,
            midi: noteData.midi,
            startBeat: Math.max(0, noteData.startBeat - clipStart),
            durationBeats: noteData.durationBeats,
            velocity: 0.85,
          },
        ],
      };

      const nextTracks = project.tracks.map((t) =>
        t.id === armedTrack.id ? { ...t, clips: [...t.clips, newClip] } : t
      );
      pushState({ ...project, tracks: nextTracks });
      setSelectedClipId(newClip.id);
    }
  };

  // Delete Track
  const handleDeleteTrack = (trackId: string) => {
    if (project.tracks.length <= 1) return;
    const nextTracks = project.tracks.filter((t) => t.id !== trackId);
    pushState({ ...project, tracks: nextTracks });
    if (selectedTrackId === trackId) setSelectedTrackId(nextTracks[0].id);
  };

  // Toggle Mute / Solo / Arm
  const handleToggleMute = (trackId: string) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
    }));
  };

  const handleToggleSolo = (trackId: string) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, solo: !t.solo } : t)),
    }));
  };

  const handleToggleArmRecord = (trackId: string) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, armRecord: !t.armRecord } : { ...t, armRecord: false }
      ),
    }));
  };

  // Update track volume & pan
  const handleChangeVolume = (trackId: string, volume: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, fx: { ...t.fx, volume } } : t)),
    }));
  };

  const handleChangePan = (trackId: string, pan: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, fx: { ...t.fx, pan } } : t)),
    }));
  };

  const handleChangeTrackName = (trackId: string, name: string) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, name } : t)),
    }));
  };

  // Update track FX
  const handleUpdateTrackFx = (trackId: string, fxDelta: Partial<DawFxSettings>) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, fx: { ...t.fx, ...fxDelta } } : t
      ),
    }));
  };

  // Mic Recording
  const handleToggleRecord = async () => {
    if (!isRecording) {
      try {
        await dawAudioEngine.startMicRecording();
        setIsRecording(true);
        handleTogglePlay();
        setNotification('Recording microphone onto armed track... 🎙️');
      } catch {
        setNotification('Microphone access blocked or unavailable.');
        setTimeout(() => setNotification(null), 3500);
      }
    } else {
      setIsRecording(false);
      handleStop();
      try {
        const { buffer } = await dawAudioEngine.stopMicRecording();
        const waveform = [0.2, 0.5, 0.8, 0.4, 0.9, 0.3, 0.6, 0.2];

        const armedTrack = project.tracks.find((t) => t.armRecord) || project.tracks[0];
        const newClip: DawClip = {
          id: `mic_${Date.now()}`,
          trackId: armedTrack.id,
          name: 'Mic Recording 🎙️',
          type: 'audio',
          startBeat: Math.round(currentBeat),
          durationBeats: Math.max(2, Math.round(buffer.duration * (project.bpm / 60))),
          color: '#F43F5E',
          audioBuffer: buffer,
          waveform,
          gain: 1.0,
        };

        const nextTracks = project.tracks.map((t) =>
          t.id === armedTrack.id ? { ...t, clips: [...t.clips, newClip] } : t
        );
        pushState({ ...project, tracks: nextTracks });
        setNotification('Recorded audio added to timeline! 🎤');
        setTimeout(() => setNotification(null), 3000);
      } catch {
        // fail-safe
      }
    }
  };

  // Export song to WAV
  const handleExportWav = async () => {
    setNotification('Exporting stereo WAV mixdown... 📥');
    try {
      const blob = await dawAudioEngine.exportToWav(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Mix.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setNotification('WAV file downloaded successfully! 🎉');
      setTimeout(() => setNotification(null), 3500);
    } catch {
      setNotification('Could not export audio mixdown.');
      setTimeout(() => setNotification(null), 3500);
    }
  };

  // Cloud Save
  const handleSaveToCloud = async () => {
    if (!studentSession) {
      onOpenClassroomModal();
      return;
    }

    const cleanTitle = (saveTitleInput || project.title || 'My Studio Song').trim();
    if (containsProfanity(cleanTitle)) {
      setNotification('Please use school-appropriate words in the song title.');
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    setIsSaving(true);
    const updatedProject = { ...project, title: cleanTitle };
    setProject(updatedProject);

    try {
      const res = await saveStudentProject({
        studentId: studentSession.id,
        pin: studentSession.pin,
        projectId: activeProjectId,
        title: cleanTitle,
        appType: 'daw',
        projectData: updatedProject,
      });

      if (res.saved && res.project) {
        setActiveProjectId(res.project.id);
        if (onProjectSaved) onProjectSaved(res.project.id);
        setIsCloudSaveOpen(false);
        soundEngine.playWelcomeChime();
        setNotification(`Song "${cleanTitle}" saved to your student account! ☁️`);
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      setNotification('Could not save song. Please check your connection.');
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const activeClipForPianoRoll =
    project.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === activePianoRollClipId) || null;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans select-none">
      {/* ========================================================
          TOP HEADER BAR
          ======================================================== */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 text-white shadow-lg sticky top-0 z-40 flex-wrap">
        {/* Left: Back to Hub & Mr. Arthur Avatar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Music Lab Hub</span>
          </button>

          <button
            type="button"
            onClick={onOpenAvatar}
            className="w-9 h-9 rounded-xl bg-slate-950 overflow-hidden flex items-center justify-center shadow-md ring-2 ring-amber-300/60 hover:scale-105 active:scale-95 transition-all select-none shrink-0 cursor-pointer"
            title="Click to view Mr. Arthur"
          >
            <img
              src="/mr-arthur-avatar.jpg"
              alt="Mr. Arthur"
              className="w-full h-full object-cover object-top"
            />
          </button>

          <div className="flex flex-col select-none">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-amber-300/95 font-['Fredoka',sans-serif] leading-tight">
              Studio DAW
            </span>
            <input
              type="text"
              value={project.title}
              onChange={(e) => {
                const newTitle = e.target.value;
                setProject((prev) => ({ ...prev, title: newTitle }));
                setSaveTitleInput(newTitle);
              }}
              className="text-base sm:text-lg font-black text-white bg-transparent focus:outline-none focus:bg-slate-950/80 px-1 rounded-sm font-['Fredoka',sans-serif] leading-none"
              placeholder="Untitled Studio Song"
            />
          </div>
        </div>

        {/* Right: Student Sign-in & Help */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenClassroomModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
              studentSession
                ? 'bg-sky-500/20 border-sky-400/60 text-sky-300 hover:bg-sky-500/30'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{studentSession ? studentSession.firstName : 'Student Sign In'}</span>
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-900 border-2 border-amber-400 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* ========================================================
          DAW TRANSPORT & CONTROLS
          ======================================================== */}
      <TransportBar
        project={project}
        isPlaying={isPlaying}
        currentBeat={currentBeat}
        isRecording={isRecording}
        activeDrawerTab={activeDrawerTab}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onToggleRecord={handleToggleRecord}
        onChangeBpm={(b) => setProject((prev) => ({ ...prev, bpm: b }))}
        onChangeSnapGrid={(snap) => setProject((prev) => ({ ...prev, snapGrid: snap }))}
        onToggleLoopRegion={() =>
          setProject((prev) => ({
            ...prev,
            loopRegion: { ...prev.loopRegion, enabled: !prev.loopRegion.enabled },
          }))
        }
        onToggleDrawerTab={(tab) =>
          setActiveDrawerTab((curr) => (curr === tab ? null : tab))
        }
        onSaveProject={() => {
          if (!studentSession) {
            onOpenClassroomModal();
          } else {
            setIsCloudSaveOpen(true);
          }
        }}
        onExportWav={handleExportWav}
        canUndo={historyRef.current.length > 0}
        canRedo={redoRef.current.length > 0}
        onUndo={() => {
          if (historyRef.current.length === 0) return;
          const previous = historyRef.current.pop()!;
          redoRef.current.push(project);
          setProject(previous);
        }}
        onRedo={() => {
          if (redoRef.current.length === 0) return;
          const next = redoRef.current.pop()!;
          historyRef.current.push(project);
          setProject(next);
        }}
        isSaving={isSaving}
      />

      {/* ========================================================
          MAIN WORK AREA: Track Headers (Left) + Timeline (Right)
          ======================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        <TrackHeaderList
          tracks={project.tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={(id) => setSelectedTrackId(id)}
          onToggleMute={handleToggleMute}
          onToggleSolo={handleToggleSolo}
          onToggleArmRecord={handleToggleArmRecord}
          onChangeVolume={handleChangeVolume}
          onChangePan={handleChangePan}
          onChangeTrackName={handleChangeTrackName}
          onAddTrack={handleAddTrack}
          onDeleteTrack={handleDeleteTrack}
          onChangeInstrument={(trackId) => {
            setInstrumentPickerTrackId(trackId);
            setIsInstrumentPickerOpen(true);
          }}
        />

        <TimelineArranger
          project={project}
          currentBeat={currentBeat}
          selectedClipId={selectedClipId}
          onSelectClip={(id) => setSelectedClipId(id)}
          onSeek={handleSeek}
          onMoveClip={handleMoveClip}
          onTrimClip={handleTrimClip}
          onSplitClip={handleSplitClip}
          onDuplicateClip={handleDuplicateClip}
          onDeleteClip={handleDeleteClip}
          onCopyClip={handleCopyClip}
          onCutClip={handleCutClip}
          onPasteClip={handlePasteClip}
          canPaste={!!clipClipboard}
          onOpenPianoRollForClip={(id) => {
            setActivePianoRollClipId(id);
            setActiveDrawerTab('piano-roll');
          }}
        />
      </div>

      {/* ========================================================
          BOTTOM DOCKABLE DRAWER (Loops / Piano Roll / Mixer / Virtual Piano)
          ======================================================== */}
      {activeDrawerTab === 'loops' && (
        <LoopBrowser
          audioCtx={dawAudioEngine.ensureContext()}
          onAddLoopToTimeline={handleAddLoopToTimeline}
          onUploadAudioFile={handleUploadAudioFile}
          onClose={() => setActiveDrawerTab(null)}
        />
      )}

      {activeDrawerTab === 'virtual-piano' && (() => {
        const activeInstrumentTrack =
          project.tracks.find((t) => t.id === selectedTrackId && t.type === 'instrument') ||
          project.tracks.find((t) => t.armRecord && t.type === 'instrument') ||
          project.tracks.find((t) => t.type === 'instrument') ||
          project.tracks[0];

        return (
          <VirtualPianoKeyboard
            currentInstrumentId={activeInstrumentTrack?.instrumentId || 'piano_treble'}
            trackName={activeInstrumentTrack?.name}
            isRecording={isRecording}
            currentBeat={currentBeat}
            onOpenInstrumentPicker={() => {
              setInstrumentPickerTrackId(activeInstrumentTrack?.id || null);
              setIsInstrumentPickerOpen(true);
            }}
            onRecordNote={handleRecordPianoNote}
            onClose={() => setActiveDrawerTab(null)}
          />
        );
      })()}

      {activeDrawerTab === 'piano-roll' && (
        <PianoRollModal
          clip={activeClipForPianoRoll}
          onUpdateClipNotes={(clipId, notes) => {
            const nextTracks = project.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, midiNotes: notes } : c)),
            }));
            setProject((prev) => ({ ...prev, tracks: nextTracks }));
          }}
          onClose={() => setActiveDrawerTab(null)}
        />
      )}

      {activeDrawerTab === 'mixer' && (
        <MixerModal
          project={project}
          onUpdateTrackFx={handleUpdateTrackFx}
          onUpdateMasterVolume={(vol) => setProject((prev) => ({ ...prev, masterVolume: vol }))}
          onClose={() => setActiveDrawerTab(null)}
        />
      )}

      {/* ========================================================
          VIRTUAL INSTRUMENT PICKER MODAL
          ======================================================== */}
      {isInstrumentPickerOpen && (
        <InstrumentPickerModal
          currentInstrumentId={
            project.tracks.find((t) => t.id === instrumentPickerTrackId)?.instrumentId || 'piano_treble'
          }
          onSelect={handleSelectInstrument}
          onClose={() => {
            setIsInstrumentPickerOpen(false);
            setInstrumentPickerTrackId(null);
          }}
          title={instrumentPickerTrackId ? 'Change Track Instrument' : 'Add Virtual Instrument Track'}
        />
      )}

      {/* ========================================================
          CLOUD SAVE MODAL
          ======================================================== */}
      {isCloudSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border-2 border-emerald-400 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-2xl">
                ☁️
              </div>
              <div>
                <h3 className="text-xl font-black text-white font-['Fredoka',sans-serif]">
                  Save Song to Classroom
                </h3>
                <p className="text-xs text-slate-400">
                  Saving under student: <strong>{studentSession?.firstName}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Song Title</label>
              <input
                type="text"
                value={saveTitleInput}
                onChange={(e) => setSaveTitleInput(e.target.value)}
                placeholder="Give your song a cool title..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCloudSaveOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveToCloud}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer shadow-md font-['Fredoka',sans-serif]"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Song'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
