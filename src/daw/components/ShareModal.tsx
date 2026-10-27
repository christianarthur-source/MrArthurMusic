import React, { useState, useEffect } from 'react';
import { Copy, Check, X, ExternalLink, Share2, Sparkles, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DawProject } from '../types';
import { createShareableDawUrl } from '../utils/projectSharing';
import { createShortLink } from '../../utils/shortLinkService';

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
  const [shareableUrl, setShareableUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    setIsGenerating(true);

    const fallback = createShareableDawUrl(project);
    setShareableUrl('');

    createShortLink('daw', project.title || 'Studio DAW Song', project)
      .then((res) => {
        if (!isCancelled && res?.shortUrl) {
          setShareableUrl(res.shortUrl);
        } else if (!isCancelled && fallback) {
          setShareableUrl(fallback);
        }
      })
      .catch(() => {
        if (!isCancelled && fallback) {
          setShareableUrl(fallback);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsGenerating(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!shareableUrl || isGenerating) return;
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setCopiedLink(true);
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch {}
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleOpenLinkInNewTab = () => {
    if (shareableUrl) {
      window.open(shareableUrl, '_blank');
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = async () => {
    if (canNativeShare && shareableUrl) {
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

  const isShortLink = shareableUrl.includes('?s=');

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
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black font-['Fredoka',sans-serif] bg-gradient-to-r from-amber-300 via-pink-300 to-sky-300 bg-clip-text text-transparent">
                Share Your Studio Song
              </h2>
              {isShortLink && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  Short Link
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
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
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              Direct Shareable URL:
            </label>
            {isShortLink && (
              <span className="text-[11px] text-amber-400 font-bold">✨ Compact &amp; Clean</span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={isGenerating ? 'Generating short link...' : shareableUrl}
                onFocus={(e) => e.target.select()}
                className="w-full rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs text-slate-300 border border-slate-700 font-mono focus:border-amber-400 focus:outline-hidden disabled:opacity-60"
                disabled={isGenerating}
              />
              {isGenerating && (
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                </div>
              )}
            </div>
            <button
              onClick={handleCopyLink}
              disabled={isGenerating || !shareableUrl}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
            disabled={isGenerating || !shareableUrl}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-3 shadow-lg transition-transform active:scale-95 cursor-pointer font-['Fredoka',sans-serif] disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            <span>Copy Link</span>
          </button>

          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              disabled={isGenerating || !shareableUrl}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black text-xs py-3 shadow-lg transition-transform active:scale-95 cursor-pointer font-['Fredoka',sans-serif] disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" />
              <span>Share...</span>
            </button>
          )}

          <button
            onClick={handleOpenLinkInNewTab}
            disabled={isGenerating || !shareableUrl}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-3 transition-colors cursor-pointer disabled:opacity-50"
            title="Open link in new tab"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Open</span>
          </button>
        </div>
      </div>
    </div>
  );
};
