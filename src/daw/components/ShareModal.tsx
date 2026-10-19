import React, { useState } from 'react';
import { Copy, Check, X, ExternalLink, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DawProject } from '../types';
import { createShareableDawUrl } from '../utils/projectSharing';

interface DawShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DawProject;
}

export const DawShareModal: React.FC<DawShareModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const shareableUrl = createShareableDawUrl(project);

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
          title: project.title || 'Studio DAW Song',
          text: `Check out this music project I arranged in Mr. Arthur's Studio DAW: "${project.title}"!`,
          url: shareableUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl border-4 border-amber-400 bg-slate-900 p-6 text-white shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-600 text-3xl shadow-lg">
            🎛️
          </div>
          <div>
            <h2 className="text-2xl font-black font-['Fredoka',sans-serif] bg-gradient-to-r from-amber-300 via-pink-300 to-sky-300 bg-clip-text text-transparent">
              Share Your Studio Song
            </h2>
            <p className="text-xs text-slate-400">
              Anyone with this link will open straight into the Studio DAW with your project ready to play!
            </p>
          </div>
        </div>

        {/* Project Preview Badge */}
        <div className="mt-5 rounded-2xl bg-slate-950/70 border border-slate-800 p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
              Project Title
            </div>
            <div className="text-base font-bold text-white mt-0.5">
              {project.title || 'Untitled Studio Song'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {project.tracks.length} tracks • {project.bpm} BPM
            </div>
          </div>
          <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Direct Tool Link
          </span>
        </div>

        {/* Direct Link Input Box */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-bold text-slate-300">
            Direct Shareable URL:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareableUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs text-slate-300 border border-slate-700 font-mono focus:border-amber-400 focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-bold text-xs transition-all shadow-md cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
              }`}
            >
              {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            onClick={handleCopyLink}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-3 shadow-lg transition-transform active:scale-95 cursor-pointer font-['Fredoka',sans-serif]"
          >
            <Copy className="h-4 w-4" />
            <span>Copy Link</span>
          </button>

          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black text-xs py-3 shadow-lg transition-transform active:scale-95 cursor-pointer font-['Fredoka',sans-serif]"
            >
              <Share2 className="h-4 w-4" />
              <span>Share...</span>
            </button>
          )}

          <button
            onClick={handleOpenLinkInNewTab}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-3 border border-slate-700 cursor-pointer"
            title="Open in new tab to test"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Test Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};
