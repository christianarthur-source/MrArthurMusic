import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { audioEngine } from '../../services/audioEngine';
import { studioAudioEngine, TrackWaveformData } from '../../services/pitchShifterAudio';
import {
  generateRecorderAccompaniment,
  generateOrffGroove,
  generateSteadyBeatMarch
} from '../../services/soundGenerator';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Upload,
  FolderOpen,
  Bookmark,
  Volume2,
  Sliders,
  Repeat,
  Shuffle,
  Music,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  ListMusic,
  FileAudio,
  Activity,
  Layers,
  Loader2,
  VolumeX,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export interface StudioTrack {
  id: string;
  title: string;
  url: string;
  artist?: string;
  duration?: number;
  source: 'local' | 'uploaded' | 'bundled';
  fileType?: string;
}

interface Marker {
  id: string;
  time: number;
  label: string;
  notes?: string;
}

export const AudioStudioView: React.FC = () => {
  const { showToast } = useApp();

  // Playlist State initialized with bundled classroom accompaniment tracks
  const [playlist, setPlaylist] = useState<StudioTrack[]>(() => {
    try {
      return [
        {
          id: 'bundle-1',
          title: 'Recorder Karate Backing Track (76 BPM)',
          url: generateRecorderAccompaniment(),
          artist: 'Classroom Accompaniment',
          source: 'bundled',
          fileType: 'WAV'
        },
        {
          id: 'bundle-2',
          title: 'Orff Pentatonic Jam (C Major, 104 BPM)',
          url: generateOrffGroove(),
          artist: 'Mallet Ensemble Ostinato',
          source: 'bundled',
          fileType: 'WAV'
        },
        {
          id: 'bundle-3',
          title: 'Steady Beat Drum Cadence & March (116 BPM)',
          url: generateSteadyBeatMarch(),
          artist: 'Elementary Movement Track',
          source: 'bundled',
          fileType: 'WAV'
        }
      ];
    } catch {
      return [];
    }
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(24);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [pitchShift, setPitchShift] = useState<number>(0);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);

  // Rehearsal Markers
  const [markers, setMarkers] = useState<Marker[]>([
    { id: 'm-1', time: 4.0, label: 'Recorder Ready Position', notes: 'Check breath support and left thumb hole coverage' },
    { id: 'm-2', time: 12.0, label: 'Section B Transition', notes: 'Transition from B-A to low G finger position' }
  ]);
  const [newMarkerLabel, setNewMarkerLabel] = useState('');

  // DAW Waveform Data & Audio Engine State
  const [waveformData, setWaveformData] = useState<TrackWaveformData | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentTrack = playlist[currentTrackIndex] || null;

  // Whenever the active track changes, decode its PCM data and extract real waveform peaks
  useEffect(() => {
    let isCancelled = false;
    if (!currentTrack) {
      setWaveformData(null);
      return;
    }

    setIsLoadingAudio(true);
    studioAudioEngine.stop();
    setIsPlaying(false);
    setCurrentTime(0);
    setLoopA(null);
    setLoopB(null);

    studioAudioEngine
      .loadTrack(currentTrack.url, currentTrack.id)
      .then((data) => {
        if (!isCancelled) {
          setWaveformData(data);
          setDuration(data.duration);
          setIsLoadingAudio(false);
          studioAudioEngine.setPitch(pitchShift);
          studioAudioEngine.setSpeed(playbackRate);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to decode track waveform:', err);
          setIsLoadingAudio(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentTrackIndex, playlist]);

  // Audio Engine Subscriptions: 60fps Playhead Time Updates & Progression
  useEffect(() => {
    const unsubTime = studioAudioEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });
    const unsubEnd = studioAudioEngine.onEnded(() => {
      handleEnded();
    });
    const unsubState = studioAudioEngine.onStateChange((state) => {
      setIsPlaying(state === 'playing');
    });

    return () => {
      unsubTime();
      unsubEnd();
      unsubState();
    };
  }, [currentTrackIndex, repeatMode, playlist.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      studioAudioEngine.stop();
    };
  }, []);

  // Handle Real-Time Pitch Shifting (Native Web Audio Detune)
  const handlePitchChange = (newPitch: number) => {
    const clamped = Math.max(-12, Math.min(12, newPitch));
    setPitchShift(clamped);
    studioAudioEngine.setPitch(clamped);

    const semitoneStr = clamped > 0 ? `+${clamped}` : `${clamped}`;
    showToast(
      clamped === 0
        ? 'Pitch reset to original key (0¢)'
        : `Pitch shifted ${semitoneStr} semitone${Math.abs(clamped) === 1 ? '' : 's'} (${clamped > 0 ? `+${clamped * 100}` : clamped * 100}¢)`,
      'info'
    );
  };

  // Handle Real-Time Playback Speed
  const handleSpeedChange = (newRate: number) => {
    const clamped = Math.max(0.5, Math.min(1.5, Math.round(newRate * 100) / 100));
    setPlaybackRate(clamped);
    studioAudioEngine.setSpeed(clamped);
  };

  // Handle Play / Pause
  const togglePlay = async () => {
    if (!currentTrack) {
      showToast('Select or upload a track to play', 'info');
      return;
    }

    if (isPlaying) {
      studioAudioEngine.pause();
    } else {
      await studioAudioEngine.unlock();
      studioAudioEngine.play();
    }
  };

  // Seek immediately
  const seekTo = (time: number) => {
    const clamped = Math.max(0, Math.min(duration, time));
    setCurrentTime(clamped);
    studioAudioEngine.seek(clamped);
  };

  // Skip to Previous Track
  const handlePreviousTrack = () => {
    if (playlist.length === 0) return;
    if (currentTime > 3) {
      // If past 3 seconds, jump to start of current track
      seekTo(0);
    } else {
      const prevIdx = (currentTrackIndex - 1 + playlist.length) % playlist.length;
      setCurrentTrackIndex(prevIdx);
    }
  };

  // Skip to Next Track
  const handleNextTrack = () => {
    if (playlist.length === 0) return;
    let nextIdx = (currentTrackIndex + 1) % playlist.length;
    if (isShuffle && playlist.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * playlist.length);
      } while (nextIdx === currentTrackIndex);
    }
    setCurrentTrackIndex(nextIdx);
  };

  // On audio ended handler (Playlist progression)
  const handleEnded = () => {
    if (repeatMode === 'one') {
      studioAudioEngine.seek(0);
      studioAudioEngine.play();
    } else if (repeatMode === 'all' || currentTrackIndex < playlist.length - 1) {
      handleNextTrack();
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  // Pick Local Files from User's Machine (File System Access API or fallback file input)
  const handlePickLocalFiles = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const fileHandles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Audio Files',
              accept: {
                'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']
              }
            }
          ]
        });

        const newTracks: StudioTrack[] = [];
        for (const handle of fileHandles) {
          const file = await handle.getFile();
          const url = URL.createObjectURL(file);
          const ext = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
          newTracks.push({
            id: 'local-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            title: file.name.replace(/\.[^/.]+$/, ''),
            url,
            artist: 'Local Device File',
            source: 'local',
            fileType: ext
          });
        }

        if (newTracks.length > 0) {
          setPlaylist((prev) => [...prev, ...newTracks]);
          setCurrentTrackIndex(playlist.length); // jump to first newly added
          showToast(`Added ${newTracks.length} local file(s) to playlist`, 'success');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // If cancelled, do nothing. If error, fallback to standard input.
          fileInputRef.current?.click();
        }
      }
    } else {
      // Fallback for browsers without File System Access API
      fileInputRef.current?.click();
    }
  };

  // Standard input fallback for file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newTracks: StudioTrack[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      const ext = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
      newTracks.push({
        id: 'upload-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: file.name.replace(/\.[^/.]+$/, ''),
        url,
        artist: 'Uploaded File',
        source: 'uploaded',
        fileType: ext
      });
    }

    if (newTracks.length > 0) {
      const newPlaylist = [...playlist, ...newTracks];
      const startIndex = playlist.length;
      setPlaylist(newPlaylist);
      setCurrentTrackIndex(startIndex);
      showToast(`Added ${newTracks.length} track(s) to playlist`, 'success');
    }

    // Reset input value so same file can be re-uploaded if desired
    e.target.value = '';
  };

  const removeTrackFromPlaylist = (indexToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playlist.length <= 1) {
      showToast('Playlist must have at least one track', 'warning');
      return;
    }

    const updated = playlist.filter((_, idx) => idx !== indexToRemove);
    setPlaylist(updated);

    if (indexToRemove === currentTrackIndex) {
      setCurrentTrackIndex(Math.min(currentTrackIndex, updated.length - 1));
    } else if (indexToRemove < currentTrackIndex) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
    showToast('Track removed from playlist', 'info');
  };

  // True DAW Waveform Visualization Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // 1. Dark DAW Slate Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const effectiveDuration = duration > 0 ? duration : 30;
    const centerY = height / 2;

    // 2. Draw DAW Time Gridlines & Markers (every 5 seconds)
    const intervalSec = effectiveDuration > 60 ? 10 : 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '9px JetBrains Mono, monospace';

    for (let sec = 0; sec <= effectiveDuration; sec += intervalSec) {
      const x = (sec / effectiveDuration) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      const timeLabel = formatTime(sec);
      ctx.fillText(timeLabel, x + 3, 11);
    }

    // Center 0dB Axis Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // 3. A-B Loop Region Highlight Overlay
    if (loopA !== null && loopB !== null && loopB > loopA) {
      const loopX1 = (loopA / effectiveDuration) * width;
      const loopX2 = (loopB / effectiveDuration) * width;
      const loopW = loopX2 - loopX1;

      // Golden Amber Shaded Fill
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.fillRect(loopX1, 0, loopW, height);

      // Loop Boundaries
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(loopX1, 0, loopW, height);

      // [A] & [B] Badges
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText('[A]', loopX1 + 2, height - 4);
      ctx.fillText('[B]', loopX2 - 16, height - 4);
    }

    // 4. Draw Real Decoded Waveform Peaks
    const points = waveformData?.points;
    const numPoints = points ? points.length : 0;
    const playheadX = (currentTime / effectiveDuration) * width;

    if (numPoints > 0) {
      const barWidth = width / numPoints;

      for (let i = 0; i < numPoints; i++) {
        const x = i * barWidth;
        const pt = points![i];
        const isPast = x <= playheadX;

        // Amplitude height: scale max/min to height/2
        const peakMax = Math.max(0.04, pt.max);
        const peakMin = Math.min(-0.04, pt.min);
        const yTop = centerY - peakMax * (centerY * 0.9);
        const yBottom = centerY - peakMin * (centerY * 0.9);
        const h = Math.max(2, yBottom - yTop);

        if (isPast) {
          // Vibrant Radiant Played Peak (Rose to Purple gradient)
          const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
          grad.addColorStop(0, '#fb7185'); // rose-400
          grad.addColorStop(0.5, '#e11d48'); // rose-600
          grad.addColorStop(1, '#818cf8'); // indigo-400
          ctx.fillStyle = grad;
        } else {
          // Unplayed Peak Silhouette (Dark sleek studio slate)
          ctx.fillStyle = '#334155'; // slate-700
        }

        ctx.fillRect(x, yTop, Math.max(1, barWidth - 0.5), h);

        // Subtle RMS core highlight
        if (pt.rms > 0.05) {
          const rmsH = pt.rms * (centerY * 0.9);
          ctx.fillStyle = isPast ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(x, centerY - rmsH, Math.max(1, barWidth - 0.5), rmsH * 2);
        }
      }
    } else {
      // Loading / Fallback placeholder
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText('Decoding DAW waveform data...', width / 2 - 90, centerY + 4);
    }

    // 5. Rehearsal Markers Overlay
    markers.forEach((m, idx) => {
      const mx = (m.time / effectiveDuration) * width;
      if (mx >= 0 && mx <= width) {
        ctx.strokeStyle = '#06b6d4'; // cyan-500
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(mx, 14);
        ctx.lineTo(mx, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Marker Flag Tag
        ctx.fillStyle = '#0891b2';
        ctx.fillRect(mx - 2, 0, 18, 12);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.fillText(`M${idx + 1}`, mx + 1, 9);
      }
    });

    // 6. Hover Ghost Scrubber
    if (hoverTime !== null && hoverTime >= 0 && hoverTime <= effectiveDuration) {
      const hx = (hoverTime / effectiveDuration) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, height);
      ctx.stroke();

      // Floating time tooltip
      const tooltip = formatTime(hoverTime);
      const textWidth = ctx.measureText(tooltip).width;
      const tooltipX = Math.max(4, Math.min(width - textWidth - 12, hx - textWidth / 2));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(tooltipX - 4, centerY - 24, textWidth + 8, 16);
      ctx.strokeStyle = '#06b6d4';
      ctx.strokeRect(tooltipX - 4, centerY - 24, textWidth + 8, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText(tooltip, tooltipX, centerY - 13);
    }

    // 7. Glowing Playhead Needle
    if (playheadX >= 0 && playheadX <= width) {
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Top Needle Cap
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0; // reset shadow
    }
  }, [currentTime, duration, loopA, loopB, waveformData, hoverTime, markers]);

  const setLoopPointA = () => {
    setLoopA(currentTime);
    studioAudioEngine.setLoopA(currentTime);
    showToast(`Loop Start set at ${formatTime(currentTime)}`, 'info');
  };

  const setLoopPointB = () => {
    if (loopA !== null && currentTime <= loopA) {
      showToast('Loop End must be after Loop Start', 'warning');
      return;
    }
    setLoopB(currentTime);
    studioAudioEngine.setLoopB(currentTime);
    showToast(`Loop End set at ${formatTime(currentTime)}`, 'info');
  };

  const clearLoop = () => {
    setLoopA(null);
    setLoopB(null);
    studioAudioEngine.clearLoop();
    showToast('A-B Loop cleared', 'info');
  };

  const handleAddMarker = () => {
    if (!newMarkerLabel.trim()) return;
    const newM: Marker = {
      id: 'm-' + Date.now().toString(36),
      time: Math.round(currentTime * 10) / 10,
      label: newMarkerLabel.trim()
    };
    setMarkers([...markers, newM]);
    setNewMarkerLabel('');
    showToast('Rehearsal marker added', 'success');
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Hidden File Input for fallback or standard pick */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <FileAudio className="w-5 h-5" />
            </div>
            <span>Audio Practice Studio & Playlist</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Rehearse classroom pieces, play multi-track playlists, access local computer files, and slow down tricky passages without changing pitch.
          </p>
        </div>

        {/* Action Buttons: Pick Local Machine Files + Upload */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePickLocalFiles}
            className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
            title="Browse and play local audio files on your computer"
          >
            <FolderOpen className="w-4 h-4 text-amber-400 dark:text-amber-600" />
            <span>Open Local Machine Files</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Import Audio</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Main Studio Player & Controls (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
            {/* Active Track Title & Badges */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <Music className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-stone-900 dark:text-white line-clamp-1">
                      {currentTrack ? currentTrack.title : 'No Track Selected'}
                    </h2>
                    <p className="text-xs text-stone-400">
                      {currentTrack?.artist || 'Music Teacher Hub Studio'}
                    </p>
                  </div>
                </div>

                {currentTrack && (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                      {currentTrack.fileType || 'MP3'}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        currentTrack.source === 'local'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300'
                          : currentTrack.source === 'bundled'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                          : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300'
                      }`}
                    >
                      {currentTrack.source === 'local'
                        ? 'Local File'
                        : currentTrack.source === 'bundled'
                        ? 'Classroom Backing'
                        : 'Imported'}
                    </span>
                  </div>
                )}
              </div>

              {/* DAW Waveform Visualizer Lane */}
              <div className="relative rounded-2xl bg-slate-950 p-4 overflow-hidden border border-slate-800 shadow-2xl">
                {/* DAW Lane Header */}
                <div className="flex items-center justify-between text-xs pb-2 mb-2 border-b border-slate-800/80 font-mono">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-bold text-slate-300">DAW Master Track Waveform</span>
                    <span className="text-[10px] text-slate-500 hidden sm:inline">
                      • 800 Peaks Analyzed • PCM Stereo
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isLoadingAudio ? (
                      <div className="flex items-center gap-1.5 text-cyan-400 text-[11px] animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Decoding audio waveform...</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                        Decoded & Hardware Accelerated
                      </span>
                    )}
                  </div>
                </div>

                {/* Canvas Waveform */}
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={900}
                    height={110}
                    className="w-full h-28 block cursor-crosshair rounded-xl"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = (e.clientX - rect.left) / rect.width;
                      const hoverSec = Math.max(0, Math.min(duration, pos * duration));
                      setHoverTime(hoverSec);
                    }}
                    onMouseLeave={() => setHoverTime(null)}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = (e.clientX - rect.left) / rect.width;
                      const targetSec = Math.max(0, Math.min(duration, pos * duration));
                      seekTo(targetSec);
                    }}
                  />
                </div>

                {/* DAW Scrubber Slider Bar & Time Readouts */}
                <div className="pt-2">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.05}
                    value={currentTime}
                    onChange={(e) => seekTo(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between text-xs font-mono font-bold text-slate-400 pt-1.5">
                    <span className="text-rose-400 font-extrabold">{formatTime(currentTime)}</span>
                    <span className="text-[11px] text-slate-500">
                      {duration > 0 ? `${(currentTime / duration * 100).toFixed(1)}%` : '0%'}
                    </span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transport & Playback Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Transport Panel */}
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Player Transport
                </span>
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={handlePreviousTrack}
                    className="p-2.5 rounded-xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 shadow-subtle border border-stone-200 dark:border-stone-700 transition-all active:scale-95"
                    title="Previous Track"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => seekTo(Math.max(0, currentTime - 5))}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 font-bold text-xs shadow-subtle border border-stone-200 dark:border-stone-700"
                    title="Rewind 5 seconds"
                  >
                    -5s
                  </button>

                  <button
                    onClick={togglePlay}
                    disabled={isLoadingAudio}
                    className="p-4 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 disabled:opacity-50 text-white shadow-elevated transition-all active:scale-95"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isLoadingAudio ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    ) : isPlaying ? (
                      <Pause className="w-6 h-6 fill-white" />
                    ) : (
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => seekTo(Math.min(duration, currentTime + 5))}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 font-bold text-xs shadow-subtle border border-stone-200 dark:border-stone-700"
                    title="Fast forward 5 seconds"
                  >
                    +5s
                  </button>

                  <button
                    onClick={handleNextTrack}
                    className="p-2.5 rounded-xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 shadow-subtle border border-stone-200 dark:border-stone-700 transition-all active:scale-95"
                    title="Next Track"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Playlist Modes (Shuffle / Repeat) */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setIsShuffle(!isShuffle)}
                    className={`p-1.5 rounded-lg text-xs transition-all ${
                      isShuffle
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold'
                        : 'text-stone-400 hover:text-stone-600'
                    }`}
                    title={isShuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (repeatMode === 'off') setRepeatMode('all');
                      else if (repeatMode === 'all') setRepeatMode('one');
                      else setRepeatMode('off');
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      repeatMode !== 'off'
                        ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        : 'text-stone-400 hover:text-stone-600'
                    }`}
                    title="Toggle Repeat"
                  >
                    <Repeat className="w-3 h-3" />
                    <span>{repeatMode === 'one' ? 'One' : repeatMode === 'all' ? 'All' : 'Off'}</span>
                  </button>
                </div>
              </div>

              {/* Speed & Pitch Controls */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800 space-y-3">
                {/* Speed Section */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    Rehearsal Speed
                  </span>
                  <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    {Math.round(playbackRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={playbackRate}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-stone-400">
                  <button onClick={() => handleSpeedChange(0.75)} className="hover:text-rose-600">75% (Slow)</button>
                  <button onClick={() => handleSpeedChange(1.0)} className="hover:text-rose-600 font-bold">100% (Normal)</button>
                  <button onClick={() => handleSpeedChange(1.2)} className="hover:text-rose-600">120% (Fast)</button>
                </div>

                {/* Pitch Transpose Section */}
                <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        Pitch Transpose
                      </span>
                      {pitchShift !== 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {pitchShift * 100 > 0 ? `+${pitchShift * 100}¢` : `${pitchShift * 100}¢`}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {pitchShift === 0 ? 'Original Key' : `${pitchShift > 0 ? `+${pitchShift}` : pitchShift} semitones`}
                    </span>
                  </div>

                  {/* Transpose Slider */}
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={pitchShift}
                    onChange={(e) => handlePitchChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />

                  {/* Quick Transpose Semitone Buttons */}
                  <div className="grid grid-cols-7 gap-1 text-[11px] font-mono font-bold pt-1">
                    {[-3, -2, -1, 0, 1, 2, 3].map((val) => {
                      const label = val > 0 ? `+${val}` : `${val}`;
                      const isActive = pitchShift === val;
                      return (
                        <button
                          key={val}
                          onClick={() => handlePitchChange(val)}
                          className={`py-1 rounded border text-center transition-all ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                          title={
                            val === 0
                              ? 'Reset to original key (0 semitones)'
                              : `Transpose to ${label} semitone${Math.abs(val) === 1 ? '' : 's'}`
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Stepper & Octave Jump Row */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 pt-1">
                    <button
                      onClick={() => handlePitchChange(-12)}
                      className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700"
                      title="Octave Down (-12 semitones)"
                    >
                      -1 Octave
                    </button>
                    <button
                      onClick={() => handlePitchChange(pitchShift - 1)}
                      className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center gap-0.5"
                      title="Nudge 1 semitone down"
                    >
                      <ArrowDown className="w-2.5 h-2.5" />
                      <span>Step</span>
                    </button>
                    <button
                      onClick={() => handlePitchChange(pitchShift + 1)}
                      className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center gap-0.5"
                      title="Nudge 1 semitone up"
                    >
                      <ArrowUp className="w-2.5 h-2.5" />
                      <span>Step</span>
                    </button>
                    <button
                      onClick={() => handlePitchChange(12)}
                      className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700"
                      title="Octave Up (+12 semitones)"
                    >
                      +1 Octave
                    </button>
                  </div>
                </div>
              </div>

              {/* A-B Section Loop */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-amber-500" />
                  A–B Loop Section Repeat
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={setLoopPointA}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      loopA !== null
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
                        : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    Set A ({loopA !== null ? formatTime(loopA) : 'Start'})
                  </button>
                  <button
                    onClick={setLoopPointB}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      loopB !== null
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
                        : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    Set B ({loopB !== null ? formatTime(loopB) : 'End'})
                  </button>
                </div>

                <button
                  onClick={clearLoop}
                  disabled={loopA === null && loopB === null}
                  className="w-full py-1.5 rounded-xl bg-stone-200 dark:bg-stone-700 disabled:opacity-40 text-stone-700 dark:text-stone-300 text-xs font-semibold"
                >
                  Clear Loop Points
                </button>
              </div>
            </div>

            {/* Rehearsal Markers & Timestamp Notes */}
            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-brand-600" />
                  Rehearsal Timestamps & Section Markers
                </h3>
                <span className="text-xs text-stone-400">{markers.length} markers</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newMarkerLabel}
                  onChange={(e) => setNewMarkerLabel(e.target.value)}
                  placeholder="Marker name (e.g. Alto entrance, Bridge)..."
                  className="sm:col-span-2 text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                />
                <button
                  onClick={handleAddMarker}
                  disabled={!newMarkerLabel.trim()}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Mark at {formatTime(currentTime)}</span>
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {markers.map((marker) => (
                  <div
                    key={marker.id}
                    onClick={() => seekTo(marker.time)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-800 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/80 font-mono text-xs font-bold text-rose-700 dark:text-rose-300">
                        {formatTime(marker.time)}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 dark:text-white">
                          {marker.label}
                        </h4>
                        {marker.notes && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400">
                            {marker.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMarkers(markers.filter((m) => m.id !== marker.id));
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Studio Playlist (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-stone-900 dark:text-white text-sm">
                  Classroom Playlist
                </h3>
              </div>
              <span className="text-xs font-bold text-stone-400">
                {playlist.length} track{playlist.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Quick Add Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePickLocalFiles}
                className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-stone-200 dark:border-stone-700 transition-all"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                <span>+ Local Files</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-stone-200 dark:border-stone-700 transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-brand-600" />
                <span>+ Upload File</span>
              </button>
            </div>

            {/* Playlist Track List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {playlist.map((track, idx) => {
                const isSelected = idx === currentTrackIndex;

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      setCurrentTrackIndex(idx);
                      setIsPlaying(true);
                    }}
                    className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 shadow-sm'
                        : 'bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800/70 border-stone-200/50 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                          isSelected
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        {isSelected && isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3.5">
                            <span className="w-0.5 h-full bg-white animate-pulse" />
                            <span className="w-0.5 h-2 bg-white animate-bounce" />
                            <span className="w-0.5 h-full bg-white animate-pulse" />
                          </div>
                        ) : (
                          idx + 1
                        )}
                      </div>

                      <div className="overflow-hidden">
                        <h4
                          className={`text-xs font-bold truncate ${
                            isSelected
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-stone-900 dark:text-white'
                          }`}
                        >
                          {track.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                          <span>{track.artist || 'Local'}</span>
                          <span>•</span>
                          <span className="uppercase">{track.fileType || 'MP3'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => removeTrackFromPlaylist(idx, e)}
                      className="p-1 text-stone-400 hover:text-rose-500 transition-colors"
                      title="Remove from playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-2xl text-[11px] text-stone-500 space-y-1">
              <p className="font-semibold text-stone-700 dark:text-stone-300">
                💡 Local Files on School Laptop
              </p>
              <p>
                Click <strong>"Open Local Machine Files"</strong> to select backing MP3s/WAVs directly from your documents or downloads folder.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
