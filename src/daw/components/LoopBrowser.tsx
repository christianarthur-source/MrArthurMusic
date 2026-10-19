import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Play,
  Square,
  Plus,
  Upload,
  Sparkles,
  Volume2,
  Filter,
  X,
} from 'lucide-react';
import { DAW_LOOP_CATALOG } from '../data/loopCatalog';
import { DawLoopCategory, DawLoopGenre, DawLoopItem } from '../types';
import { decodeUploadedAudio, getOrGenerateLoopAudio } from '../audio/loopGenerator';

interface LoopBrowserProps {
  audioCtx: BaseAudioContext;
  onAddLoopToTimeline: (loop: DawLoopItem, buffer: AudioBuffer, waveform: number[]) => void;
  onUploadAudioFile: (file: File) => void;
  onClose: () => void;
}

export const LoopBrowser: React.FC<LoopBrowserProps> = ({
  audioCtx,
  onAddLoopToTimeline,
  onUploadAudioFile,
  onClose,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<'all' | DawLoopGenre>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | DawLoopCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewingLoopId, setPreviewingLoopId] = useState<string | null>(null);
  const [isLoadingLoopId, setIsLoadingLoopId] = useState<string | null>(null);

  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop preview audio
  const stopPreview = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {}
      previewSourceRef.current = null;
    }
    setPreviewingLoopId(null);
  };

  // Preview or stop a loop
  const handleTogglePreview = async (loop: DawLoopItem) => {
    if (previewingLoopId === loop.id) {
      stopPreview();
      return;
    }

    stopPreview();
    setIsLoadingLoopId(loop.id);

    try {
      const { buffer } = await getOrGenerateLoopAudio(loop, audioCtx);
      setIsLoadingLoopId(null);
      setPreviewingLoopId(loop.id);

      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.75, 0);

      src.connect(gain);
      gain.connect(audioCtx.destination);

      // Play twice then automatically stop
      const playDuration = buffer.duration * 2;
      src.start(0);
      src.stop(audioCtx.currentTime + playDuration);

      src.onended = () => {
        if (previewSourceRef.current === src) {
          previewSourceRef.current = null;
          setPreviewingLoopId(null);
        }
      };

      previewSourceRef.current = src;
    } catch {
      setIsLoadingLoopId(null);
      setPreviewingLoopId(null);
    }
  };

  // Add loop directly to project timeline
  const handleAddLoop = async (loop: DawLoopItem) => {
    setIsLoadingLoopId(loop.id);
    try {
      const { buffer, waveform } = await getOrGenerateLoopAudio(loop, audioCtx);
      onAddLoopToTimeline(loop, buffer, waveform);
    } catch (e) {
      console.error('Could not add loop', e);
    } finally {
      setIsLoadingLoopId(null);
    }
  };

  // Handle uploaded audio files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadAudioFile(file);
      e.target.value = '';
    }
  };

  useEffect(() => {
    return () => stopPreview();
  }, []);

  const filteredLoops = DAW_LOOP_CATALOG.filter((item) => {
    const matchGenre = selectedGenre === 'all' || item.genre === selectedGenre;
    const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchSearch =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchGenre && matchCat && matchSearch;
  });

  return (
    <div className="h-72 bg-slate-900 border-t border-slate-800 flex flex-col shadow-2xl select-none z-30">
      {/* Hidden file input for uploading audio */}
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header bar: Title, Search, Upload, Close */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">🔄</span>
          <span className="text-sm font-black text-white font-['Fredoka',sans-serif]">
            Studio Loop &amp; Sample Library
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
            {filteredLoops.length} Loops
          </span>
        </div>

        {/* Search Input */}
        <div className="relative w-48 sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drums, bass, keys..."
            className="w-full pl-8 pr-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Upload Custom Audio File */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
            title="Import any WAV/MP3 loop from your device"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Import Audio File</span>
          </button>

          {/* Close Drawer Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="Close Loop Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs: Genre & Instrument Categories */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between gap-3 overflow-x-auto">
        {/* Genre Pills */}
        <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
          {[
            { id: 'all', label: 'All Genres' },
            { id: 'hiphop', label: '🔥 Hip-Hop' },
            { id: 'pop', label: '🪩 Pop & Dance' },
            { id: 'electronic', label: '⚡ EDM & Electro' },
            { id: 'lofi', label: '☕ Lo-Fi & Chill' },
            { id: 'rock', label: '🎸 Rock & Funk' },
            { id: 'latin_world', label: '🌴 Latin & World' },
            { id: 'cinematic', label: '🎻 Cinematic' },
          ].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGenre(g.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedGenre === g.id
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 flex-nowrap shrink-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'drums', label: '🥁 Drums' },
            { id: 'bass', label: '🎸 Bass' },
            { id: 'chords', label: '🎹 Chords' },
            { id: 'melody', label: '✨ Melody' },
            { id: 'fx', label: '🌧️ FX' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id as any)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-sky-400 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Loop Cards */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {filteredLoops.map((loop) => {
          const isPreviewing = previewingLoopId === loop.id;
          const isLoading = isLoadingLoopId === loop.id;

          return (
            <div
              key={loop.id}
              style={{ borderLeftColor: loop.color }}
              className={`p-2.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:bg-slate-850 flex items-center justify-between gap-2 transition-all border-l-4 ${
                isPreviewing ? 'ring-1 ring-amber-400/80 shadow-md shadow-amber-500/10' : ''
              }`}
            >
              {/* Play preview button */}
              <button
                type="button"
                onClick={() => handleTogglePreview(loop)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 transition-all cursor-pointer ${
                  isPreviewing
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                title={isPreviewing ? 'Stop Preview' : 'Listen to Preview'}
              >
                {isLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                ) : isPreviewing ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>

              {/* Loop Details */}
              <div className="flex-1 min-w-0 pr-1">
                <h5 className="text-xs font-bold text-white truncate font-['Fredoka',sans-serif]">
                  {loop.name}
                </h5>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span className="text-amber-300 font-bold">{loop.bpm} BPM</span>
                  <span>•</span>
                  <span>{loop.key}</span>
                  <span>•</span>
                  <span className="uppercase text-slate-400">{loop.category}</span>
                </div>
              </div>

              {/* Add to Track Action */}
              <button
                type="button"
                onClick={() => handleAddLoop(loop)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1 shrink-0 transition-all cursor-pointer font-['Fredoka',sans-serif] shadow-xs active:scale-95"
                title="Add this loop to your project"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
