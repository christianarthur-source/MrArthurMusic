import React, { useState } from 'react';
import { ImagePlus, Loader2, Search, Sparkles, Upload, X } from 'lucide-react';
import { compressImage } from '../../services/plannerContent';
import { generateImage, PhotoResult, photoToImage, PickedImage, searchPhotos } from '../../services/imageTools';

interface Props {
  title?: string;
  /** Starting description for the AI picture and the photo search. */
  initialPrompt?: string;
  /** 16:9 pictures for slides; square for display images. */
  wide?: boolean;
  onPick: (image: PickedImage) => void;
  onClose: () => void;
}

type Tab = 'ai' | 'photos' | 'upload';

/** Choose a picture: draw one with AI, pick an openly licensed photo, or upload your own. */
export const ImagePickerModal: React.FC<Props> = ({ title = 'Choose a picture', initialPrompt = '', wide = true, onPick, onClose }) => {
  const [tab, setTab] = useState<Tab>('ai');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [query, setQuery] = useState(initialPrompt.split(/[,.]/)[0].slice(0, 60));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PickedImage | null>(null);
  const [photos, setPhotos] = useState<PhotoResult[] | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'ai', label: 'AI picture', icon: Sparkles },
    { id: 'photos', label: 'Photo library', icon: Search },
    { id: 'upload', label: 'Upload', icon: Upload }
  ];
  const field =
    'w-full text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-stone-900 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <ImagePlus className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-bold text-stone-900 dark:text-white mr-auto">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex rounded-xl bg-stone-100 dark:bg-stone-800 p-1 text-xs font-semibold w-fit" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => { setTab(id); setError(''); }}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${tab === id ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'ai' && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(async () => setPreview(await generateImage(prompt, wide))); }}>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Describe the picture, e.g. children playing colorful boomwhackers in a circle" className={field} aria-label="Picture description" />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={busy || !prompt.trim()} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {preview ? 'Try another' : 'Draw it'}
              </button>
              <span className="text-xs text-stone-500">Free AI on your Cloudflare account. Takes a few seconds.</span>
            </div>
          </form>
        )}

        {tab === 'photos' && (
          <div className="space-y-3">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => setPhotos(await searchPhotos(query))); }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search free photos, e.g. xylophone" className={field} aria-label="Photo search" />
              <button type="submit" disabled={busy || !query.trim()} className="px-4 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </form>
            {photos && photos.length === 0 && <p className="text-sm text-stone-500">No photos found. Try simpler words.</p>}
            {photos && photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((p) => (
                  <button key={p.url} type="button" onClick={() => setPreview(photoToImage(p))} title={`${p.title} — ${p.creator}, ${p.license}`} className={`aspect-video rounded-lg overflow-hidden border-2 ${preview?.src === p.url ? 'border-brand-500' : 'border-transparent'} hover:border-brand-300`}>
                    <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-stone-400">Openly licensed images from Openverse. The creator and license are saved with the picture and shown as a credit.</p>
          </div>
        )}

        {tab === 'upload' && (
          <label className="block p-8 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 text-center cursor-pointer hover:border-brand-400">
            <Upload className="w-6 h-6 mx-auto text-stone-400" />
            <span className="block mt-2 text-sm text-stone-600 dark:text-stone-300">Choose an image from this device</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) run(async () => setPreview({ src: await compressImage(file, 1280), alt: file.name.replace(/\.[^.]+$/, '') }));
              }}
            />
          </label>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {preview && (
          <div className="space-y-3">
            <div className={`${wide ? 'aspect-video' : 'aspect-square max-w-sm'} rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800`}>
              <img src={preview.src} alt={preview.alt || ''} className="w-full h-full object-cover" />
            </div>
            {preview.credit && <p className="text-xs text-stone-500">{preview.credit}</p>}
            <button type="button" onClick={() => onPick(preview)} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold">
              Use this picture
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
