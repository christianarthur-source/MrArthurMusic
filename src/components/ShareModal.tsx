import React, { useState } from 'react';
import { X, Copy, Check, Share2, Globe, Loader2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  isLoading?: boolean;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  isLoading = false,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!shareUrl || isLoading) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    } catch {}
    setTimeout(() => setCopied(false), 3000);
  };

  const isShortLink = shareUrl.includes('?s=');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-emerald-400 flex items-center justify-center text-2xl shadow-lg ring-4 ring-sky-500/20">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Share Composition</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  {isShortLink ? 'Short Link' : 'Instant Link'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Anyone can open this link to view and play your exact composition with all settings!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Public Shareable URL (No login required)</span>
              </div>
              {isShortLink && (
                <span className="text-[11px] text-emerald-400 font-semibold">
                  ✨ Compact &amp; Easy to Share
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={isLoading ? 'Generating short link...' : shareUrl}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-mono select-all focus:outline-hidden disabled:opacity-60"
                  disabled={isLoading}
                />
                {isLoading && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={handleCopy}
                disabled={isLoading || !shareUrl}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  copied
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/30'
                    : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20 active:scale-95'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
            💡 <b>Tip:</b> This link packs your complete score, tempo, instruments, difficulty mode, and drum groove so your friends or students can experience your masterpiece instantly!
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
