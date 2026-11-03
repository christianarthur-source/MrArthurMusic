import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { ResourceLink, GradeLevel } from '../../types';
import {
  FolderSync,
  Plus,
  ExternalLink,
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Star,
  Search,
  Tag,
  Trash2,
  CheckCircle2,
  LayoutGrid,
  List,
  Sparkles,
  Image as ImageIcon,
  Copy,
  Globe,
  Share2
} from 'lucide-react';

export const ResourceLibraryView: React.FC = () => {
  const { showToast } = useApp();

  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ResourceLink['category']>('drive');
  const [grade, setGrade] = useState<GradeLevel>('All');
  const [tagsStr, setTagsStr] = useState('curriculum, scores');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  const reloadData = () => {
    setResources(storage.getResources());
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, []);

  // Auto-detect Google Drive file types from URL
  const detectDriveType = (inputUrl: string): { isDrive: boolean; driveType?: ResourceLink['driveType']; fileId?: string } => {
    if (inputUrl.includes('drive.google.com') || inputUrl.includes('docs.google.com')) {
      const idMatch = inputUrl.match(/[-\w]{25,}/);
      const fileId = idMatch ? idMatch[0] : undefined;

      if (inputUrl.includes('/folders/')) return { isDrive: true, driveType: 'folder', fileId };
      if (inputUrl.includes('/document/')) return { isDrive: true, driveType: 'doc', fileId };
      if (inputUrl.includes('/spreadsheets/')) return { isDrive: true, driveType: 'sheet', fileId };
      if (inputUrl.includes('/presentation/')) return { isDrive: true, driveType: 'slide', fileId };
      return { isDrive: true, driveType: 'pdf', fileId };
    }
    return { isDrive: false };
  };

  // Helper to extract YouTube video ID
  const extractYouTubeId = (inputUrl: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = inputUrl.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Extract domain name
  const extractDomain = (inputUrl: string): string => {
    try {
      return new URL(inputUrl).hostname.replace('www.', '');
    } catch {
      return 'web resource';
    }
  };

  // Determine Thumbnail Source
  const getResourceThumbnail = (res: ResourceLink): {
    kind: 'image' | 'drive' | 'youtube' | 'web';
    src?: string;
    fallbackFavicon?: string;
    domain: string;
    driveType?: ResourceLink['driveType'];
  } => {
    const domain = extractDomain(res.url);
    const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    // 1. Explicit user provided thumbnail
    if (res.thumbnailUrl && res.thumbnailUrl.trim()) {
      return { kind: 'image', src: res.thumbnailUrl, fallbackFavicon, domain };
    }

    // 2. YouTube link
    const ytId = extractYouTubeId(res.url);
    if (ytId) {
      return {
        kind: 'youtube',
        src: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        fallbackFavicon,
        domain
      };
    }

    // 3. Google Drive / Docs / Sheets / Slides
    const driveInfo = detectDriveType(res.url);
    if (driveInfo.isDrive) {
      const driveSrc = driveInfo.fileId
        ? `https://drive.google.com/thumbnail?id=${driveInfo.fileId}&sz=w600`
        : undefined;
      return {
        kind: 'drive',
        src: driveSrc,
        fallbackFavicon,
        domain,
        driveType: driveInfo.driveType || res.driveType || 'doc'
      };
    }

    // 4. Chrome Music Lab
    if (res.url.includes('musiclab.chromeexperiments.com')) {
      return {
        kind: 'image',
        src: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
        fallbackFavicon,
        domain
      };
    }

    // 5. General Web Screenshot API via Thum.io with Google Favicon backup
    return {
      kind: 'web',
      src: `https://image.thum.io/get/width/500/crop/600/noanimate/${encodeURIComponent(res.url)}`,
      fallbackFavicon,
      domain
    };
  };

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim()) return;

    const { isDrive, driveType } = detectDriveType(url);

    // Auto calculate thumbnail if YouTube
    let finalThumb = thumbnailUrl.trim();
    if (!finalThumb) {
      const ytId = extractYouTubeId(url);
      if (ytId) {
        finalThumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }
    }

    const created = storage.addResource({
      title: title.trim(),
      url: url.trim(),
      description: description.trim(),
      category: isDrive ? 'drive' : category,
      grade,
      tags: tagsStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      isGoogleDrive: isDrive,
      driveType,
      isFavorite: false,
      lastUsed: new Date().toISOString().split('T')[0],
      thumbnailUrl: finalThumb || undefined
    });

    setIsAddOpen(false);
    setUrl('');
    setTitle('');
    setDescription('');
    setThumbnailUrl('');
    showToast(`Added ${created.title}`, 'success');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    storage.deleteResource(id);
    showToast('Resource removed', 'info');
  };

  const toggleFavorite = (id: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    storage.updateResource(id, { isFavorite: !current });
  };

  const copyResourceUrl = (resUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(resUrl);
    showToast('Resource link copied to clipboard', 'info');
  };

  const filtered = resources.filter((r) => {
    const matchesCat = selectedCategory === 'all' || r.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.tags.some((t) => t.includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const getDriveBadge = (type?: ResourceLink['driveType']) => {
    switch (type) {
      case 'folder':
        return { label: 'Drive Folder', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', icon: Folder };
      case 'doc':
        return { label: 'Google Doc', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', icon: FileText };
      case 'sheet':
        return { label: 'Google Sheet', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: FileSpreadsheet };
      case 'slide':
        return { label: 'Google Slides', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300', icon: Presentation };
      default:
        return { label: 'PDF Document', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', icon: File };
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md">
              <FolderSync className="w-5 h-5" />
            </span>
            <span>Google Drive & Teaching Resource Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Visual resource cards with automatic thumbnail previews for curriculum drives, sheet music, interactive tools, and lesson links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-stone-900 text-brand-600 shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
              title="Visual Thumbnail Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-stone-900 text-brand-600 shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
              title="Compact List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Resource</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Resources' },
            { id: 'drive', label: 'Google Drive' },
            { id: 'game', label: 'Interactive Games' },
            { id: 'sheet_music', label: 'Sheet Music' },
            { id: 'listening', label: 'Listening' }
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === c.id
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources, tags, grade..."
            className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Visual Thumbnail Cards Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((res) => {
            const thumb = getResourceThumbnail(res);
            const driveBadge = res.isGoogleDrive ? getDriveBadge(res.driveType) : null;
            const DriveIcon = driveBadge?.icon;

            return (
              <div
                key={res.id}
                className="group rounded-3xl overflow-hidden bg-white dark:bg-stone-900 shadow-card border border-stone-200/80 dark:border-stone-800 hover:border-brand-500 dark:hover:border-brand-500 transition-all duration-200 flex flex-col justify-between"
              >
                {/* 16:9 Thumbnail Banner Preview */}
                <div className="relative aspect-video bg-stone-100 dark:bg-stone-800 overflow-hidden border-b border-stone-100 dark:border-stone-800">
                  {/* Visual Drive Archetype Card fallback */}
                  {res.isGoogleDrive ? (
                    <div className="w-full h-full p-5 flex flex-col justify-between bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-800 dark:to-stone-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-xl shadow-xs ${driveBadge?.color || 'bg-blue-100 text-blue-800'}`}>
                            {DriveIcon && <DriveIcon className="w-5 h-5" />}
                          </div>
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                            {driveBadge?.label}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-stone-200/70 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                          {res.grade}
                        </span>
                      </div>

                      {/* Lined preview paper motif */}
                      <div className="space-y-2 p-3 bg-white dark:bg-stone-800/80 rounded-2xl border border-stone-200/60 dark:border-stone-700 shadow-xs">
                        <div className="h-2 bg-stone-200 dark:bg-stone-700 rounded w-5/6" />
                        <div className="h-2 bg-stone-200 dark:bg-stone-700 rounded w-3/4" />
                        <div className="h-2 bg-stone-200 dark:bg-stone-700 rounded w-1/2" />
                      </div>

                      <div className="text-[10px] text-stone-400 font-mono truncate">
                        drive.google.com • {res.driveType || 'file'}
                      </div>
                    </div>
                  ) : (
                    /* Web / YouTube / Image Preview */
                    <div className="w-full h-full relative group/img">
                      <img
                        src={thumb.src}
                        alt={res.title}
                        onError={(e) => {
                          // Fallback to Google Favicon high-res badge if screenshot fails
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallbackEl = target.parentElement?.querySelector('.fallback-preview') as HTMLElement;
                          if (fallbackEl) fallbackEl.style.display = 'flex';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />

                      {/* Fallback container if screenshot loading is blocked or delayed */}
                      <div className="fallback-preview hidden absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-amber-900/10 to-rose-900/10 dark:from-stone-800 dark:to-stone-900 p-5 flex flex-col justify-between items-center text-center">
                        <img
                          src={thumb.fallbackFavicon}
                          alt="favicon"
                          className="w-12 h-12 rounded-2xl p-2 bg-white dark:bg-stone-800 shadow-md border border-stone-200 dark:border-stone-700 mt-2"
                        />
                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300 font-mono">
                          {thumb.domain}
                        </span>
                      </div>

                      {/* Domain badge overlay */}
                      <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 shadow-xs">
                        <img
                          src={thumb.fallbackFavicon}
                          alt=""
                          className="w-3.5 h-3.5 rounded-sm"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <span className="truncate max-w-[150px]">{thumb.domain}</span>
                      </div>

                      {/* Category Pill */}
                      <div className="absolute top-2 left-2 bg-brand-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase shadow-sm">
                        {res.category.replace('_', ' ')}
                      </div>
                    </div>
                  )}

                  {/* Favorite & Quick Actions in Top Right */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                    <button
                      onClick={(e) => toggleFavorite(res.id, res.isFavorite, e)}
                      className="p-1.5 rounded-xl bg-black/60 backdrop-blur-md text-stone-300 hover:text-amber-400 transition-colors shadow-sm"
                      title={res.isFavorite ? 'Starred' : 'Star this resource'}
                    >
                      <Star className={`w-3.5 h-3.5 ${res.isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => copyResourceUrl(res.url, e)}
                      className="p-1.5 rounded-xl bg-black/60 backdrop-blur-md text-stone-300 hover:text-white transition-colors shadow-sm"
                      title="Copy URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(res.id, e)}
                      className="p-1.5 rounded-xl bg-black/60 backdrop-blur-md text-stone-300 hover:text-rose-400 transition-colors shadow-sm"
                      title="Remove resource"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white line-clamp-2 leading-snug group-hover:text-brand-600 transition-colors">
                      {res.title}
                    </h3>

                    {res.description && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                        {res.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-stone-100 dark:border-stone-800">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {res.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-500"
                        >
                          #{t}
                        </span>
                      ))}
                      {res.tags.length > 3 && (
                        <span className="text-[10px] text-stone-400 self-center">
                          +{res.tags.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Launch Button */}
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-3 rounded-2xl bg-stone-100 hover:bg-brand-600 hover:text-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-subtle group-hover:shadow-md"
                    >
                      <span>Open {res.isGoogleDrive ? 'in Google Drive' : 'Resource'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table View */
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 overflow-hidden shadow-xs divide-y divide-stone-100 dark:divide-stone-800">
          {filtered.map((res) => {
            const thumb = getResourceThumbnail(res);
            return (
              <div
                key={res.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200 dark:border-stone-700">
                    <img
                      src={thumb.src}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = thumb.fallbackFavicon || '';
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate">
                        {res.title}
                      </h4>
                      {res.isFavorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-stone-400 truncate">
                      {res.grade} • {thumb.domain} • {res.tags.join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 hover:bg-brand-600 hover:text-white transition-colors"
                  >
                    <span>Launch</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={(e) => handleDelete(res.id, e)}
                    className="p-2 text-stone-400 hover:text-rose-500"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Resource Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddResource}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <FolderSync className="w-5 h-5 text-brand-600" />
                <span>Add Teaching Resource or Drive Link</span>
              </h3>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Resource URL (Drive, YouTube, or Website)
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/... or https://..."
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Resource Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 5th Grade Chorus Repertoire Folder"
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                >
                  <option value="drive">Google Drive</option>
                  <option value="sheet_music">Sheet Music / Scores</option>
                  <option value="game">Interactive Game / App</option>
                  <option value="listening">Listening Excerpt</option>
                  <option value="theory">Music Literacy</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Grade Level</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                >
                  <option value="All">All Grades (K–6)</option>
                  <option value="K">Kindergarten</option>
                  <option value="1">1st Grade</option>
                  <option value="2">2nd Grade</option>
                  <option value="3">3rd Grade</option>
                  <option value="4">4th Grade</option>
                  <option value="5">5th Grade</option>
                  <option value="6">6th Grade</option>
                  <option value="Chorus">Chorus</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Custom Thumbnail Image URL (Optional)
              </label>
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="Auto-detected from YouTube or website screenshot if left blank"
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Lesson context, rehearsal track notes, or seating layout..."
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="curriculum, concert, recorder"
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs"
              >
                Save Resource
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
