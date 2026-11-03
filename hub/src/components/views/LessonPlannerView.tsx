import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { LessonPlan, GradeLevel, ActivityStep, ClassSection } from '../../types';
import { NYS_MUSIC_STANDARDS } from '../../services/nysStandards';
import {
  generatePedagogicalLesson,
  generateGeminiLesson,
  generateClaudeLesson,
  GeneratedLessonResult
} from '../../services/aiLessonGenerator';
import {
  BookOpen,
  Plus,
  Presentation,
  Copy,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Search,
  Filter,
  Save,
  Wand2,
  History,
  Tag,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Key,
  ExternalLink,
  Check
} from 'lucide-react';

export const LessonPlannerView: React.FC = () => {
  const { preferences, updatePreferences, openTeachMode, showToast } = useApp();

  const [lessons, setLessons] = useState<LessonPlan[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // AI Lesson Assistant State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('Create a 30-minute second-grade lesson on steady beat vs rhythm of the words using rhythm sticks and Kodály Ta & Ti-Ti syllables.');
  const [aiGrade, setAiGrade] = useState<string>('auto');
  const [aiDuration, setAiDuration] = useState<number>(preferences.defaultClassDuration || 35);
  const [aiEngine, setAiEngine] = useState<'builtin' | 'claude' | 'gemini'>(preferences.aiProvider || 'builtin');
  const [claudeKey, setClaudeKey] = useState(preferences.claudeApiKey || '');
  const [geminiKey, setGeminiKey] = useState(preferences.geminiApiKey || preferences.aiApiKey || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');

  const PROMPT_PRESETS = [
    { label: '🧸 K: High/Low Pitch w/ Scarves (25m)', grade: 'K', duration: 25, prompt: 'Create a 25-minute kindergarten lesson on high vs. low pitch contour using movement scarves and Camille Saint-Saëns Carnival of the Animals.' },
    { label: '🥁 1st: Steady Beat vs Rhythm (30m)', grade: '1', duration: 30, prompt: 'Create a 30-minute first-grade lesson distinguishing steady beat from rhythm of the words using rhythm sticks and Kodály Ta and Ti-Ti syllables.' },
    { label: '🎶 2nd: Solfege & Mallets (35m)', grade: '2', duration: 35, prompt: 'Create a 35-minute second-grade lesson on Sol, Mi, and Do using Curwen hand signs and pentatonic Orff xylophones.' },
    { label: '🪈 3rd: Recorder BAG Notes (40m)', grade: '3', duration: 40, prompt: 'Create a 40-minute third-grade lesson introducing soprano recorder with left-hand placement, gentle breath, and notes B, A, and G.' },
    { label: '⚡ 4th: Syncopated Body Percussion (30m)', grade: '4', duration: 30, prompt: 'Create a 30-minute fourth-grade lesson on syncopation and 4-part ostinato grooves using body percussion with zero instrument setup time.' },
    { label: '🌈 5th: Boomwhacker Harmony (35m)', grade: '5', duration: 35, prompt: 'Create a 35-minute fifth-grade lesson utilizing color-coded diatonic Boomwhackers to explore chord progressions and ostinatos.' },
    { label: '🦁 5th: Orchestra Timbre Families (45m)', grade: '5', duration: 45, prompt: 'Create a 45-minute fifth-grade lesson analyzing orchestral instrument families and timbre through Peter and the Wolf.' },
    { label: '🎤 6th / Chorus: 2-Part Harmony (45m)', grade: 'Chorus', duration: 45, prompt: 'Create a 45-minute sixth-grade chorus rehearsal focusing on diaphragmatic breath support, diction, and 2-part harmony independence.' }
  ];

  // Form State for editing
  const [editForm, setEditForm] = useState<Partial<LessonPlan>>({});
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityDuration, setNewActivityDuration] = useState(5);
  const [newActivityDesc, setNewActivityDesc] = useState('');
  const [newActivityConcept, setNewActivityConcept] = useState('Steady Beat');

  const reloadData = () => {
    const allLessons = storage.getLessonPlans();
    setLessons(allLessons);
    setClasses(storage.getClasses());
    if (!activeLessonId && allLessons.length > 0) {
      setActiveLessonId(allLessons[0].id);
    }
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);

    const checkHash = () => {
      if (window.location.hash === '#planner-ai') {
        setIsAiModalOpen(true);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => {
      unsub();
      window.removeEventListener('hashchange', checkHash);
    };
  }, []);

  const activeLesson = lessons.find((l) => l.id === activeLessonId) || lessons[0];

  const filteredLessons = lessons.filter((l) => {
    const matchesGrade = selectedGrade === 'All' || l.grade === selectedGrade;
    const matchesSearch =
      !searchQuery ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.unit.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.musicalConcepts.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesGrade && matchesSearch;
  });

  const startCreateNew = () => {
    const newLesson: Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt'> = {
      title: 'New Elementary Music Lesson',
      grade: selectedGrade === 'All' ? '1' : selectedGrade,
      unit: 'Unit 1: Fundamentals',
      durationMinutes: preferences.defaultClassDuration || 40,
      overview: 'Lesson summary and main student learning experience.',
      objectives: ['Students will perform steady beat and identify pitch movement.'],
      musicalConcepts: ['Steady Beat', 'Singing Voice'],
      standards: ['MU:Pr4.1.K'],
      materialsNeeded: ['Hand drum', 'Rhythm sticks'],
      assessmentStrategy: 'Informal observation and circle participation check.',
      activities: [
        {
          id: 'step-1',
          title: 'Welcome & Vocal Warmup',
          durationMinutes: 5,
          description: 'Siren vocalizations and rote echo song.',
          musicalConcept: 'Singing Voice'
        },
        {
          id: 'step-2',
          title: 'Main Movement or Instrument Activity',
          durationMinutes: 20,
          description: 'Introduce core musical concept with participatory activity.',
          musicalConcept: 'Steady Beat'
        },
        {
          id: 'step-3',
          title: 'Exit Ticket & Cool Down',
          durationMinutes: 5,
          description: 'Individual rhythm clapping check as students line up.',
          musicalConcept: 'Assessment'
        }
      ]
    };
    const created = storage.addLessonPlan(newLesson);
    setActiveLessonId(created.id);
    setEditForm(created);
    setIsEditing(true);
    showToast('New lesson draft created', 'success');
  };

  const startEdit = (lesson: LessonPlan) => {
    setEditForm({ ...lesson });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editForm.id) return;
    storage.updateLessonPlan(editForm.id, editForm);
    setIsEditing(false);
    showToast('Lesson plan saved successfully', 'success');
  };

  const handleDuplicate = (id: string) => {
    const dup = storage.duplicateLessonPlan(id);
    if (dup) {
      setActiveLessonId(dup.id);
      showToast('Lesson duplicated', 'success');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this lesson plan?')) {
      storage.deleteLessonPlan(id);
      const remaining = lessons.filter((l) => l.id !== id);
      if (remaining.length > 0) setActiveLessonId(remaining[0].id);
      setIsEditing(false);
      showToast('Lesson deleted', 'info');
    }
  };

  const handleAddActivity = () => {
    if (!newActivityTitle.trim() || !editForm) return;
    const newStep: ActivityStep = {
      id: 'step-' + Date.now().toString(36),
      title: newActivityTitle.trim(),
      durationMinutes: Number(newActivityDuration) || 5,
      description: newActivityDesc.trim() || 'Activity instructions',
      musicalConcept: newActivityConcept
    };
    const currentActs = editForm.activities || [];
    setEditForm({ ...editForm, activities: [...currentActs, newStep] });
    setNewActivityTitle('');
    setNewActivityDesc('');
  };

  const handleRemoveActivity = (stepId: string) => {
    if (!editForm || !editForm.activities) return;
    setEditForm({
      ...editForm,
      activities: editForm.activities.filter((a) => a.id !== stepId)
    });
  };

  // Duration calculation
  const totalDuration = (isEditing ? editForm.activities : activeLesson?.activities)?.reduce(
    (sum, a) => sum + (Number(a.durationMinutes) || 0),
    0
  ) || 0;

  const plannedClassDuration = (isEditing ? editForm.durationMinutes : activeLesson?.durationMinutes) || 40;
  const isOverDuration = totalDuration > plannedClassDuration;

  // AI Lesson Generator Assistant
  const handleGenerateAiLesson = async () => {
    if (!aiPrompt.trim()) {
      showToast('Please enter an instructional prompt or select an idea preset.', 'error');
      return;
    }

    setIsGenerating(true);
    setAiStatusMessage('Analyzing musical pedagogical goals...');

    try {
      const preferredGrade = aiGrade === 'auto' ? undefined : (aiGrade as GradeLevel);
      const preferredDuration = aiDuration > 0 ? aiDuration : undefined;

      let result: GeneratedLessonResult;

      if (aiEngine === 'claude') {
        if (!claudeKey.trim()) {
          showToast('Please enter an Anthropic Claude API key or switch to Built-in Pedagogical AI.', 'error');
          setIsGenerating(false);
          setAiStatusMessage('');
          return;
        }
        setAiStatusMessage('Connecting to Anthropic Claude AI (Claude Haiku 5.5)...');
        result = await generateClaudeLesson(aiPrompt, claudeKey.trim(), preferredGrade, preferredDuration);
        if (claudeKey.trim() !== preferences.claudeApiKey) {
          updatePreferences({ claudeApiKey: claudeKey.trim(), aiProvider: 'claude' });
        }
      } else if (aiEngine === 'gemini') {
        if (!geminiKey.trim()) {
          showToast('Please enter a Google Gemini API key or switch to Built-in Pedagogical AI.', 'error');
          setIsGenerating(false);
          setAiStatusMessage('');
          return;
        }
        setAiStatusMessage('Connecting to Google Gemini AI...');
        result = await generateGeminiLesson(aiPrompt, geminiKey.trim(), preferredGrade, preferredDuration);
        if (geminiKey.trim() !== preferences.geminiApiKey) {
          updatePreferences({ geminiApiKey: geminiKey.trim(), aiApiKey: geminiKey.trim(), aiProvider: 'gemini' });
        }
      } else {
        // Built-in Pedagogical Engine with brief realistic composing progress
        await new Promise((r) => setTimeout(r, 450));
        setAiStatusMessage('Structuring timed lesson activities...');
        await new Promise((r) => setTimeout(r, 400));
        setAiStatusMessage('Aligning authentic NYS Music Standards...');
        await new Promise((r) => setTimeout(r, 300));
        result = generatePedagogicalLesson(aiPrompt, preferredGrade, preferredDuration);
      }

      // Convert activities to have unique IDs
      const activitiesWithIds: ActivityStep[] = result.activities.map((act, idx) => ({
        ...act,
        id: `act-${Date.now().toString(36)}-${idx + 1}`
      }));

      const created = storage.addLessonPlan({
        title: result.title,
        grade: result.grade,
        unit: result.unit,
        durationMinutes: result.durationMinutes,
        overview: result.overview,
        objectives: result.objectives,
        musicalConcepts: result.musicalConcepts,
        standards: result.standards,
        materialsNeeded: result.materialsNeeded,
        activities: activitiesWithIds,
        assessmentStrategy: result.assessmentStrategy,
        differentiationNotes: result.differentiationNotes
      });

      // Crucial: Clear any search query that might filter out the new lesson
      setSearchQuery('');

      // Crucial: Set selectedGrade to match the new lesson so it is visible in the directory list!
      if (selectedGrade !== 'All' && selectedGrade !== created.grade) {
        setSelectedGrade(created.grade);
      }

      setActiveLessonId(created.id);
      setIsEditing(false);
      setIsAiModalOpen(false);
      showToast(`✨ Generated: "${created.title}" (Grade ${created.grade})`, 'success');
    } catch (err: any) {
      console.error('AI Lesson Generation failed:', err);
      showToast(err?.message || 'Failed to generate lesson plan', 'error');
    } finally {
      setIsGenerating(false);
      setAiStatusMessage('');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Grade Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-brand-600" />
            <span>K–6 Music Lesson Planner & Curriculum</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Standards-aligned general music and chorus plans with duration tracking, activity steps, and Teach Mode.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-subtle"
            title="Generate Lesson via AI Assistant"
          >
            <Wand2 className="w-4 h-4 text-purple-500" />
            <span className="hidden sm:inline">AI Lesson Assistant</span>
          </button>
          <button
            onClick={startCreateNew}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Lesson</span>
          </button>
        </div>
      </div>

      {/* Grade Selector Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {(['All', 'K', '1', '2', '3', '4', '5', '6', 'Chorus'] as GradeLevel[]).map((grade) => (
          <button
            key={grade}
            onClick={() => setSelectedGrade(grade)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedGrade === grade
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            {grade === 'All' ? 'All Grades' : grade === 'Chorus' ? '6th Chorus' : `Grade ${grade}`}
          </button>
        ))}
      </div>

      {/* 2-Column Split: Lesson List on Left, Active Plan on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Lesson Directory */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search units, titles, concepts..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filteredLessons.map((l) => {
              const isSelected = l.id === activeLessonId;
              return (
                <div
                  key={l.id}
                  onClick={() => {
                    setActiveLessonId(l.id);
                    setIsEditing(false);
                  }}
                  className={`p-3.5 rounded-2xl cursor-pointer transition-all border text-left ${
                    isSelected
                      ? 'bg-white dark:bg-stone-800 border-brand-500 dark:border-brand-500 shadow-card'
                      : 'bg-stone-50/70 dark:bg-stone-900/60 border-stone-200/60 dark:border-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                      Grade {l.grade}
                    </span>
                    <span className="text-[11px] text-stone-400 font-mono">
                      {l.durationMinutes} min
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-stone-900 dark:text-white line-clamp-1">
                    {l.title}
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">
                    {l.unit}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {l.musicalConcepts.slice(0, 3).map((c, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-500"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Lesson Plan View & Editor */}
        <div className="lg:col-span-8">
          {activeLesson ? (
            <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200/60 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                    Grade {isEditing ? editForm.grade : activeLesson.grade}
                  </span>
                  <span className="text-xs text-stone-400">•</span>
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    {isEditing ? editForm.unit : activeLesson.unit}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save Changes</span>
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openTeachMode(activeLesson)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Presentation className="w-4 h-4" />
                        <span>Teach This Lesson</span>
                      </button>
                      <button
                        onClick={() => startEdit(activeLesson)}
                        className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(activeLesson.id)}
                        className="p-2 rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                        title="Duplicate Lesson"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(activeLesson.id)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                        title="Delete Lesson"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Title and Duration Tracker */}
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Lesson Title
                    </label>
                    <input
                      type="text"
                      value={editForm.title || ''}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full text-lg font-bold px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-400 block mb-1">
                        Unit Name
                      </label>
                      <input
                        type="text"
                        value={editForm.unit || ''}
                        onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                        className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-400 block mb-1">
                        Target Class Period Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={editForm.durationMinutes || 40}
                        onChange={(e) => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })}
                        className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white">
                    {activeLesson.title}
                  </h2>
                  <p className="text-stone-600 dark:text-stone-300 text-sm mt-1 leading-relaxed">
                    {activeLesson.overview}
                  </p>
                </div>
              )}

              {/* Running Duration Gauge & Overflow Warning */}
              <div
                className={`p-4 rounded-2xl flex items-center justify-between border ${
                  isOverDuration
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isOverDuration ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold">
                      Planned Duration: {totalDuration} min of {plannedClassDuration} min available
                    </h4>
                    {isOverDuration ? (
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">
                        Warning: Activities exceed class time by {totalDuration - plannedClassDuration} minutes! Consider trimming one step.
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Pacing is within class limits ({plannedClassDuration - totalDuration} min buffer).
                      </p>
                    )}
                  </div>
                </div>
                <div className="font-mono font-bold text-lg">
                  {totalDuration}/{plannedClassDuration}m
                </div>
              </div>

              {/* NYS Standards & Objectives */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Learning Objectives
                  </h4>
                  <ul className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                    {(isEditing ? editForm.objectives : activeLesson.objectives)?.map((obj, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-brand-500">•</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-purple-500" />
                    NYS Arts Learning Standards
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(isEditing ? editForm.standards : activeLesson.standards)?.map((code) => {
                      const std = NYS_MUSIC_STANDARDS.find((s) => s.code === code);
                      return (
                        <span
                          key={code}
                          title={std?.description || code}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[11px] font-mono font-semibold text-purple-700 dark:text-purple-300 cursor-help"
                        >
                          {code}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Step-by-Step Activity Sequence */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center justify-between">
                  <span>Step-by-Step Activity Sequence</span>
                  <span className="text-xs font-normal text-stone-400">
                    {(isEditing ? editForm.activities : activeLesson.activities)?.length || 0} activities
                  </span>
                </h3>

                <div className="space-y-2.5">
                  {(isEditing ? editForm.activities : activeLesson.activities)?.map((act, idx) => (
                    <div
                      key={act.id}
                      className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200/60 dark:border-stone-800 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">
                            {act.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                            {act.durationMinutes} min
                          </span>
                          {act.musicalConcept && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              {act.musicalConcept}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-300 pl-8 leading-relaxed">
                          {act.description}
                        </p>
                      </div>

                      {isEditing && (
                        <button
                          onClick={() => handleRemoveActivity(act.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg"
                          title="Remove Activity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Activity Form if editing */}
                {isEditing && (
                  <div className="p-4 rounded-2xl bg-stone-100/60 dark:bg-stone-800/40 border border-dashed border-stone-300 dark:border-stone-700 space-y-3">
                    <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      Add New Activity Step
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={newActivityTitle}
                        onChange={(e) => setNewActivityTitle(e.target.value)}
                        placeholder="Activity Title (e.g. Scarf Movement)"
                        className="sm:col-span-2 text-xs px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                      />
                      <input
                        type="number"
                        value={newActivityDuration}
                        onChange={(e) => setNewActivityDuration(Number(e.target.value))}
                        placeholder="Duration (min)"
                        className="text-xs px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-mono"
                      />
                    </div>
                    <textarea
                      value={newActivityDesc}
                      onChange={(e) => setNewActivityDesc(e.target.value)}
                      placeholder="Step-by-step teaching directions and prompts..."
                      rows={2}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                    />
                    <button
                      onClick={handleAddActivity}
                      disabled={!newActivityTitle.trim()}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Step to Sequence</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Class Section Delivery Log */}
              <div className="pt-4 border-t border-stone-200/60 dark:border-stone-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-brand-500" />
                  Class Sections Delivery History
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {classes
                    .filter((c) => activeLesson.grade === 'All' || c.grade === activeLesson.grade)
                    .map((section) => (
                      <div
                        key={section.id}
                        className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold text-stone-800 dark:text-stone-200">
                          <span>{section.name}</span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {section.studentCount} students
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          Last session: {section.lastDeliveredDate || 'Not started'} • {section.completedActivitiesCount || 0} activities finished
                        </p>
                        {section.notesForNextTime && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                            Next time: {section.notesForNextTime}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-stone-900 rounded-3xl p-12 text-center text-stone-400">
              Select or create a lesson plan to begin.
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200/80 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300">
                  <Wand2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <span>AI Lesson Plan Builder</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      K–6 Music
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Generate authentic, standards-aligned general music and chorus plans tailored to your classroom or cart.
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isGenerating && setIsAiModalOpen(false)}
                disabled={isGenerating}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* AI Engine Switch */}
            <div className="flex flex-col sm:flex-row rounded-xl bg-stone-100 dark:bg-stone-800/80 p-1 text-xs font-semibold gap-1">
              <button
                type="button"
                onClick={() => setAiEngine('builtin')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  aiEngine === 'builtin'
                    ? 'bg-white dark:bg-stone-900 text-purple-700 dark:text-purple-300 shadow-sm font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Built-In AI (Instant & Offline)</span>
              </button>
              <button
                type="button"
                onClick={() => setAiEngine('claude')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  aiEngine === 'claude'
                    ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-300 shadow-sm font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Anthropic Claude (Claude Haiku 5.5)</span>
              </button>
              <button
                type="button"
                onClick={() => setAiEngine('gemini')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  aiEngine === 'gemini'
                    ? 'bg-white dark:bg-stone-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-blue-500" />
                <span>Google Gemini</span>
              </button>
            </div>

            {/* Prompt Preset Idea Chips */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
                Quick Idea Presets (Click to Load)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAiPrompt(preset.prompt);
                      setAiGrade(preset.grade);
                      setAiDuration(preset.duration);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950/60 dark:hover:text-purple-300 border border-stone-200/70 dark:border-stone-700/80 transition-all text-stone-700 dark:text-stone-300 text-left"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Structured Overrides: Grade & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Target Grade Level
                </label>
                <select
                  value={aiGrade}
                  onChange={(e) => setAiGrade(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="auto">Auto-detect from prompt</option>
                  <option value="K">Kindergarten</option>
                  <option value="1">Grade 1</option>
                  <option value="2">Grade 2</option>
                  <option value="3">Grade 3</option>
                  <option value="4">Grade 4</option>
                  <option value="5">Grade 5</option>
                  <option value="6">Grade 6</option>
                  <option value="Chorus">6th Grade Chorus</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Target Duration
                </label>
                <select
                  value={aiDuration}
                  onChange={(e) => setAiDuration(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                >
                  <option value="20">20 minutes (Quick Cart / Station)</option>
                  <option value="25">25 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="35">35 minutes</option>
                  <option value="40">40 minutes (Standard Elementary)</option>
                  <option value="45">45 minutes</option>
                  <option value="50">50 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                Instructional Prompt / Teaching Goals
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. Create a 35-minute second-grade lesson on Sol, Mi, and Do using Curwen hand signs and pentatonic Orff xylophones..."
                className="w-full text-xs sm:text-sm p-3 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
              />
            </div>

            {/* Claude API Key Box (only if Claude mode selected) */}
            {aiEngine === 'claude' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    <span>Anthropic Claude API Key (Claude Haiku 5.5)</span>
                  </div>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-700 dark:text-amber-400 underline hover:text-amber-900 flex items-center gap-1 font-semibold"
                  >
                    <span>Get Claude API key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="w-full text-xs font-mono px-3 py-2 bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-700 rounded-xl text-stone-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-amber-800 dark:text-amber-300">
                  Stored securely only in your browser local storage. Powers Claude Haiku 5.5 with deep Kodály & Orff pedagogical sequencing.
                </p>
              </div>
            )}

            {/* Gemini API Key Box (only if Gemini AI mode selected) */}
            {aiEngine === 'gemini' && (
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                    <Key className="w-3.5 h-3.5 text-blue-600" />
                    <span>Google Gemini API Key</span>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 dark:text-blue-400 underline hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>Get free key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full text-xs font-mono px-3 py-2 bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-700 rounded-xl text-stone-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-blue-700 dark:text-blue-300">
                  Stored securely only in your browser local storage. Never sent to any third party.
                </p>
              </div>
            )}

            {/* Loading / Progress State */}
            {isGenerating && (
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center gap-3 animate-pulse">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-purple-900 dark:text-purple-200">
                    Building Lesson Framework...
                  </div>
                  <div className="text-purple-700 dark:text-purple-300 text-[11px]">
                    {aiStatusMessage || 'Composing activities and aligning NYS standards...'}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-stone-200/80 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateAiLesson}
                disabled={isGenerating || !aiPrompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-purple-900 text-white text-xs font-bold flex items-center gap-2 shadow transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Lesson Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
