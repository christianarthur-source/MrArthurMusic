import React, { useEffect, useState } from 'react';
import { Download, Play, Pause, Sparkles, X, Music, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBlob: Blob | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, audioBlob }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen && audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      setAudioElement(audio);

      // Launch joyful confetti burst!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
      });

      return () => {
        audio.pause();
        URL.revokeObjectURL(url);
      };
    }
  }, [isOpen, audioBlob]);

  if (!isOpen || !audioBlob) return null;

  const togglePlay = () => {
    if (!audioElement) return;
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.currentTime = 0;
      audioElement.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `my-awesome-beat-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.7 },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border-4 border-amber-400 bg-slate-900 p-6 text-center text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-400 to-orange-500 text-4xl shadow-lg">
          🎉
        </div>

        <h2 className="mt-4 text-2xl font-black text-amber-400">Song Recorded!</h2>
        <p className="mt-1 text-sm font-semibold text-slate-300">
          You made an awesome beat! Listen back or download it to play for your family & friends!
        </p>

        {/* Playback Box */}
        <div className="my-6 rounded-2xl border border-slate-700 bg-slate-800/80 p-5">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={togglePlay}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              {isPlaying ? (
                <Pause className="h-8 w-8 fill-slate-950" />
              ) : (
                <Play className="h-8 w-8 fill-slate-950 ml-1" />
              )}
            </button>
            <div className="text-left">
              <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                <Music className="h-4 w-4" />
                {isPlaying ? 'Playing Jam...' : 'Ready to listen'}
              </span>
              <span className="text-xs text-slate-400">Recorded Live Track</span>
            </div>
          </div>
        </div>

        {/* Download Action */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 px-6 text-lg font-black text-slate-950 shadow-lg hover:from-amber-300 hover:to-orange-400 active:scale-95 transition-all"
          >
            <Download className="h-6 w-6" />
            Download My Song File!
          </button>

          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-800 py-3 font-bold text-slate-300 hover:bg-slate-700"
          >
            Keep Making Music
          </button>
        </div>
      </div>
    </div>
  );
};
