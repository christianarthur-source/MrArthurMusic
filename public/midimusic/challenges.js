// Challenges: short, scored tasks played on any keyboard. Every note counts in any octave, so a
// 25-key keyboard always works. Stars: 3 for few mistakes, 2 for some, 1 for finishing.
// A teacher can send students straight to one with a link: /midimusic/?challenge=<id>
//
// Types
//   name    — the app names a note, the student finds it.            pool: note names, rounds
//   seq     — play notes in order (scales).                           notes: like songs.js, glow: show the next key
//   chord   — build chords (any order, any octave).                   chords: in order, or pool + rounds for random
//   echo    — listen to a short tune, play it back.                   pool: notes, lengths: notes per round
//   improv  — make it up over a beat, using only some keys.           allowed: note names, seconds, groove
//   partner — duet: one player plays a pattern, the other copies it.  rounds
//   ostinato— duet: one player learns a repeating riff (shown), then keeps it going while the other solos;
//             then they switch.                                      riff, allowed (solo notes), seconds, learnTimes
//   parts   — duet: each player has their own line, step by step (melody + harmony, or question + answer).
//             a / b: like songs.js, with '-' where that player rests. names: what to call the two parts.
//             swap: play it again with the parts switched.
// Options: hideNames (note names on the keys are hidden), groove + bpm (a beat plays during the challenge),
//          stars: [most mistakes for 3 stars, most mistakes for 2 stars]

export const PATHS = [
  { id: 'basics', name: 'Keyboard Basics', em: '🎹', c: '#5cd6ff' },
  { id: 'scales', name: 'Scales', em: '🪜', c: '#39e36b' },
  { id: 'ear', name: 'Ear Training', em: '👂', c: '#c58bff' },
  { id: 'chords', name: 'Chords', em: '🎶', c: '#ffb020' },
  { id: 'hits', name: 'Chords Behind the Hits', em: '🔥', c: '#ff5d8f' },
  { id: 'create', name: 'Make It Up', em: '🎨', c: '#ff7a59' },
  { id: 'duet', name: 'Partners', em: '👥', c: '#4da3ff' },
];

