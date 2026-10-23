import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AccidentalType,
  ArticulationType,
  CountingMode,
  DynamicMarking,
  InstrumentDefinition,
  NoteDuration,
  NoteItem,
  NoteLabelMode,
  Pitch,
  Score,
  SelectionState,
  Track,
  UiMode,
  ViewLayout,
  VoltaEnding,
} from './types/music';
import { DEFAULT_BLANK_SCORE, createEmptyMeasure } from './data/templates';
import {
  getItemDuration,
  getMeasureCapacity,
  getSelectedMeasureIndices,
  insertNoteAtBeat,
  cleanMeasureRests,
  shiftPitchByDiatonicSteps,
  DIATONIC_STEP_ORDER,
  STEP_DIATONIC_OFFSET,
} from './utils/musicMath';
import { soundEngine } from './audio/soundEngine';
import { RhythmicPalette } from './components/RhythmicPalette';
import { TransportBar } from './components/TransportBar';
import { FullScreenMiniPalette } from './components/FullScreenMiniPalette';
import { ScoreRenderer } from './components/ScoreRenderer';
import { TrackStrip } from './components/TrackStrip';
import { VirtualPiano } from './components/VirtualPiano';
import { InstrumentModal } from './components/InstrumentModal';
import { DrumBeatsModal } from './components/DrumBeatsModal';
import { DrumGroove } from './data/drumGrooves';
import { TemplatesModal } from './components/TemplatesModal';
import { EnsembleTemplatesModal } from './components/EnsembleTemplatesModal';
import { HelpModal } from './components/HelpModal';
import { PrintView } from './components/PrintView';
import { ShareModal } from './components/ShareModal';
import { ClassroomModal } from './components/ClassroomModal';
import { EdLawPrivacyModal } from './components/EdLawPrivacyModal';
import { MusicLabLanding, MusicLabAppId } from './components/MusicLabLanding';
import { ClassroomToolBoxModal, ToolId } from './components/tools/ClassroomToolBoxModal';
import RhythmRockStarsApp from './rhythm-rockstars/RhythmRockStarsApp';
import BeatMachineApp from './beat-machine/App';
import { DawApp } from './daw/App';
import { StaffWarsApp } from './staff-wars/StaffWarsApp';
import { ShieldCheck } from 'lucide-react';
import {
  SavedProjectRecord,
  StudentSession,
  getSavedStudentSession,
  saveStudentProject,
  saveStudentSession,
} from './utils/classroomApi';
import { exportScoreToPdf } from './utils/pdfExport';
import { exportScoreToMidi, exportScoreToMusicXml } from './utils/scoreExport';
import { containsProfanity } from './utils/profanityFilter';
import { createShortLink, fetchShortLink } from './utils/shortLinkService';

function sanitizeLoadedScore(raw: Score): Score {
  const copy: Score = JSON.parse(JSON.stringify(raw));
  if (containsProfanity(copy.title || '')) {
    copy.title = 'My Composition';
  }
  if (containsProfanity(copy.composer || '')) {
    copy.composer = 'Student Composer';
  }
  if (Array.isArray(copy.tracks)) {
    copy.tracks.forEach((t, idx) => {
      if (containsProfanity(t.name || '')) {
        t.name = `Track ${idx + 1}`;
      }
      t.measures?.forEach((m) => {
        m.items?.forEach((it) => {
          if (it.lyric && containsProfanity(it.lyric)) {
            it.lyric = undefined;
          }
        });
      });
    });
  }
  return copy;
}

