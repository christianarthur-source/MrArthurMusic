import React, { useState } from 'react';
import {
  Copy,
  Check,
  X,
  ExternalLink,
  Share2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SharedSongData } from '../types';
import { createShareableSongUrl } from '../utils/songSharing';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  songData: SharedSongData;
  onImportSong?: (data: SharedSongData) => void;
  onExportAudioWav?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  songData,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  // Generate public shareable URL
  const shareableUrl = createShareableSongUrl(songData);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setCopiedLink(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleOpenLinkInNewTab = () => {
    window.open(shareableUrl, '_blank');
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: songData.title || "Mr. Arthur's Beat",
          text: `Check out this beat I made on BeatBlast Junior: "${songData.title}"!`,
          url: shareableUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border-4 border-amber-400 bg-slate-900 p-6 text-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-600 text-3xl shadow-lg animate-bounce-sm">
            🔗
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-amber-300">Share Your Beat</h2>
              <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-black text-amber-300 border border-amber-400/30">
                {songData.measures} {songData.measures === 1 ? 'Measure' : 'Measures'}
              </span>
            </div>
          </div>
        </div>

        {/* Share Link Only */}
        <div className="my-6">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareableUrl}
                className="flex-1 truncate rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-slate-200 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black transition-all active:scale-95 ${
                  copiedLink
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md font-black'
                }`}
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-800 px-5 py-2.5 text-xs font-black text-slate-300 hover:bg-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