export const CHALLENGES = [
  // ------------------------------------------------------------------ keyboard basics
  { id: 'find-cde', path: 'basics', em: '🔍', title: 'Find C, D and E', how: 'Find the note on the keyboard. Look for the groups of 2 black keys!', type: 'name', pool: ['C', 'D', 'E'], rounds: 8 },
  { id: 'find-white', path: 'basics', em: '🔍', title: 'All the White Keys', how: 'Find each note. C is just left of the 2 black keys.', type: 'name', pool: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], rounds: 12 },
  { id: 'find-nolabels', path: 'basics', em: '🙈', title: 'No Labels!', how: 'The note names are hidden. Can you still find them?', type: 'name', pool: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], rounds: 12, hideNames: true },
  { id: 'find-all', path: 'basics', em: '🌈', title: 'All 12 Notes', how: 'White keys AND black keys. Find every one!', type: 'name', pool: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], rounds: 12 },
  { id: 'find-black', path: 'basics', em: '🖤', title: 'Sharps & Flats', how: 'Sharps (♯) are the black key just above. Flats (♭) are just below.', type: 'name', pool: ['C♯', 'E♭', 'F♯', 'A♭', 'B♭'], rounds: 10 },

  // ------------------------------------------------------------------ scales
  { id: 'scale-c', path: 'scales', em: '🪜', title: 'C Major Scale', how: 'Follow the glowing keys up, then back down.', type: 'seq', glow: true, notes: 'C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4' },
  { id: 'scale-c-solo', path: 'scales', em: '🦸', title: 'C Major — No Help', how: 'Same scale, but no glowing keys and no labels!', type: 'seq', hideNames: true, notes: 'C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4' },
  { id: 'scale-g', path: 'scales', em: '🪜', title: 'G Major Scale', how: 'G major has one black key: F♯.', type: 'seq', glow: true, notes: 'G3 A3 B3 C4 D4 E4 F#4 G4 F#4 E4 D4 C4 B3 A3 G3' },
  { id: 'scale-f', path: 'scales', em: '🪜', title: 'F Major Scale', how: 'F major has one black key: B♭.', type: 'seq', glow: true, notes: 'F4 G4 A4 Bb4 C5 D5 E5 F5 E5 D5 C5 Bb4 A4 G4 F4' },
  { id: 'scale-am', path: 'scales', em: '🌙', title: 'A Minor Scale', how: 'The same white keys as C major, but starting on A. Hear how it sounds sadder?', type: 'seq', glow: true, notes: 'A3 B3 C4 D4 E4 F4 G4 A4 G4 F4 E4 D4 C4 B3 A3' },
  { id: 'scale-black', path: 'scales', em: '🖤', title: 'Black-Key Scale', how: 'All 5 black keys in a row: the pentatonic scale.', type: 'seq', glow: true, notes: 'F#4 G#4 A#4 C#5 D#5 F#5 D#5 C#5 A#4 G#4 F#4' },

  // ------------------------------------------------------------------ ear training
  { id: 'echo-3', path: 'ear', em: '👂', title: 'Echo Me: 3 Notes', how: 'Listen, then play it back. Only C, D and E!', type: 'echo', pool: 'C4 D4 E4', lengths: [2, 3, 3, 3, 4, 4] },
  { id: 'echo-5', path: 'ear', em: '👂', title: 'Echo Me: 5 Notes', how: 'Listen, then play it back. C, D, E, F and G.', type: 'echo', pool: 'C4 D4 E4 F4 G4', lengths: [3, 3, 4, 4, 5, 5] },
  { id: 'echo-black', path: 'ear', em: '🖤', title: 'Echo Me: Black Keys', how: 'Listen, then play it back — only black keys this time.', type: 'echo', pool: 'F#4 G#4 A#4 C#5 D#5', lengths: [3, 3, 4, 4, 5, 5] },
  { id: 'echo-penta', path: 'ear', em: '🎧', title: 'Echo Me: Pentatonic', how: 'C, D, E, G and A — the notes of many folk songs.', type: 'echo', pool: 'C4 D4 E4 G4 A4', lengths: [3, 4, 4, 5, 5, 6] },

  // ------------------------------------------------------------------ chords
  { id: 'chord-cfg', path: 'chords', em: '🎶', title: 'Build C, F and G', how: 'Hold all 3 glowing keys at the same time.', type: 'chord', pool: ['C', 'F', 'G'], rounds: 6, glow: true },
  { id: 'chord-major', path: 'chords', em: '😀', title: 'Major Chords', how: 'Skip a key, play a key: root, 3rd, 5th. No glow this time!', type: 'chord', pool: ['C', 'D', 'E', 'F', 'G', 'A'], rounds: 8 },
  { id: 'chord-mix', path: 'chords', em: '🎨', title: 'Major + Minor Mix', how: 'The 6 main chords of C major. No glow — you’ve got this!', type: 'chord', pool: ['C', 'Dm', 'Em', 'F', 'G', 'Am'], rounds: 8 },
  { id: 'chord-minor', path: 'chords', em: '😢', title: 'Minor Chords', how: 'Minor chords sound sad. Hold all 3 glowing keys.', type: 'chord', pool: ['Am', 'Dm', 'Em'], rounds: 6, glow: true },

  // ------------------------------------------------------------------ chords behind the hits (progressions can't be copyrighted)
  { id: 'pop-axis', path: 'hits', em: '🔥', title: 'The Pop Song Chords', how: 'C, G, Am, F — these 4 chords are in hundreds of hit songs!', type: 'chord', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], glow: true, groove: 'pop', bpm: 90 },
  { id: 'pop-sad', path: 'hits', em: '🌧️', title: 'The Sad-Pop Flip', how: 'Start on the minor chord: Am, F, C, G.', type: 'chord', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], glow: true, groove: 'hiphop', bpm: 80 },
  { id: 'doowop', path: 'hits', em: '📻', title: '’50s Doo-Wop Chords', how: 'C, Am, F, G — the sound of old-time rock ’n’ roll.', type: 'chord', chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], glow: true, groove: 'swing', bpm: 100 },
  { id: 'blues', path: 'hits', em: '🎷', title: '12-Bar Blues', how: 'The chords behind blues and rock: C, F and G.', type: 'chord', chords: ['C', 'C', 'C', 'C', 'F', 'F', 'C', 'C', 'G', 'F', 'C', 'G'], glow: true, groove: 'swing', bpm: 110 },
  { id: 'pop-solo', path: 'hits', em: '🏆', title: 'Pop Chords — No Help', how: 'C, G, Am, F again, with no glowing keys.', type: 'chord', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], groove: 'pop', bpm: 90 },

  // ------------------------------------------------------------------ make it up
  { id: 'jam-black', path: 'create', em: '🖤', title: 'Black-Key Jam', how: 'Make up music with ONLY the black keys. It always sounds good!', type: 'improv', allowed: ['C♯', 'D♯', 'F♯', 'G♯', 'A♯'], seconds: 30, groove: 'funk' },
  { id: 'jam-penta', path: 'create', em: '🎤', title: 'Pop Solo', how: 'Use only C, D, E, G and A (the glowing keys) over a pop beat.', type: 'improv', allowed: ['C', 'D', 'E', 'G', 'A'], seconds: 30, groove: 'pop', glow: true },
  { id: 'jam-blues', path: 'create', em: '🎷', title: 'Blues Solo', how: 'C, E♭, F, G and B♭ — the blues scale. Bend some notes!', type: 'improv', allowed: ['C', 'E♭', 'F', 'G', 'B♭'], seconds: 40, groove: 'swing', glow: true },

  // ------------------------------------------------------------------ partners (duet)
  { id: 'partner-echo', path: 'duet', em: '🪞', title: 'Copy Your Partner', how: 'One player makes up 3–6 notes, the other copies them. Then switch!', type: 'partner', rounds: 6 },
  { id: 'ost-pop', path: 'duet', em: '🔁', title: 'Ostinato + Solo', how: 'One player learns the riff and keeps it going. The other makes up a solo on the glowing keys. Then switch!', type: 'ostinato', riff: 'C3 G3 A3 G3', allowed: ['C', 'D', 'E', 'G', 'A'], seconds: 25, learnTimes: 2, groove: 'pop', bpm: 96 },
  { id: 'ost-minor', path: 'duet', em: '🌙', title: 'Minor Groove + Solo', how: 'A spooky minor riff. Keep it steady while your partner solos!', type: 'ostinato', riff: 'A3 C4 E4 C4', allowed: ['A', 'C', 'D', 'E', 'G'], seconds: 25, learnTimes: 2, groove: 'hiphop', bpm: 84 },
  { id: 'ost-boogie', path: 'duet', em: '🎷', title: 'Boogie Bass + Blues Solo', how: 'A walking boogie bass line and a blues solo on top.', type: 'ostinato', riff: 'C3 E3 G3 A3 Bb3 A3 G3 E3', allowed: ['C', 'E♭', 'F', 'G', 'B♭'], seconds: 30, learnTimes: 2, groove: 'swing', bpm: 108 },
  { id: 'harm-buns', path: 'duet', em: '🎵', title: 'Harmony: Hot Cross Buns', how: 'Play together! Each player follows their own color. The harmony is 3 notes higher.', type: 'parts', names: ['Melody', 'Harmony'], swap: true, bpm: 100,
    a: 'E4 D4 C4/2 E4 D4 C4/2 C4/.5 C4/.5 C4/.5 C4/.5 D4/.5 D4/.5 D4/.5 D4/.5 E4 D4 C4/2',
    b: 'G4 F4 E4/2 G4 F4 E4/2 E4/.5 E4/.5 E4/.5 E4/.5 F4/.5 F4/.5 F4/.5 F4/.5 G4 F4 E4/2' },
  { id: 'harm-twinkle', path: 'duet', em: '⭐', title: 'Harmony: Twinkle', how: 'Melody up high, harmony down low. Listen for how they fit together!', type: 'parts', names: ['Melody', 'Harmony'], swap: true, bpm: 100,
    a: 'C5 C5 G5 G5 A5 A5 G5/2 F5 F5 E5 E5 D5 D5 C5/2',
    b: 'C4 C4 E4 E4 F4 F4 E4/2 D4 D4 C4 C4 B3 B3 C4/2' },
  { id: 'harm-ode', path: 'duet', em: '🎺', title: 'Harmony: Ode to Joy', how: 'The harmony follows the melody, 3 notes lower.', type: 'parts', names: ['Melody', 'Harmony'], swap: true, bpm: 108,
    a: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4/1.5 D4/.5 D4/2',
    b: 'C4 C4 D4 E4 E4 D4 C4 B3 A3 A3 B3 C4 C4/1.5 B3/.5 B3/2' },
  { id: 'qa', path: 'duet', em: '💬', title: 'Question & Answer', how: 'Player 1 asks a musical question. Player 2 answers it and lands home on C.', type: 'parts', names: ['Question', 'Answer'], swap: true, bpm: 104,
    a: 'C4 D4 E4 D4/2 - - - - G4 A4 G4 E4/2 - - - -',
    b: '- - - - E4 D4 D4 C4/2 - - - - D4 E4 D4 C4/2' },
  { id: 'partner-chords', path: 'duet', em: '🤝', title: 'Band: Chords + Solo', how: 'Player 1 plays the chords. Player 2 makes up a solo on the glowing keys.', type: 'chord', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], glow: true, groove: 'pop', bpm: 84, duet: true, soloKeys: ['C', 'D', 'E', 'G', 'A'] },
];

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'F♯', 'Bb', 'E♭' -> pitch class 0..11 */
export function pcOf(name) {
  const m = /^([A-G])([#♯b♭]?)/.exec(name);
  return (PC[m[1]] + (/[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0) + 12) % 12;
}

/** 'Am' -> { root, pcs: [9, 0, 4], name } */
export function chordOf(name) {
  const root = pcOf(name);
  const minor = /m$/.test(name);
  return { name, root, pcs: [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12] };
}