export default function App() {
  // Current active sub-application in Mr. Arthur's Music Lab
  const [currentApp, setCurrentApp] = useState<MusicLabAppId>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const appParam = params.get('app');
      if (
        appParam === 'staff-composer' ||
        appParam === 'rhythm-rockstars' ||
        appParam === 'beat-machine' ||
        appParam === 'daw' ||
        appParam === 'staff-wars'
      ) {
        return appParam;
      }
      // If a shared beat link is opened (?song=... or legacy long ?s=...)
      const sParam = params.get('s');
      if (params.get('song') || (sParam && sParam.length > 16)) {
        return 'beat-machine';
      }
      // If a shared DAW project link is opened (?project=... or ?daw=...)
      if (params.get('project') || params.get('daw')) {
        return 'daw';
      }
      // If a shared Staff Composer score link is opened (?share=... or ?score=...)
      if (params.get('share') || params.get('score')) {
        return 'staff-composer';
      }
      // Check hash fragment (#app=... or #song=... or #share=...)
      if (window.location.hash) {
        const hashContent = window.location.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hashContent);
        const hashApp = hashParams.get('app');
        if (
          hashApp === 'staff-composer' ||
          hashApp === 'rhythm-rockstars' ||
          hashApp === 'beat-machine' ||
          hashApp === 'daw' ||
          hashApp === 'staff-wars'
        ) {
          return hashApp;
        }
        const hashS = hashParams.get('s');
        if (hashParams.get('song') || (hashS && hashS.length > 16)) {
          return 'beat-machine';
        }
        if (hashParams.get('project') || hashParams.get('daw')) {
          return 'daw';
        }
        if (hashParams.get('share') || hashParams.get('score')) {
          return 'staff-composer';
        }
      }
    } catch {
      // ignore in SSR / restricted iframe
    }
    return 'hub';
  });

  // Score state (ALWAYS default to just a single treble clef staff with NO NOTES)
  const [score, setScore] = useState<Score>(() => JSON.parse(JSON.stringify(DEFAULT_BLANK_SCORE)));

  // Undo / Redo history
  const [history, setHistory] = useState<Score[]>([JSON.parse(JSON.stringify(DEFAULT_BLANK_SCORE))]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Selection state (itemIndex: -1 means full measure is selected)
  const [selection, setSelection] = useState<SelectionState | null>({
    trackIndex: 0,
    measureIndex: 0,
    itemIndex: 0,
  });

  // Cursor / Select mode (default to false so note addition works immediately upon clicking staff)
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);

  // Measure clipboard for copy/paste (supports multi-measure copy/paste)
  const [measureClipboard, setMeasureClipboard] = useState<NoteItem[][] | null>(null);

  // UI Mode: ALWAYS default to 'standard'
  const [uiMode, setUiMode] = useState<UiMode>('standard');

  // View Layout ('vertical' page view vs 'horizontal' auto-scroll view) & Full Screen state
  const [viewLayout, setViewLayout] = useState<ViewLayout>('vertical');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [fullScreenZoom, setFullScreenZoom] = useState<number>(1.35);

  // Profanity filter alert banner state
  const [profanityAlert, setProfanityAlert] = useState<string | null>(null);
  const profanityTimerRef = useRef<number | null>(null);

  const triggerProfanityAlert = useCallback((fieldLabel: string) => {
    setProfanityAlert(
      `School-appropriate language required: Inappropriate or suggestive words/phrases are not permitted in ${fieldLabel}.`
    );
    if (profanityTimerRef.current) {
      window.clearTimeout(profanityTimerRef.current);
    }
    profanityTimerRef.current = window.setTimeout(() => {
      setProfanityAlert(null);
    }, 4500);
  }, []);

  // Active palette modifiers
  const [activeDuration, setActiveDuration] = useState<NoteDuration>(0.25);
  const [isRestMode, setIsRestMode] = useState<boolean>(false);
  const [isDotted, setIsDotted] = useState<boolean>(false);
  const [isTied, setIsTied] = useState<boolean>(false);
  const [isTriplet, setIsTriplet] = useState<boolean>(false);
  const [activeAccidental, setActiveAccidental] = useState<AccidentalType>(null);
  const [activeArticulation, setActiveArticulation] = useState<ArticulationType>(null);
  const [activeDynamic, setActiveDynamic] = useState<DynamicMarking>(null);

  // Pedagogical options
  const [noteLabelMode, setNoteLabelMode] = useState<NoteLabelMode>('off');
  const [boomwhackerColors, setBoomwhackerColors] = useState<boolean>(false);
  const [countingMode, setCountingMode] = useState<CountingMode>('off');
  const showPitchNames = noteLabelMode !== 'off';
  const showBeatCounters = countingMode !== 'off';

  // Transport & Audio State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [metronome, setMetronome] = useState<boolean>(true);
  const [isLoopingMeasure, setIsLoopingMeasure] = useState<boolean>(false);
  const [playheadPosition, setPlayheadPosition] = useState<{
    measureIndex: number;
    beatFraction: number;
  } | null>(null);
  const [activePlayingNoteIds, setActivePlayingNoteIds] = useState<Set<string>>(new Set());

  // UI state
  const [isMixerOpen, setIsMixerOpen] = useState<boolean>(false);
  const [isPianoOpen, setIsPianoOpen] = useState<boolean>(false);
  const [isInstrumentModalOpen, setIsInstrumentModalOpen] = useState<boolean>(false);
  const [isDrumBeatsModalOpen, setIsDrumBeatsModalOpen] = useState<boolean>(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState<boolean>(false);
  const [isEnsembleTemplatesModalOpen, setIsEnsembleTemplatesModalOpen] = useState<boolean>(false);
  const [isToolBoxModalOpen, setIsToolBoxModalOpen] = useState<boolean>(false);
  const [toolBoxInitialTool, setToolBoxInitialTool] = useState<ToolId>('tempo-tapper');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isEdLawModalOpen, setIsEdLawModalOpen] = useState<boolean>(false);
  const [isPrintView, setIsPrintView] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState<boolean>(false);
  const [openInTeacherMode, setOpenInTeacherMode] = useState<boolean>(false);
  const [isAvatarOpen, setIsAvatarOpen] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>('just now');

  // Secret "adminbaby" keyboard shortcut tracking (only active when Mr. Arthur's avatar is enlarged)
  const adminKeyBufferRef = useRef<string>('');

  // Student Login & Teacher Project Editing State
  const [studentSession, setStudentSession] = useState<StudentSession | null>(() =>
    getSavedStudentSession()
  );
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [beatMachineLoadedSong, setBeatMachineLoadedSong] = useState<any>(null);
  const [dawLoadedProject, setDawLoadedProject] = useState<any>(null);
  const [editingAsTeacher, setEditingAsTeacher] = useState<{
    teacherPin: string;
    studentName: string;
    studentId: string;
  } | null>(null);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'untitled'
  >('idle');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync browser Fullscreen API state with isFullScreen
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isFullScreen]);

  const handleEnterFullScreen = useCallback(() => {
    setIsFullScreen(true);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // ignore if blocked by iframe permissions
    }
  }, []);

  const handleExitFullScreen = useCallback(() => {
    setIsFullScreen(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectApp = useCallback((app: MusicLabAppId) => {
    soundEngine.playWelcomeChime();
    try {
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        const nextUrl = app === 'hub' ? window.location.pathname : `${window.location.pathname}?app=${app}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {
      // ignore
    }
    setCurrentApp(app);
  }, []);

  const handleBackToHub = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {
      // ignore
    }
    setCurrentApp('hub');
  }, []);

  // Load shared score/song from URL query params or hash on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let hashParams: URLSearchParams | null = null;
    if (window.location.hash) {
      const hashContent = window.location.hash.replace(/^#/, '');
      hashParams = new URLSearchParams(hashContent);
    }

    const shortSlug = params.get('s') || params.get('link') || hashParams?.get('s') || hashParams?.get('link');

    // 1. If short slug is detected (<= 16 characters), fetch from Supabase
    if (shortSlug && shortSlug.trim().length <= 16) {
      fetchShortLink(shortSlug.trim()).then((record) => {
        if (!record || !record.payload) return;
        const app = record.app_type;
        if (app === 'beat-machine') {
          setBeatMachineLoadedSong(record.payload);
          setCurrentApp('beat-machine');
        } else if (app === 'daw') {
          setDawLoadedProject(record.payload);
          setCurrentApp('daw');
        } else {
          // Staff Composer
          const data = record.payload;
          if (data.score) {
            const cleanScore = sanitizeLoadedScore(data.score);
            setScore(cleanScore);
            setHistory([JSON.parse(JSON.stringify(cleanScore))]);
            setHistoryIndex(0);
          }
          if (data.uiMode) setUiMode(data.uiMode);
          if (data.viewLayout) setViewLayout(data.viewLayout);
          if (data.noteLabelMode) {
            setNoteLabelMode(data.noteLabelMode);
          } else if (data.showPitchNames !== undefined) {
            setNoteLabelMode(data.showPitchNames ? 'letters' : 'off');
          }
          if (data.boomwhackerColors !== undefined) setBoomwhackerColors(data.boomwhackerColors);
          if (data.countingMode) {
            setCountingMode(data.countingMode);
          } else if (data.showBeatCounters !== undefined) {
            setCountingMode(data.showBeatCounters ? 'numbers' : 'off');
          }
          if (data.metronome !== undefined) setMetronome(data.metronome);
          setCurrentApp('staff-composer');
        }
      }).catch((e) => {
        console.error('Failed to load short link', e);
      });
      return;
    }

    // 2. Legacy long Base64 URL parameter loading
    let shareParam = params.get('share') || params.get('score') || hashParams?.get('share') || hashParams?.get('score');
    if (shareParam) {
      // If someone passed short slug in share parameter
      if (shareParam.length <= 16) {
        fetchShortLink(shareParam).then((record) => {
          if (record?.payload?.score) {
            const cleanScore = sanitizeLoadedScore(record.payload.score);
            setScore(cleanScore);
            setHistory([JSON.parse(JSON.stringify(cleanScore))]);
            setHistoryIndex(0);
            setCurrentApp('staff-composer');
          }
        }).catch(() => {});
        return;
      }

      try {
        const jsonStr = decodeURIComponent(escape(atob(shareParam)));
        const data = JSON.parse(jsonStr);
        if (data.score) {
          const cleanScore = sanitizeLoadedScore(data.score);
          setScore(cleanScore);
          setHistory([JSON.parse(JSON.stringify(cleanScore))]);
          setHistoryIndex(0);
        }
        if (data.uiMode) setUiMode(data.uiMode);
        if (data.viewLayout) setViewLayout(data.viewLayout);
        if (data.noteLabelMode) {
          setNoteLabelMode(data.noteLabelMode);
        } else if (data.showPitchNames !== undefined) {
          setNoteLabelMode(data.showPitchNames ? 'letters' : 'off');
        }
        if (data.boomwhackerColors !== undefined) setBoomwhackerColors(data.boomwhackerColors);
        if (data.countingMode) {
          setCountingMode(data.countingMode);
        } else if (data.showBeatCounters !== undefined) {
          setCountingMode(data.showBeatCounters ? 'numbers' : 'off');
        }
        if (data.metronome !== undefined) setMetronome(data.metronome);
      } catch (e) {
        console.error('Failed to load shared score', e);
      }
    }
  }, []);

  const handleShare = useCallback(async () => {
    const shareData = {
      score,
      uiMode,
      viewLayout,
      noteLabelMode,
      showPitchNames,
      boomwhackerColors,
      countingMode,
      showBeatCounters,
      metronome,
    };

    let fallbackUrl = '';
    try {
      const jsonStr = JSON.stringify(shareData);
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      fallbackUrl = `${window.location.origin}${window.location.pathname}?app=staff-composer&share=${encoded}`;
    } catch (e) {
      console.error('Failed to generate fallback share link', e);
    }

    setShareUrl(fallbackUrl);
    setIsShareModalOpen(true);
    setIsGeneratingShareLink(true);

    try {
      const res = await createShortLink('staff-composer', score.title, shareData);
      if (res?.shortUrl) {
        setShareUrl(res.shortUrl);
        navigator.clipboard.writeText(res.shortUrl).catch(() => {});
      } else if (fallbackUrl) {
        navigator.clipboard.writeText(fallbackUrl).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to generate short link', e);
      if (fallbackUrl) {
        navigator.clipboard.writeText(fallbackUrl).catch(() => {});
      }
    } finally {
      setIsGeneratingShareLink(false);
    }
  }, [score, uiMode, viewLayout, noteLabelMode, showPitchNames, boomwhackerColors, countingMode, showBeatCounters, metronome]);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('noteflight_jr_score_v3', JSON.stringify(score));
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // ignore storage error
    }
  }, [score]);

  // Title-triggered server auto-save when a student is logged in (or teacher is editing a student project)
  useEffect(() => {
    const activeTarget = editingAsTeacher
      ? {
          studentId: editingAsTeacher.studentId,
          isTeacher: true,
          teacherPin: editingAsTeacher.teacherPin,
        }
      : studentSession
      ? {
          studentId: studentSession.id,
          pin: studentSession.pin,
          isTeacher: false,
        }
      : null;

    if (!activeTarget) {
      setCloudSaveStatus('idle');
      return;
    }

    const cleanTitle = (score.title || '').trim();
    const isDefaultUntitled =
      !cleanTitle ||
      cleanTitle.toLowerCase() === 'my composition' ||
      cleanTitle.toLowerCase() === 'untitled';

    if (isDefaultUntitled) {
      setCloudSaveStatus('untitled');
      return;
    }

    setCloudSaveStatus('saving');
    const timer = window.setTimeout(() => {
      saveStudentProject({
        studentId: activeTarget.studentId,
        pin: activeTarget.pin,
        isTeacher: activeTarget.isTeacher,
        teacherPin: activeTarget.teacherPin,
        projectId: currentProjectId,
        title: cleanTitle,
        score,
        appType: 'staff-composer',
      })
        .then((res) => {
          if (res.saved && res.project) {
            if (res.project.id !== currentProjectId) {
              setCurrentProjectId(res.project.id);
            }
            setCloudSaveStatus('saved');
          } else {
            setCloudSaveStatus('untitled');
          }
        })
        .catch(() => {
          setCloudSaveStatus('idle');
        });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [score, studentSession, editingAsTeacher, currentProjectId]);

  // Keep metronome state synced with audio engine dynamically during playback
  useEffect(() => {
    soundEngine.setMetronome(metronome);
  }, [metronome]);

  // Keep live track mix (volume faders, stereo pan, mute/solo, and studio FX) synced during playback
  useEffect(() => {
    soundEngine.updateLiveTrackMix(score);
  }, [score]);

  // Push score change to undo history
  const pushScoreState = useCallback(
    (newScore: Score) => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        return [...next, JSON.parse(JSON.stringify(newScore))];
      });
      setHistoryIndex((prev) => prev + 1);
      setScore(newScore);
    },
    [historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((idx) => idx - 1);
      setScore(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((idx) => idx + 1);
      setScore(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  }, [history, historyIndex]);

  // Handle cursor/measure/note selection (supports Shift-click multi-measure selection range)
  const handleSelect = useCallback(
    (newState: SelectionState | null, isShiftKey?: boolean) => {
      if (!newState) {
        setSelection(null);
        return;
      }

      if (newState.itemIndex === -1) {
        if (isShiftKey && selection) {
          const currentIndices = getSelectedMeasureIndices(selection);
          const anchor = currentIndices.length > 0 ? currentIndices[0] : selection.measureIndex;
          const start = Math.min(anchor, newState.measureIndex);
          const end = Math.max(anchor, newState.measureIndex);
          const range: number[] = [];
          for (let i = start; i <= end; i++) {
            range.push(i);
          }
          setSelection({
            trackIndex: newState.trackIndex,
            measureIndex: newState.measureIndex,
            itemIndex: -1,
            selectedMeasureIndices: range,
          });
          return;
        }

        setSelection({
          trackIndex: newState.trackIndex,
          measureIndex: newState.measureIndex,
          itemIndex: -1,
          selectedMeasureIndices: [newState.measureIndex],
        });
        return;
      }

      setSelection(newState);
    },
    [selection]
  );

  // Copy Measure(s)
  const handleCopyMeasure = useCallback(() => {
    if (!selection || selection.itemIndex !== -1) return;
    const track = score.tracks[selection.trackIndex];
    if (!track) return;
    const measureIndices = getSelectedMeasureIndices(selection);
    if (measureIndices.length === 0) return;

    const copied: NoteItem[][] = [];
    for (const mIdx of measureIndices) {
      const m = track.measures[mIdx];
      if (m) {
        copied.push(JSON.parse(JSON.stringify(m.items)));
      }
    }
    if (copied.length > 0) {
      setMeasureClipboard(copied);
    }
  }, [score.tracks, selection]);

  // Paste Measure(s)
  const handlePasteMeasure = useCallback(() => {
    if (!selection || selection.itemIndex !== -1 || !measureClipboard || measureClipboard.length === 0) return;
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    const track = nextScore.tracks[selection.trackIndex];
    if (!track) return;

    const startMeasure = selection.measureIndex;

    measureClipboard.forEach((measureItems, offset) => {
      const targetIdx = startMeasure + offset;
      while (track.measures.length <= targetIdx) {
        nextScore.tracks.forEach((t) => {
          t.measures.push(createEmptyMeasure(nextScore.timeSignature));
        });
      }
      const targetMeasure = track.measures[targetIdx];
      if (targetMeasure) {
        targetMeasure.items = JSON.parse(JSON.stringify(measureItems));
      }
    });

    pushScoreState(nextScore);

    const pastedIndices = measureClipboard.map((_, i) => startMeasure + i);
    setSelection({
      trackIndex: selection.trackIndex,
      measureIndex: startMeasure,
      itemIndex: -1,
      selectedMeasureIndices: pastedIndices,
    });
  }, [measureClipboard, pushScoreState, score, selection]);

  // Move Measure Left
  const handleMoveMeasureLeft = useCallback(() => {
    if (!selection || selection.itemIndex !== -1 || selection.measureIndex <= 0) return;
    const mIdx = selection.measureIndex;
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    nextScore.tracks.forEach((track) => {
      const temp = track.measures[mIdx];
      track.measures[mIdx] = track.measures[mIdx - 1];
      track.measures[mIdx - 1] = temp;
    });
    pushScoreState(nextScore);
    setSelection({ ...selection, measureIndex: mIdx - 1 });
  }, [pushScoreState, score, selection]);

  // Move Measure Right
  const handleMoveMeasureRight = useCallback(() => {
    if (!selection || selection.itemIndex !== -1) return;
    const mIdx = selection.measureIndex;
    const maxM = score.tracks[0]?.measures.length || 0;
    if (mIdx >= maxM - 1) return;

    const nextScore: Score = JSON.parse(JSON.stringify(score));
    nextScore.tracks.forEach((track) => {
      const temp = track.measures[mIdx];
      track.measures[mIdx] = track.measures[mIdx + 1];
      track.measures[mIdx + 1] = temp;
    });
    pushScoreState(nextScore);
    setSelection({ ...selection, measureIndex: mIdx + 1 });
  }, [pushScoreState, score, selection]);

  // Insert or Replace Note / Rest at targeted measure & item
  const handleNoteInsertOrUpdate = useCallback(
    (
      trackIndex: number,
      measureIndex: number,
      itemIndex: number,
      pitch?: Pitch,
      targetBeat?: number,
      isDragUpdate?: boolean,
      originalPitch?: Pitch
    ) => {
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      const track = nextScore.tracks[trackIndex];
      if (!track) return;
      const measure = track.measures[measureIndex];
      if (!measure) return;

      const capacity = getMeasureCapacity(nextScore.timeSignature);

      // If dragging an existing note to a new pitch, update its pitch in place (preserving chords)
      if (isDragUpdate && itemIndex >= 0 && itemIndex < measure.items.length && pitch) {
        const existing = measure.items[itemIndex];
        if (existing.type === 'note') {
          const existingPitches =
            existing.pitches && existing.pitches.length > 0
              ? existing.pitches
              : existing.pitch
              ? [existing.pitch]
              : [];

          if (originalPitch && existingPitches.length > 1) {
            let replaced = false;
            const updatedPitches = existingPitches.map((ep) => {
              if (!replaced && ep.step === originalPitch.step && ep.octave === originalPitch.octave) {
                replaced = true;
                return pitch;
              }
              return ep;
            });
            // Deduplicate identical pitches
            const uniquePitches = updatedPitches.filter(
              (up, idx, arr) =>
                arr.findIndex((x) => x.step === up.step && x.octave === up.octave) === idx
            );
            existing.pitches = uniquePitches;
            existing.pitch = uniquePitches[0];
          } else {
            existing.pitch = pitch;
            existing.pitches = [pitch];
          }
          pushScoreState(nextScore);
          return;
        }
      }

      // If in selection mode and updating existing note in place
      if (isSelectMode && itemIndex >= 0 && itemIndex < measure.items.length && pitch) {
        const existing = measure.items[itemIndex];
        if (existing.type === 'note') {
          const existingPitches =
            existing.pitches && existing.pitches.length > 0
              ? existing.pitches
              : existing.pitch
              ? [existing.pitch]
              : [];

          const isDuplicate = existingPitches.some(
            (ep) => ep.step === pitch.step && ep.octave === pitch.octave
          );

          if (!isDuplicate) {
            existing.pitches = [...existingPitches, pitch];
            existing.pitch = existing.pitches[0];
          } else {
            existing.pitch = pitch;
            existing.pitches = [pitch];
          }
          pushScoreState(nextScore);
          return;
        }
      }

      const newItem: NoteItem = {
        id: 'n_' + Math.random().toString(36).substring(2, 9),
        type: (isRestMode || !pitch ? 'rest' : 'note') as 'note' | 'rest',
        pitch: isRestMode ? undefined : pitch,
        pitches: isRestMode || !pitch ? undefined : [pitch],
        duration: activeDuration,
        isDotted: isDotted,
        isTied: isTied,
        isTriplet: isTriplet,
        articulation: isRestMode ? null : activeArticulation,
        dynamic: isRestMode ? null : activeDynamic,
      };

      if (targetBeat !== undefined) {
        // Direct timeline-based insertion: places note directly at target beat,
        // forming chords if a note already exists at that beat!
        measure.items = insertNoteAtBeat(measure.items, newItem, targetBeat, capacity);
      } else {
        let priorBeat = 0;
        for (let i = 0; i < itemIndex && i < measure.items.length; i++) {
          priorBeat += getItemDuration(measure.items[i]);
        }
        measure.items = insertNoteAtBeat(measure.items, newItem, priorBeat, capacity);
      }

      pushScoreState(nextScore);

      // Automatically disable dynamic marking after a note is placed so subsequent notes don't inherit it
      if (activeDynamic) {
        setActiveDynamic(null);
      }

      const newlyAddedIdx = measure.items.findIndex((it) => it.id === newItem.id);
      setSelection({
        trackIndex,
        measureIndex,
        itemIndex: newlyAddedIdx >= 0 ? newlyAddedIdx : 0,
      });
    },
    [
      isSelectMode,
      activeDuration,
      isRestMode,
      isDotted,
      isTied,
      isTriplet,
      activeArticulation,
      activeDynamic,
      pushScoreState,
      score,
    ]
  );

  // Change Note Duration (also updates the currently selected note if in Cursor Select mode)
  const handleChangeDuration = useCallback(
    (d: NoteDuration) => {
      setActiveDuration(d);
      setIsRestMode(false);
      if (isSelectMode && selection && selection.itemIndex >= 0) {
        const nextScore: Score = JSON.parse(JSON.stringify(score));
        const measure = nextScore.tracks[selection.trackIndex]?.measures[selection.measureIndex];
        const item = measure?.items[selection.itemIndex];
        if (measure && item) {
          item.duration = d;
          const capacity = getMeasureCapacity(nextScore.timeSignature);
          measure.items = cleanMeasureRests(measure.items, capacity);
          pushScoreState(nextScore);
        }
      }
    },
    [isSelectMode, selection, score, pushScoreState]
  );

  // UI Mode change handler
  const handleChangeUiMode = useCallback(
    (mode: UiMode) => {
      setUiMode(mode);
      try {
        localStorage.setItem('noteflight_jr_uimode', mode);
      } catch {
        // ignore
      }
      if (mode === 'simple') {
        setNoteLabelMode('letters');
        setBoomwhackerColors(true);
        setIsSelectMode(false);
        if (activeDuration < 0.125) {
          setActiveDuration(0.25);
        }
      } else {
        // Standard & Advanced: show regular black notes, not labeled in color
        setNoteLabelMode('off');
        setBoomwhackerColors(false);
      }
    },
    [activeDuration]
  );

  // Red "Reset" handler: erases ALL notes in ALL instruments and shows a totally blank staff
  const handleReset = useCallback(() => {
    soundEngine.stopPlayback();
    setIsPlaying(false);
    setPlayheadPosition(null);
    setActivePlayingNoteIds(new Set());

    const ts = score.timeSignature || [4, 4];
    const blankScore: Score = {
      id: 'score_' + Math.random().toString(36).substring(2, 9),
      title: 'My Composition',
      composer: 'Student Composer',
      tempo: score.tempo || 108,
      timeSignature: ts,
      keySignature: 'C',
      tracks: [
        {
          id: 'track_treble_1',
          name: 'Treble Staff',
          instrumentId: 'piano_treble',
          clef: 'treble',
          volume: 0.85,
          muted: false,
          soloed: false,
          measures: [
            createEmptyMeasure(ts),
            createEmptyMeasure(ts),
            createEmptyMeasure(ts),
            createEmptyMeasure(ts),
          ],
        },
      ],
    };

    pushScoreState(blankScore);
    setSelection({
      trackIndex: 0,
      measureIndex: 0,
      itemIndex: 0,
    });
  }, [pushScoreState, score.tempo, score.timeSignature]);

  // Toggle Dotted handler (updates currently selected note immediately)
  const handleToggleDotted = useCallback(() => {
    setIsDotted((prev) => {
      const nextVal = !prev;
      if (selection && selection.itemIndex >= 0) {
        const nextScore: Score = JSON.parse(JSON.stringify(score));
        const measure = nextScore.tracks[selection.trackIndex]?.measures[selection.measureIndex];
        const item = measure?.items[selection.itemIndex];
        if (measure && item) {
          item.isDotted = nextVal;
          const capacity = getMeasureCapacity(nextScore.timeSignature);
          measure.items = cleanMeasureRests(measure.items, capacity);
          pushScoreState(nextScore);
        }
      }
      return nextVal;
    });
  }, [selection, score, pushScoreState]);

  // Toggle Tie handler
  const handleToggleTied = useCallback(() => {
    setIsTied((prev) => {
      const nextVal = !prev;
      if (selection && selection.itemIndex >= 0) {
        const nextScore: Score = JSON.parse(JSON.stringify(score));
        const item =
          nextScore.tracks[selection.trackIndex]?.measures[selection.measureIndex]?.items[selection.itemIndex];
        if (item && item.type === 'note') {
          item.isTied = nextVal;
          pushScoreState(nextScore);
        }
      }
      return nextVal;
    });
  }, [selection, score, pushScoreState]);

  // Change Accidental handler (updates currently selected note immediately + plays preview)
  const handleChangeAccidental = useCallback(
    (acc: AccidentalType) => {
      setActiveAccidental(acc);
      if (selection && selection.itemIndex >= 0) {
        const nextScore: Score = JSON.parse(JSON.stringify(score));
        const track = nextScore.tracks[selection.trackIndex];
        const item = track?.measures[selection.measureIndex]?.items[selection.itemIndex];
        if (item && item.type === 'note') {
          if (item.pitch) item.pitch.accidental = acc;
          if (item.pitches && item.pitches.length > 0) {
            item.pitches[item.pitches.length - 1].accidental = acc;
          }
          pushScoreState(nextScore);
          const previewPitches =
            item.pitches && item.pitches.length > 0
              ? item.pitches
              : item.pitch
              ? [item.pitch]
              : [];
          if (previewPitches.length > 0 && track) {
            soundEngine.playNotePreview(previewPitches, track.instrumentId, 0.35, nextScore.keySignature);
          }
        }
      }
    },
    [selection, score, pushScoreState]
  );

  // Toggle Triplet handler
  const handleToggleTriplet = useCallback(() => {
    setIsTriplet((prev) => {
      const nextVal = !prev;
      if (selection && selection.itemIndex >= 0) {
        const nextScore: Score = JSON.parse(JSON.stringify(score));
        const measure = nextScore.tracks[selection.trackIndex]?.measures[selection.measureIndex];
        const item = measure?.items[selection.itemIndex];
        if (measure && item) {
          item.isTriplet = nextVal;
          const capacity = getMeasureCapacity(nextScore.timeSignature);
          measure.items = cleanMeasureRests(measure.items, capacity);
          pushScoreState(nextScore);
        }
      }
      return nextVal;
    });
  }, [selection, score, pushScoreState]);

  // Change Articulation handler
  const handleChangeArticulation = useCallback(
    (art: ArticulationType) => {
      setActiveArticulation(art);
      if (selection && selection.itemIndex >= 0) {
        const nextScore: Score = JSON.parse(JSON.stringify(score));
        const item =
          nextScore.tracks[selection.trackIndex]?.measures[selection.measureIndex]?.items[selection.itemIndex];
        if (item && item.type === 'note') {
          item.articulation = art;
          pushScoreState(nextScore);
        }
      }
    },
    [selection, score, pushScoreState]
  );

  // Change Dynamic handler: sets/toggles dynamic on selected note and automatically disables tool
  const handleChangeDynamic = useCallback(
    (dyn: DynamicMarking) => {
      if (selection && selection.itemIndex >= 0) {
        const nextScore: Score = JSON.parse(JSON.stringify(score));
        const item =
          nextScore.tracks[selection.trackIndex]?.measures[selection.measureIndex]?.items[selection.itemIndex];
        if (item) {
          item.dynamic = item.dynamic === dyn ? null : dyn;
          pushScoreState(nextScore);
        }
        // Automatically disable dynamic marking right after applying to the selected note
        setActiveDynamic(null);
      } else {
        // Arm dynamic marking for the next note placed on staff (or toggle off if re-clicked)
        setActiveDynamic((prev) => (prev === dyn ? null : dyn));
      }
    },
    [selection, score, pushScoreState]
  );

  // Measure Repeat Start / End / Whole Measure / Whole Song / Clear handlers
  const handleToggleRepeatStart = useCallback(() => {
    const measureIdx = selection?.measureIndex ?? 0;
    const trackIdx = selection?.trackIndex ?? 0;
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    const currentVal = Boolean(nextScore.tracks[trackIdx]?.measures[measureIdx]?.repeatStart);
    nextScore.tracks.forEach((t) => {
      if (t.measures[measureIdx]) {
        t.measures[measureIdx].repeatStart = !currentVal;
      }
    });
    pushScoreState(nextScore);
  }, [selection, score, pushScoreState]);

  const handleToggleRepeatEnd = useCallback(() => {
    const measureIdx = selection?.measureIndex ?? 0;
    const trackIdx = selection?.trackIndex ?? 0;
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    const currentVal = Boolean(nextScore.tracks[trackIdx]?.measures[measureIdx]?.repeatEnd);
    nextScore.tracks.forEach((t) => {
      if (t.measures[measureIdx]) {
        t.measures[measureIdx].repeatEnd = !currentVal;
      }
    });
    pushScoreState(nextScore);
  }, [selection, score, pushScoreState]);

  // Toggle 1st or 2nd ending (volta bracket) on the selected measure
  const handleToggleEnding = useCallback(
    (ending: 1 | 2) => {
      const measureIdx = selection?.measureIndex ?? 0;
      const trackIdx = selection?.trackIndex ?? 0;
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      const currentVal = nextScore.tracks[trackIdx]?.measures[measureIdx]?.ending;
      const newVal = currentVal === ending ? null : ending;
      nextScore.tracks.forEach((t) => {
        if (t.measures[measureIdx]) {
          t.measures[measureIdx].ending = newVal;
          // When adding 1st ending, ensure repeatEnd is placed if not already set
          if (newVal === 1 && !t.measures[measureIdx].repeatEnd) {
            t.measures[measureIdx].repeatEnd = true;
          }
        }
      });
      pushScoreState(nextScore);
    },
    [selection, score, pushScoreState]
  );

  const handleToggleRepeatMeasure = useCallback(() => {
    const measureIdx = selection?.measureIndex ?? 0;
    const trackIdx = selection?.trackIndex ?? 0;
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    const m = nextScore.tracks[trackIdx]?.measures[measureIdx];
    const bothSet = Boolean(m?.repeatStart && m?.repeatEnd);
    nextScore.tracks.forEach((t) => {
      if (t.measures[measureIdx]) {
        t.measures[measureIdx].repeatStart = !bothSet;
        t.measures[measureIdx].repeatEnd = !bothSet;
      }
    });
    pushScoreState(nextScore);
  }, [selection, score, pushScoreState]);

  const handleRepeatWholeSong = useCallback(() => {
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    nextScore.tracks.forEach((t) => {
      if (t.measures.length > 0) {
        t.measures[0].repeatStart = true;
        t.measures[t.measures.length - 1].repeatEnd = true;
      }
    });
    pushScoreState(nextScore);
  }, [score, pushScoreState]);

  const handleClearAllRepeats = useCallback(() => {
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    nextScore.tracks.forEach((t) => {
      t.measures.forEach((m) => {
        m.repeatStart = false;
        m.repeatEnd = false;
        m.ending = null;
      });
    });
    pushScoreState(nextScore);
  }, [score, pushScoreState]);

  const handleUpdateSelectedNoteLyric = useCallback(
    (lyric: string, advanceNext?: boolean) => {
      if (!selection || selection.itemIndex < 0) return;
      if (containsProfanity(lyric)) {
        triggerProfanityAlert('lyrics');
        return;
      }
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      const track = nextScore.tracks[selection.trackIndex];
      const measure = track?.measures[selection.measureIndex];
      const item = measure?.items[selection.itemIndex];
      if (item && item.type === 'note') {
        item.lyric = lyric.trim() ? lyric.trim() : undefined;
        pushScoreState(nextScore);
      }
      if (advanceNext && track) {
        const items = measure?.items || [];
        if (selection.itemIndex < items.length - 1) {
          setSelection({ ...selection, itemIndex: selection.itemIndex + 1 });
        } else if (selection.measureIndex < track.measures.length - 1) {
          setSelection({
            ...selection,
            measureIndex: selection.measureIndex + 1,
            itemIndex: 0,
          });
        }
      }
    },
    [selection, score, pushScoreState, triggerProfanityAlert]
  );

  // Play audio preview
  const handlePlayPreview = useCallback(
    (pitch: Pitch | Pitch[], instrumentId?: any) => {
      const inst = instrumentId || score.tracks[selection?.trackIndex || 0]?.instrumentId || 'piano_treble';
      soundEngine.playNotePreview(pitch, inst, 0.4, score.keySignature);
    },
    [score.tracks, score.keySignature, selection?.trackIndex]
  );

  // Transpose all notes in selected measure(s) by diatonic steps
  const handleTransposeMeasure = useCallback(
    (trackIndex: number, measureIndices: number[], diatonicDelta: number) => {
      if (diatonicDelta === 0) return;
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      const track = nextScore.tracks[trackIndex];
      if (!track) return;

      const previewPitches: Pitch[] = [];

      measureIndices.forEach((mIdx) => {
        const measure = track.measures[mIdx];
        if (!measure) return;

        measure.items.forEach((item) => {
          if (item.type === 'note') {
            if (item.pitches && item.pitches.length > 0) {
              item.pitches = item.pitches.map((p) =>
                shiftPitchByDiatonicSteps(p, diatonicDelta)
              );
              item.pitch = item.pitches[0];
              previewPitches.push(...item.pitches);
            } else if (item.pitch) {
              item.pitch = shiftPitchByDiatonicSteps(item.pitch, diatonicDelta);
              previewPitches.push(item.pitch);
            }
          }
        });
      });

      pushScoreState(nextScore);

      if (previewPitches.length > 0) {
        handlePlayPreview(previewPitches.slice(0, 3), track.instrumentId);
      }
    },
    [handlePlayPreview, pushScoreState, score]
  );

  // Shift pitch of currently selected note/chord or transpose selected measure(s)
  const shiftSelectedPitch = useCallback(
    (diatonicDelta: number) => {
      if (!selection) return;

      if (selection.itemIndex === -1) {
        const selectedIndices = getSelectedMeasureIndices(selection);
        handleTransposeMeasure(selection.trackIndex, selectedIndices, diatonicDelta);
        return;
      }

      const { trackIndex, measureIndex, itemIndex } = selection;
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      const item = nextScore.tracks[trackIndex]?.measures[measureIndex]?.items[itemIndex];
      if (!item || item.type !== 'note') return;

      const itemPitches =
        item.pitches && item.pitches.length > 0
          ? item.pitches
          : item.pitch
          ? [item.pitch]
          : [];

      if (itemPitches.length === 0) return;

      const shiftedPitches = itemPitches.map((p) =>
        shiftPitchByDiatonicSteps(p, diatonicDelta)
      );

      item.pitches = shiftedPitches;
      item.pitch = shiftedPitches[0];

      pushScoreState(nextScore);
      handlePlayPreview(shiftedPitches, nextScore.tracks[trackIndex].instrumentId);
    },
    [handlePlayPreview, handleTransposeMeasure, pushScoreState, score, selection]
  );

  // Delete selected note or clear / delete measure(s)
  const handleDeleteSelected = useCallback(() => {
    if (!selection) return;

    const nextScore: Score = JSON.parse(JSON.stringify(score));

    // If measure(s) selected
    if (selection.itemIndex === -1) {
      const selectedIndices = getSelectedMeasureIndices(selection);
      if (selectedIndices.length > 1) {
        // Multiple measures selected: delete measures across all tracks
        const sortedIndices = [...selectedIndices].sort((a, b) => b - a); // delete descending
        const totalMeasures = nextScore.tracks[0]?.measures.length || 0;

        // If all measures would be deleted, keep 1 empty measure
        if (sortedIndices.length >= totalMeasures) {
          nextScore.tracks.forEach((track) => {
            track.measures = [createEmptyMeasure(nextScore.timeSignature)];
          });
          pushScoreState(nextScore);
          setSelection({
            trackIndex: selection.trackIndex,
            measureIndex: 0,
            itemIndex: -1,
            selectedMeasureIndices: [0],
          });
          return;
        }

        nextScore.tracks.forEach((track) => {
          for (const idx of sortedIndices) {
            if (idx >= 0 && idx < track.measures.length) {
              track.measures.splice(idx, 1);
            }
          }
        });

        pushScoreState(nextScore);
        const newMax = (nextScore.tracks[0]?.measures.length || 1) - 1;
        const newMeasureIdx = Math.min(sortedIndices[sortedIndices.length - 1], newMax);
        setSelection({
          trackIndex: selection.trackIndex,
          measureIndex: newMeasureIdx,
          itemIndex: -1,
          selectedMeasureIndices: [newMeasureIdx],
        });
        return;
      }

      // Single measure selected -> reset measure to empty rest matching time signature
      const track = nextScore.tracks[selection.trackIndex];
      if (track) {
        track.measures[selection.measureIndex] = createEmptyMeasure(nextScore.timeSignature);
        pushScoreState(nextScore);
      }
      return;
    }

    // Individual note/rest selected
    let targetTrackIdx = selection.trackIndex;
    let targetMeasureIdx = selection.measureIndex;
    let targetItemIdx = selection.itemIndex;

    const track = nextScore.tracks[targetTrackIdx];
    const measure = track?.measures[targetMeasureIdx];
    const item = measure?.items[targetItemIdx];
    if (!item) return;

    if (item.type === 'note') {
      if (item.pitches && item.pitches.length > 1) {
        item.pitches.pop();
        item.pitch = item.pitches[0];
      } else {
        item.type = 'rest';
        item.pitch = undefined;
        item.pitches = undefined;
        item.isTied = false;
        const capacity = getMeasureCapacity(nextScore.timeSignature);
        measure.items = cleanMeasureRests(measure.items, capacity);
      }
      pushScoreState(nextScore);
    }
  }, [pushScoreState, score, selection]);

  // Direct letter note entry (A-G)
  const handleDirectNoteEntry = useCallback(
    (letter: string) => {
      if (!selection || selection.itemIndex < 0) return;
      const upperLetter = letter.toUpperCase();
      if (!['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(upperLetter)) return;

      const track = score.tracks[selection.trackIndex];
      if (!track) return;

      const defaultOctave = track.clef === 'treble' ? 4 : 3;

      const pitch: Pitch = {
        step: upperLetter as any,
        octave: defaultOctave,
        accidental: activeAccidental,
      };

      handleNoteInsertOrUpdate(
        selection.trackIndex,
        selection.measureIndex,
        selection.itemIndex,
        pitch
      );
      handlePlayPreview(pitch, track.instrumentId);
    },
    [activeAccidental, handleNoteInsertOrUpdate, handlePlayPreview, score.tracks, selection]
  );

  // Virtual piano click handler
  const handlePianoKeyClick = useCallback(
    (pitch: Pitch) => {
      const p = { ...pitch };
      if (activeAccidental && !p.accidental) {
        p.accidental = activeAccidental;
      }
      if (selection && selection.itemIndex >= 0) {
        handleNoteInsertOrUpdate(
          selection.trackIndex,
          selection.measureIndex,
          selection.itemIndex,
          p
        );
      }
      handlePlayPreview(p);
    },
    [activeAccidental, handleNoteInsertOrUpdate, handlePlayPreview, selection]
  );

  // Transport Play / Stop
  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      soundEngine.stopPlayback();
      setIsPlaying(false);
      setPlayheadPosition(null);
      setActivePlayingNoteIds(new Set());
    } else {
      setIsPlaying(true);
      soundEngine.setMetronome(metronome);
      const loopTarget = isLoopingMeasure ? (selection?.measureIndex ?? 0) : null;
      soundEngine.playScore(
        score,
        (mIdx, beatFraction) => {
          setPlayheadPosition({ measureIndex: mIdx, beatFraction });
        },
        (noteId) => {
          setActivePlayingNoteIds((prev) => new Set([...prev, noteId]));
          setTimeout(() => {
            setActivePlayingNoteIds((prev) => {
              const next = new Set(prev);
              next.delete(noteId);
              return next;
            });
          }, 200);
        },
        () => {
          setIsPlaying(false);
          setPlayheadPosition(null);
          setActivePlayingNoteIds(new Set());
        },
        loopTarget
      );
    }
  }, [isPlaying, isLoopingMeasure, metronome, score, selection?.measureIndex]);

  const handleRewind = useCallback(() => {
    if (isPlaying) {
      soundEngine.stopPlayback();
      setIsPlaying(false);
    }
    setPlayheadPosition(null);
    setActivePlayingNoteIds(new Set());
    setSelection({ trackIndex: 0, measureIndex: 0, itemIndex: 0 });
  }, [isPlaying]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // When Mr. Arthur's avatar popup is enlarged:
      // Keyboard input has NO effect on composition at all, but ONLY listens for the secret "adminbaby" shortcut!
      if (isAvatarOpen) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
          setIsAvatarOpen(false);
          adminKeyBufferRef.current = '';
          return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const ch = e.key.toLowerCase();
          const candidate = (adminKeyBufferRef.current + ch).slice(-9);
          if ('adminbaby'.startsWith(candidate)) {
            adminKeyBufferRef.current = candidate;
            if (candidate === 'adminbaby') {
              adminKeyBufferRef.current = '';
              setIsAvatarOpen(false);
              setOpenInTeacherMode(true);
              setIsClassroomModalOpen(true);
            }
          } else if (ch === 'a') {
            adminKeyBufferRef.current = 'a';
          } else {
            adminKeyBufferRef.current = '';
          }
        }
        return; // Completely suppress all composition keystrokes while avatar is enlarged!
      }

      if (e.key === 'Escape' && isFullScreen) {
        e.preventDefault();
        handleExitFullScreen();
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (currentApp !== 'staff-composer') {
        return;
      }

      // Space -> Toggle Play / Pause
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (e.target instanceof HTMLElement) {
          e.target.blur();
        }
        handleTogglePlay();
        return;
      }

      // Copy Measure (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selection?.itemIndex === -1) {
        e.preventDefault();
        handleCopyMeasure();
        return;
      }

      // Paste Measure (Ctrl+V / Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && selection?.itemIndex === -1) {
        e.preventDefault();
        handlePasteMeasure();
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Durations: 1 to 5
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, NoteDuration> = {
          '1': 1,
          '2': 0.5,
          '3': 0.25,
          '4': 0.125,
          '5': 0.0625,
        };
        setActiveDuration(map[e.key]);
        setIsRestMode(false);
        setIsSelectMode(false);
        return;
      }

      // Modifiers
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRestMode((v) => !v);
        setIsSelectMode(false);
        return;
      }
      if (e.key === '.') {
        e.preventDefault();
        handleToggleDotted();
        return;
      }
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleToggleTied();
        return;
      }

      // Delete / Backspace
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Arrow navigation & pitch shift
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        shiftSelectedPitch(1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        shiftSelectedPitch(-1);
        return;
      }
      if (e.key === 'ArrowLeft' && selection) {
        e.preventDefault();
        if (selection.itemIndex > 0) {
          setSelection({ ...selection, itemIndex: selection.itemIndex - 1 });
        } else if (selection.measureIndex > 0) {
          const prevM = selection.measureIndex - 1;
          const items = score.tracks[selection.trackIndex]?.measures[prevM]?.items || [];
          setSelection({
            ...selection,
            measureIndex: prevM,
            itemIndex: Math.max(0, items.length - 1),
          });
        }
        return;
      }
      if (e.key === 'ArrowRight' && selection) {
        e.preventDefault();
        const currentItems = score.tracks[selection.trackIndex]?.measures[selection.measureIndex]?.items || [];
        if (selection.itemIndex >= 0 && selection.itemIndex < currentItems.length - 1) {
          setSelection({ ...selection, itemIndex: selection.itemIndex + 1 });
        } else {
          const totalMeasures = score.tracks[selection.trackIndex]?.measures.length || 0;
          if (selection.measureIndex < totalMeasures - 1) {
            setSelection({
              ...selection,
              measureIndex: selection.measureIndex + 1,
              itemIndex: 0,
            });
          }
        }
        return;
      }

      // Direct letter entry A-G
      if (/^[a-gA-G]$/.test(e.key)) {
        e.preventDefault();
        handleDirectNoteEntry(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCopyMeasure,
    handleDeleteSelected,
    handleDirectNoteEntry,
    handleExitFullScreen,
    handlePasteMeasure,
    handleRedo,
    handleToggleDotted,
    handleTogglePlay,
    handleToggleTied,
    handleUndo,
    isAvatarOpen,
    isFullScreen,
    currentApp,
    score.tracks,
    selection,
    shiftSelectedPitch,
  ]);

  // Add new measure across all tracks
  const handleAddMeasure = useCallback(() => {
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    nextScore.tracks.forEach((track) => {
      track.measures.push(createEmptyMeasure(nextScore.timeSignature));
    });
    pushScoreState(nextScore);
  }, [pushScoreState, score]);

  // Update track properties
  const handleUpdateTrack = useCallback(
    (trackIndex: number, updates: Partial<Track>) => {
      if (updates.name !== undefined && containsProfanity(updates.name)) {
        triggerProfanityAlert('instrument / track names');
        return;
      }
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      Object.assign(nextScore.tracks[trackIndex], updates);
      pushScoreState(nextScore);
    },
    [pushScoreState, score, triggerProfanityAlert]
  );

  // Remove track
  const handleRemoveTrack = useCallback(
    (trackIndex: number) => {
      if (score.tracks.length <= 1) return;
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      nextScore.tracks.splice(trackIndex, 1);
      pushScoreState(nextScore);
      setSelection({ trackIndex: 0, measureIndex: 0, itemIndex: 0 });
    },
    [pushScoreState, score]
  );

  // Add instrument track
  const handleAddInstrument = useCallback(
    (inst: InstrumentDefinition) => {
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      const measureCount = Math.max(...nextScore.tracks.map((t) => t.measures.length), 4);
      const newMeasures = Array.from({ length: measureCount }).map(() =>
        createEmptyMeasure(nextScore.timeSignature)
      );

      const newTrack: Track = {
        id: 'track_' + Math.random().toString(36).substring(2, 9),
        name: inst.name,
        instrumentId: inst.id,
        clef: inst.clef,
        volume: 0.8,
        muted: false,
        soloed: false,
        measures: newMeasures,
      };

      nextScore.tracks.push(newTrack);
      pushScoreState(nextScore);
    },
    [pushScoreState, score]
  );

  // Add Grand Staff
  const handleAddGrandPiano = useCallback(() => {
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    const measureCount = Math.max(...nextScore.tracks.map((t) => t.measures.length), 4);

    const rhTrack: Track = {
      id: 'track_rh_' + Math.random().toString(36).substring(2, 9),
      name: 'Piano (Right Hand)',
      instrumentId: 'piano_treble',
      clef: 'treble',
      volume: 0.8,
      muted: false,
      soloed: false,
      measures: Array.from({ length: measureCount }).map(() =>
        createEmptyMeasure(nextScore.timeSignature)
      ),
    };

    const lhTrack: Track = {
      id: 'track_lh_' + Math.random().toString(36).substring(2, 9),
      name: 'Piano (Left Hand)',
      instrumentId: 'piano_bass',
      clef: 'bass',
      volume: 0.8,
      muted: false,
      soloed: false,
      measures: Array.from({ length: measureCount }).map(() =>
        createEmptyMeasure(nextScore.timeSignature)
      ),
    };

    nextScore.tracks.push(rhTrack, lhTrack);
    pushScoreState(nextScore);
  }, [pushScoreState, score]);

  // Reset to single blank treble staff
  const handleNewBlankScore = useCallback(() => {
    const blank = JSON.parse(JSON.stringify(DEFAULT_BLANK_SCORE));
    if (studentSession) {
      blank.composer = studentSession.firstName;
    }
    setCurrentProjectId(null);
    setEditingAsTeacher(null);
    setScore(blank);
    setHistory([JSON.parse(JSON.stringify(blank))]);
    setHistoryIndex(0);
    setSelection({ trackIndex: 0, measureIndex: 0, itemIndex: 0 });
  }, [studentSession]);

  // Add Drum Track with selected beat
  const handleAddDrumTrack = useCallback(
    (groove: DrumGroove) => {
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      const measureCount = Math.max(...nextScore.tracks.map((t) => t.measures.length), 4);

      // Tile groove measures across the whole score
      const newMeasures = Array.from({ length: measureCount }).map((_, mIdx) => {
        const patternMeasure = groove.measures[mIdx % groove.measures.length];
        return {
          id: 'm_dr_' + Math.random().toString(36).substring(2, 9),
          items: patternMeasure.items.map((it) => ({
            ...it,
            id: 'n_dr_' + Math.random().toString(36).substring(2, 9),
          })),
        };
      });

      const newTrack: Track = {
        id: 'track_drum_' + Math.random().toString(36).substring(2, 9),
        name: `Drums (${groove.name})`,
        instrumentId: groove.kitType || 'drum_kit',
        clef: 'treble',
        volume: 0.85,
        muted: false,
        soloed: false,
        measures: newMeasures,
      };

      nextScore.tracks.push(newTrack);
      // Auto-adapt tempo if this is added to a blank single staff
      if (
        nextScore.tracks.length === 2 &&
        nextScore.tracks[0].measures.every((m) => m.items.every((it) => it.type === 'rest'))
      ) {
        nextScore.tempo = groove.tempo;
      }
      pushScoreState(nextScore);
      setSelection({
        trackIndex: nextScore.tracks.length - 1,
        measureIndex: 0,
        itemIndex: 0,
      });
    },
    [pushScoreState, score]
  );

  // Apply Drum Beat to currently selected track
  const handleApplyGrooveToSelectedTrack = useCallback(
    (groove: DrumGroove) => {
      if (!selection) return;
      const nextScore: Score = JSON.parse(JSON.stringify(score));
      const targetTrack = nextScore.tracks[selection.trackIndex];
      if (!targetTrack) return;

      targetTrack.name = `Drums (${groove.name})`;
      targetTrack.instrumentId = groove.kitType || 'drum_kit';
      targetTrack.clef = 'treble';

      targetTrack.measures = targetTrack.measures.map((m, mIdx) => {
        const patternMeasure = groove.measures[mIdx % groove.measures.length];
        return {
          id: m.id,
          items: patternMeasure.items.map((it) => ({
            ...it,
            id: 'n_dr_' + Math.random().toString(36).substring(2, 9),
          })),
        };
      });

      pushScoreState(nextScore);
    },
    [pushScoreState, score, selection]
  );

  // Export JSON file
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(score, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${score.title.replace(/\s+/g, '_')}_score.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON file
  const handleImportJSON = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedScore = JSON.parse(event.target?.result as string);
        if (loadedScore.tracks && Array.isArray(loadedScore.tracks)) {
          const cleanScore = sanitizeLoadedScore(loadedScore);
          setCurrentProjectId(null);
          setEditingAsTeacher(null);
          setScore(cleanScore);
          setHistory([JSON.parse(JSON.stringify(cleanScore))]);
          setHistoryIndex(0);
          setSelection({ trackIndex: 0, measureIndex: 0, itemIndex: 0 });
        }
      } catch {
        alert('Invalid score file format. Please upload a valid Noteflight Junior JSON score.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedMeasure =
    score.tracks[selection?.trackIndex ?? 0]?.measures[selection?.measureIndex ?? 0];
  const hasRepeatStart = Boolean(selectedMeasure?.repeatStart);
  const hasRepeatEnd = Boolean(selectedMeasure?.repeatEnd);
  const currentMeasureEnding: VoltaEnding = selectedMeasure?.ending || null;
  const selectedNoteLyric =
    selection && selection.itemIndex >= 0
      ? selectedMeasure?.items[selection.itemIndex]?.lyric || ''
      : '';

  if (isPrintView) {
    return (
      <PrintView
        score={score}
        onExit={() => setIsPrintView(false)}
        uiMode={uiMode}
        showPitchNames={showPitchNames}
        noteLabelMode={noteLabelMode}
        boomwhackerColors={boomwhackerColors}
        showBeatCounters={showBeatCounters}
        countingMode={countingMode}
      />
    );
  }

  const renderSharedAuthAndModals = () => (
    <>
      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
      <EdLawPrivacyModal isOpen={isEdLawModalOpen} onClose={() => setIsEdLawModalOpen(false)} />

      {isAvatarOpen && (
        <div
          onClick={() => {
            setIsAvatarOpen(false);
            adminKeyBufferRef.current = '';
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            className="relative bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-4 sm:p-5 shadow-2xl max-w-sm w-full flex flex-col items-center gap-3 animate-in zoom-in-95 duration-150 cursor-pointer select-none"
          >
            <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden bg-black border border-slate-700 shadow-xl ring-2 ring-amber-400/30">
              <img
                src="/mr-arthur-avatar.jpg"
                alt="Mr. Arthur"
                className="w-full h-full object-contain cursor-pointer"
              />
            </div>

            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300 font-['Fredoka',sans-serif]">
                Welcome to
              </div>
              <div className="text-xl font-black bg-gradient-to-r from-amber-300 via-rose-300 to-sky-300 bg-clip-text text-transparent font-['Fredoka',sans-serif]">
                Mr. Arthur&apos;s Music Lab
              </div>
              <p className="text-xs text-slate-400 mt-1">Click image or anywhere to close</p>
            </div>
          </div>
        </div>
      )}

      <ClassroomModal
        isOpen={isClassroomModalOpen}
        onClose={() => {
          setIsClassroomModalOpen(false);
          setOpenInTeacherMode(false);
        }}
        openInTeacherMode={openInTeacherMode}
        studentSession={studentSession}
        onStudentLoginSuccess={(session, projects) => {
          setStudentSession(session);
          saveStudentSession(session);
          setEditingAsTeacher(null);
          if (
            !score.composer.trim() ||
            score.composer.trim().toLowerCase() === 'student composer'
          ) {
            setScore((prev) => ({ ...prev, composer: session.firstName }));
          }
          if (projects.length === 0) {
            setIsClassroomModalOpen(false);
          }
        }}
        onStudentLogout={() => {
          setStudentSession(null);
          saveStudentSession(null);
          setCurrentProjectId(null);
          setEditingAsTeacher(null);
          setCloudSaveStatus('idle');
        }}
        onStudentUpdateSession={(updatedSession) => {
          setStudentSession(updatedSession);
        }}
        currentScore={score}
        currentProjectId={currentProjectId}
        onLoadProject={(proj, asTeacher) => {
          setCurrentProjectId(proj.id);
          if (asTeacher) {
            setEditingAsTeacher(asTeacher);
          } else {
            setEditingAsTeacher(null);
          }

          // If the song belongs to Beat Machine, load song and switch directly to Beat Machine!
          if (proj.appType === 'beat-machine') {
            if (proj.projectData) {
              setBeatMachineLoadedSong(proj.projectData);
            }
            handleSelectApp('beat-machine');
            return;
          }

          // If the song belongs to Rhythm Rock Stars, switch to Rhythm Rock Stars!
          if (proj.appType === 'rhythm-rockstars') {
            handleSelectApp('rhythm-rockstars');
            return;
          }

          // If the song belongs to Studio DAW, load project and switch directly to DAW!
          if (proj.appType === 'daw') {
            if (proj.projectData) {
              setDawLoadedProject(proj.projectData);
            }
            handleSelectApp('daw');
            return;
          }

          // Default: Staff Composer
          const clean = sanitizeLoadedScore(proj.score || DEFAULT_BLANK_SCORE);
          clean.title = proj.title;
          setScore(clean);
          setHistory([JSON.parse(JSON.stringify(clean))]);
          setHistoryIndex(0);
          setSelection({ trackIndex: 0, measureIndex: 0, itemIndex: 0 });
          handleSelectApp('staff-composer');
        }}
        onStartNewSong={() => {
          handleNewBlankScore();
          handleSelectApp('staff-composer');
        }}
        onManualSaveCurrentSong={async (customTitle) => {
          if (!studentSession) return;
          const nextTitle = (customTitle || score.title || '').trim();
          const nextScore: Score = {
            ...score,
            title: nextTitle,
            composer:
              !score.composer.trim() ||
              score.composer.trim().toLowerCase() === 'student composer'
                ? studentSession.firstName
                : score.composer,
          };
          setScore(nextScore);
          const res = await saveStudentProject({
            studentId: studentSession.id,
            pin: studentSession.pin,
            projectId: currentProjectId,
            title: nextTitle,
            score: nextScore,
            appType: 'staff-composer',
          });
          if (res.saved && res.project) {
            setCurrentProjectId(res.project.id);
            setCloudSaveStatus('saved');
          }
        }}
        editingAsTeacher={editingAsTeacher}
        onExitTeacherEditMode={() => {
          setEditingAsTeacher(null);
          setCurrentProjectId(null);
          setCloudSaveStatus('idle');
        }}
      />

      <ClassroomToolBoxModal
        isOpen={isToolBoxModalOpen}
        onClose={() => setIsToolBoxModalOpen(false)}
        initialTool={toolBoxInitialTool}
      />
    </>
  );

  if (currentApp === 'hub') {
    return (
      <>
        <MusicLabLanding
          onSelectApp={handleSelectApp}
          studentSession={studentSession}
          onOpenClassroom={() => {
            setOpenInTeacherMode(false);
            setIsClassroomModalOpen(true);
          }}
          onOpenEdLaw={() => setIsEdLawModalOpen(true)}
          onOpenAvatar={() => {
            soundEngine.playWelcomeChime();
            setIsAvatarOpen(true);
          }}
        />
        {renderSharedAuthAndModals()}
      </>
    );
  }

  if (currentApp === 'rhythm-rockstars') {
    return (
      <>
        <RhythmRockStarsApp
          onBackToHub={handleBackToHub}
          studentSession={studentSession}
          onOpenClassroomModal={() => {
            setOpenInTeacherMode(false);
            setIsClassroomModalOpen(true);
          }}
          onOpenAvatar={() => {
            soundEngine.playWelcomeChime();
            setIsAvatarOpen(true);
          }}
        />
        {renderSharedAuthAndModals()}
      </>
    );
  }

  if (currentApp === 'beat-machine') {
    return (
      <>
        <BeatMachineApp
          onBackToHub={handleBackToHub}
          studentSession={studentSession}
          loadedSongData={beatMachineLoadedSong}
          onClearLoadedSongData={() => setBeatMachineLoadedSong(null)}
          currentProjectId={currentProjectId}
          onProjectSaved={(newId) => setCurrentProjectId(newId)}
          onOpenClassroomModal={() => {
            setOpenInTeacherMode(false);
            setIsClassroomModalOpen(true);
          }}
          onOpenAvatar={() => {
            soundEngine.playWelcomeChime();
            setIsAvatarOpen(true);
          }}
        />
        {renderSharedAuthAndModals()}
      </>
    );
  }

  if (currentApp === 'daw') {
    return (
      <>
        <DawApp
          onBackToHub={handleBackToHub}
          studentSession={studentSession}
          loadedProjectData={dawLoadedProject}
          onClearLoadedProjectData={() => setDawLoadedProject(null)}
          currentProjectId={currentProjectId}
          onProjectSaved={(newId) => setCurrentProjectId(newId)}
          onOpenClassroomModal={() => {
            setOpenInTeacherMode(false);
            setIsClassroomModalOpen(true);
          }}
          onOpenAvatar={() => {
            soundEngine.playWelcomeChime();
            setIsAvatarOpen(true);
          }}
        />
        {renderSharedAuthAndModals()}
      </>
    );
  }

  if (currentApp === 'staff-wars') {
    return (
      <>
        <StaffWarsApp
          onBackToHub={handleBackToHub}
          studentSession={studentSession}
        />
        {renderSharedAuthAndModals()}
      </>
    );
  }

  return (
    <div
      className={`${
        isFullScreen ? 'fixed inset-0 z-50' : 'min-h-screen'
      } bg-[#0B0F19] flex flex-col font-sans select-none text-slate-100`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Strict Classroom Profanity Filter Alert Banner */}
      {profanityAlert && (
        <div className="w-full bg-rose-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-lg z-50">
          <span>⚠️</span>
          <span>{profanityAlert}</span>
          <button
            onClick={() => setProfanityAlert(null)}
            className="ml-3 px-2 py-0.5 rounded bg-rose-800/80 hover:bg-rose-800 text-[11px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isFullScreen && (
        <TransportBar
          onBackToHub={handleBackToHub}
          title={score.title}
          composer={score.composer}
          onChangeTitle={(t) => {
            if (containsProfanity(t)) {
              triggerProfanityAlert('the song title');
              return;
            }
            const next = { ...score, title: t };
            setScore(next);
          }}
          onChangeComposer={(c) => {
            if (containsProfanity(c)) {
              triggerProfanityAlert('the composer name');
              return;
            }
            const next = { ...score, composer: c };
            setScore(next);
          }}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onRewind={handleRewind}
          isLoopingMeasure={isLoopingMeasure}
          onToggleLoopMeasure={() => setIsLoopingMeasure((v) => !v)}
          selectedMeasureNumber={(selection?.measureIndex ?? 0) + 1}
          tempo={score.tempo}
          onChangeTempo={(bpm) => {
            const next = { ...score, tempo: bpm };
            setScore(next);
          }}
          metronome={metronome}
          onToggleMetronome={() => setMetronome((v) => !v)}
          timeSignature={score.timeSignature}
          onChangeTimeSignature={(ts) => {
            const nextScore: Score = JSON.parse(JSON.stringify(score));
            nextScore.timeSignature = ts;
            const newCapacity = getMeasureCapacity(ts);
            nextScore.tracks.forEach((t) => {
              t.measures.forEach((m) => {
                m.items = cleanMeasureRests(m.items, newCapacity);
              });
            });
            pushScoreState(nextScore);
          }}
          keySignature={score.keySignature}
          onChangeKeySignature={(ks) => {
            const next = { ...score, keySignature: ks };
            pushScoreState(next);
          }}
          onAddMeasure={handleAddMeasure}
          onOpenTemplates={() => setIsTemplatesModalOpen(true)}
          onOpenEnsembleTemplates={() => setIsEnsembleTemplatesModalOpen(true)}
          onOpenToolBox={() => {
            setToolBoxInitialTool('tempo-tapper');
            setIsToolBoxModalOpen(true);
          }}
          onPrint={() => setIsPrintView(true)}
          onOpenInstrumentManager={() => setIsInstrumentModalOpen(true)}
          onOpenDrumBeats={() => setIsDrumBeatsModalOpen(true)}
          onNewBlankScore={handleNewBlankScore}
          trackCount={score.tracks.length}
          onToggleMixer={() => setIsMixerOpen(true)}
          onShare={handleShare}
          viewLayout={viewLayout}
          onChangeViewLayout={setViewLayout}
          onEnterFullScreen={handleEnterFullScreen}
          noteLabelMode={noteLabelMode}
          onChangeNoteLabelMode={setNoteLabelMode}
          boomwhackerColors={boomwhackerColors}
          onToggleBoomwhackerColors={() => setBoomwhackerColors((v) => !v)}
          countingMode={countingMode}
          onChangeCountingMode={setCountingMode}
          showBeatCounters={showBeatCounters}
          onToggleBeatCounters={() =>
            setCountingMode((prev) => (prev === 'off' ? 'numbers' : 'off'))
          }
          lastSavedTime={lastSavedTime}
          studentFirstName={studentSession?.firstName || null}
          editingAsTeacherStudentName={editingAsTeacher?.studentName || null}
          cloudSaveStatus={cloudSaveStatus}
          onOpenClassroomModal={() => {
            setOpenInTeacherMode(false);
            setIsClassroomModalOpen(true);
          }}
          isAvatarOpen={isAvatarOpen}
          onOpenAvatar={() => setIsAvatarOpen(true)}
          onCloseAvatar={() => {
            setIsAvatarOpen(false);
            adminKeyBufferRef.current = '';
          }}
          onExportPdf={() => exportScoreToPdf(score)}
          onExportWav={() => soundEngine.exportWav(score)}
          onExportMidi={() => exportScoreToMidi(score)}
          onExportMusicXml={() => exportScoreToMusicXml(score)}
          onExportJson={handleExportJSON}
          onImportJson={handleImportJSON}
          onOpenHelp={() => setIsHelpModalOpen(true)}
        />
      )}

      <main
        id="staff-composer-main-scroll"
        className={`flex-1 overflow-auto bg-gradient-to-b from-[#0B0F19] via-[#0D1527] to-[#070A12] flex flex-col items-center ${
          isFullScreen ? 'p-2 sm:p-4 pb-20' : 'p-4 sm:p-6 pb-32'
        } relative`}
      >
        <div className="w-full max-w-full flex flex-col items-center gap-3">
          {isFullScreen ? (
            <FullScreenMiniPalette
              title={score.title}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onRewind={handleRewind}
              isSelectMode={isSelectMode}
              onToggleSelectMode={() => setIsSelectMode((v) => !v)}
              activeDuration={activeDuration}
              onChangeDuration={handleChangeDuration}
              isRestMode={isRestMode}
              onToggleRestMode={() => setIsRestMode((v) => !v)}
              isDotted={isDotted}
              onToggleDotted={handleToggleDotted}
              activeAccidental={activeAccidental}
              onChangeAccidental={handleChangeAccidental}
              onDeleteSelected={handleDeleteSelected}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onAddMeasure={handleAddMeasure}
              viewLayout={viewLayout}
              onChangeViewLayout={setViewLayout}
              scoreZoom={fullScreenZoom}
              onChangeScoreZoom={setFullScreenZoom}
              onExitFullScreen={handleExitFullScreen}
            />
          ) : (
            <RhythmicPalette
              uiMode={uiMode}
              onChangeUiMode={handleChangeUiMode}
              onReset={handleReset}
              onAddMeasure={handleAddMeasure}
              isSelectMode={isSelectMode}
              onToggleSelectMode={() => setIsSelectMode((v) => !v)}
              activeDuration={activeDuration}
              onChangeDuration={handleChangeDuration}
              isRestMode={isRestMode}
              onToggleRestMode={() => setIsRestMode((v) => !v)}
              isDotted={isDotted}
              onToggleDotted={handleToggleDotted}
              isTied={isTied}
              onToggleTied={handleToggleTied}
              isTriplet={isTriplet}
              onToggleTriplet={handleToggleTriplet}
              activeAccidental={activeAccidental}
              onChangeAccidental={handleChangeAccidental}
              activeArticulation={activeArticulation}
              onChangeArticulation={handleChangeArticulation}
              activeDynamic={activeDynamic}
              onChangeDynamic={handleChangeDynamic}
              currentMeasureHasRepeatStart={hasRepeatStart}
              currentMeasureHasRepeatEnd={hasRepeatEnd}
              currentMeasureEnding={currentMeasureEnding}
              onToggleEnding={handleToggleEnding}
              onToggleRepeatStart={handleToggleRepeatStart}
              onToggleRepeatEnd={handleToggleRepeatEnd}
              onToggleRepeatMeasure={handleToggleRepeatMeasure}
              onRepeatWholeSong={handleRepeatWholeSong}
              onClearAllRepeats={handleClearAllRepeats}
              selectedNoteLyric={selectedNoteLyric}
              onUpdateSelectedNoteLyric={handleUpdateSelectedNoteLyric}
              onDeleteSelected={handleDeleteSelected}
              selection={selection}
              hasClipboard={measureClipboard !== null && measureClipboard.length > 0}
              onCopyMeasure={handleCopyMeasure}
              onPasteMeasure={handlePasteMeasure}
              onMoveMeasureLeft={handleMoveMeasureLeft}
              onMoveMeasureRight={handleMoveMeasureRight}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onOpenHelp={() => setIsHelpModalOpen(true)}
            />
          )}

          <ScoreRenderer
              score={score}
              selection={selection}
              onSelect={handleSelect}
              onUpdateTrack={handleUpdateTrack}
              onNoteInsertOrUpdate={(tIdx, mIdx, iIdx, pitch, targetBeat, isDragUpdate, origPitch) =>
                handleNoteInsertOrUpdate(tIdx, mIdx, iIdx, pitch, targetBeat, isDragUpdate, origPitch)
              }
              onPlayPreview={handlePlayPreview}
              onShiftSelectedPitch={shiftSelectedPitch}
              onTransposeMeasure={handleTransposeMeasure}
              onDeleteSelected={handleDeleteSelected}
              onQuickAccidental={handleChangeAccidental}
              isSelectMode={isSelectMode}
              isRestMode={isRestMode}
              uiMode={uiMode}
              viewLayout={viewLayout}
              scoreZoom={isFullScreen ? fullScreenZoom : 1}
              activeDuration={activeDuration}
              activeAccidental={activeAccidental}
              activeDotted={isDotted}
              activeTriplet={isTriplet}
              showPitchNames={showPitchNames}
              noteLabelMode={noteLabelMode}
              boomwhackerColors={boomwhackerColors}
              showBeatCounters={showBeatCounters}
              countingMode={countingMode}
              playheadPosition={playheadPosition}
              activePlayingNoteIds={activePlayingNoteIds}
            />

          {/* Visible Site Footer with NY Ed Law § 2-d & Parents' Bill of Rights */}
          {!isFullScreen && (
            <footer className="w-full max-w-5xl mt-12 mb-6 pt-5 pb-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 print:hidden">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <span className="font-bold text-slate-300">Mr. Arthur&apos;s Staff Composer</span>
                <span className="opacity-40">•</span>
                <span>Elementary &amp; Middle School Music</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsEdLawModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 font-semibold transition-all cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>NY Ed Law § 2-d &amp; Parents&apos; Bill of Rights</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsHelpModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  Help &amp; Shortcuts
                </button>
              </div>
            </footer>
          )}
        </div>
      </main>

      <TrackStrip
        tracks={score.tracks}
        onUpdateTrack={handleUpdateTrack}
        onRemoveTrack={handleRemoveTrack}
        isOpen={isMixerOpen}
        onClose={() => setIsMixerOpen(false)}
        onOpenAddInstrument={() => setIsInstrumentModalOpen(true)}
      />

      <VirtualPiano
        onPlayAndInsertPitch={handlePianoKeyClick}
        boomwhackerColors={boomwhackerColors}
        isOpen={isPianoOpen}
        onToggleOpen={() => setIsPianoOpen((v) => !v)}
      />

      <InstrumentModal
        isOpen={isInstrumentModalOpen}
        onClose={() => setIsInstrumentModalOpen(false)}
        onSelectInstrument={handleAddInstrument}
        onAddGrandPiano={handleAddGrandPiano}
        onOpenDrumBeats={() => setIsDrumBeatsModalOpen(true)}
      />

      <DrumBeatsModal
        isOpen={isDrumBeatsModalOpen}
        onClose={() => setIsDrumBeatsModalOpen(false)}
        onAddDrumTrack={handleAddDrumTrack}
        onApplyToSelectedTrack={handleApplyGrooveToSelectedTrack}
        hasSelectedTrack={selection !== null}
      />

      <TemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSelectScore={(newScore) => {
          setCurrentProjectId(null);
          setEditingAsTeacher(null);
          setScore(newScore);
          setHistory([JSON.parse(JSON.stringify(newScore))]);
          setHistoryIndex(0);
          setSelection({ trackIndex: 0, measureIndex: 0, itemIndex: 0 });
        }}
      />

      <EnsembleTemplatesModal
        isOpen={isEnsembleTemplatesModalOpen}
        onClose={() => setIsEnsembleTemplatesModalOpen(false)}
        onSelectScore={(newScore) => {
          setCurrentProjectId(null);
          setEditingAsTeacher(null);
          setScore(newScore);
          setHistory([JSON.parse(JSON.stringify(newScore))]);
          setHistoryIndex(0);
          setSelection({ trackIndex: 0, measureIndex: 0, itemIndex: 0 });
        }}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={shareUrl}
        isLoading={isGeneratingShareLink}
      />

      {renderSharedAuthAndModals()}
    </div>
  );
}
