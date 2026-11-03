# 🎵 Music Teacher Hub

**Elementary General Music & Choral Command Center**  
*Designed for Elementary Music Educator & Choral Director Christian Arthur*

A modern, responsive Progressive Web Application designed for the daily realities of elementary music education (K–6) and sixth-grade chorus. Built for teachers working across classrooms, laptops, Chromebooks, iPads, and mobile carts.

---

## ✨ Features

### 📚 Curriculum & Lesson Planner
- **K–6 Standards-Aligned Units**: Pre-loaded with Kodály and Orff Schulwerk units aligned with National Core Arts & NYS Music Standards.
- **Dual-Engine AI Lesson Plan Builder**:
  - *Built-In Pedagogical Engine*: Instant, zero-config, offline lesson generation with balanced 5-step timing, NYS standards tagging, materials lists, and rubrics.
  - *Google Gemini Live AI*: Connect a Google AI Studio API key for direct Gemini 2.0 Flash lesson generation.
  - *8 One-Click Presets*: Scarf movement (K), steady beat vs. rhythm (1st), Curwen solfege (2nd), recorder BAG (3rd), syncopation (4th), Boomwhackers (5th), orchestra families (5th), and 2-part chorus harmony (6th).
- **Teach Mode**: Full-screen, distraction-free presenter view for classroom smartboards with large controls, timers, and step progression.

### 📝 Task Manager (Inspired by Things)
- **Active Projects & Areas of Responsibility**: Full creation, editing, color-swatch tagging, deadline scheduling, and safe cascading deletion.
- **Focus Lists**: Today, Upcoming, Anytime, Someday, and Logbook.
- **Subtasks & Tagging**: Quick checkboxes, priority markers, and area organization.

### 📅 Unified Music Calendar
- **Month, Week, Day & Agenda Views**: Event scheduling with color-coding.
- **Calendar Sync**: Google Calendar and Apple Calendar (`.ics` / `webcal://`) subscription support.

### 🎹 Classroom & Music Tools
- **Song Maker Sequencer**: Google Song Maker-style grid with acoustic percussion and xylophone melody channels.
- **Audio Practice Lab**: Pitch-shifting (granular Web Audio processor) and variable speed playback for uploaded audio and local files, with playlist queuing.
- **Chromatic Tuner & Metronome**: High-precision microphone pitch detection and multi-meter visual metronome.
- **Classroom Timer**: Preset countdowns, chime alerts, and projector mode.

### 🖼️ Oversized Music Literacy Visuals
- **Interactive Music Staff**: Labeled Treble & Bass Clefs with Middle C ledger, Boomwhacker color-coded notes, solfege syllables, and mnemonics (*Every Good Boy Does Fine*, *FACE*, etc.).
- **2-Octave Piano Keyboard (C4–C6)**: Note letter labels on all white and black keys.
- **Curwen Solfege Tone Ladder**: High-contrast posture guides and pitch playback.
- **Kodály Rhythm Flashcards**: Scalable vector notation (Ta, Ti-Ti, Tikka-Tikka, Ta-a, Whole, Rest, Syncopa) with woodblock clap audio.

### 🎬 Classroom YouTube Hub
- **Distraction-Free Classroom Embeds**: Powered by `youtube-nocookie.com` to eliminate advertising tracking cookies, recommended clickbait, and intrusive popups.
- **Live YouTube Search**: Search directly inside the app with elementary music suggestion chips.
- **Theater Mode & Warmup Looping**: Maximizes videos for smartboard projection and enables continuous loop practice.

### 🗂️ Teaching Resource Library
- **Automatic 16:9 Thumbnail Previews**: High-resolution YouTube covers, Google Drive / Docs / Sheets / Slides badges, and live webpage preview snapshots.
- **Grid / Table List View**: Star/favorite resources, categorize by grade, and launch with one click.

### 📖 Daily Teaching Journal (Day One Style)
- **Classroom Reflection Tracking**: Calendar heatmaps, "On This Day" flashbacks, weather/location badges, mood and energy trackers, photo attachments, and full-text search.

---

## 🚀 Getting Started

### Local Development

```bash
# Clone the repository
git clone https://github.com/christianarthur-source/Music-Teacher-Hub.git
cd Music-Teacher-Hub

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Production Build

```bash
npm run build
```

The output files are generated in `./dist`.

---

## 🛠️ Technology Stack

- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Audio Engine**: Web Audio API (real-time granular pitch shifter, synthetic oscillator instruments, mic pitch detection)
- **Hosting & CI/CD**: GitHub Pages & GitHub Actions

---

## 📄 License

MIT License. Designed with care for music educators.
