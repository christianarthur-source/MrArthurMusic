// Song library for the "Songs" guide. Every tune here is in the public domain.
// Notes are written as NAME+OCTAVE, optionally followed by /beats (1 beat when left out): "E4 D4 C4/2".
// C4 is middle C. Use # for sharps and b for flats. Only the melody is stored (one note at a time).

export const LEVELS = {
  starter: { name: 'Starter', em: '🌱', c: '#39e36b' },
  fav: { name: 'Kid Favorites', em: '⭐', c: '#ffb020' },
  folk: { name: 'Folk & Nursery', em: '🎈', c: '#5cd6ff' },
  band: { name: 'Band Tunes', em: '🎺', c: '#ffd447' },
  piano: { name: 'Piano Pieces', em: '🎹', c: '#ff8fb1' },
};

export const SONGS = [
  // ------------------------------------------------------------------ starter
  { id: 'scale', level: 'starter', title: 'C Scale Up & Down', bpm: 100,
    notes: 'C4 D4 E4 F4 G4 A4 B4 C5/2 C5 B4 A4 G4 F4 E4 D4 C4/2' },
  { id: 'buns', level: 'starter', title: 'Hot Cross Buns', bpm: 100,
    notes: 'E4 D4 C4/2 E4 D4 C4/2 C4/.5 C4/.5 C4/.5 C4/.5 D4/.5 D4/.5 D4/.5 D4/.5 E4 D4 C4/2' },
  { id: 'mary', level: 'starter', title: 'Mary Had a Little Lamb', bpm: 110,
    notes: 'E4 D4 C4 D4 E4 E4 E4/2 D4 D4 D4/2 E4 G4 G4/2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4/4' },
  { id: 'twinkle', level: 'starter', title: 'Twinkle, Twinkle, Little Star', bpm: 100,
    notes: 'C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2 G4 G4 F4 F4 E4 E4 D4/2 G4 G4 F4 F4 E4 E4 D4/2 C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2' },

  // ------------------------------------------------------------------ kid favourites (all public domain)
  { id: 'birthday', level: 'fav', title: 'Happy Birthday', bpm: 100,
    notes: 'C4/.75 C4/.25 D4 C4 F4 E4/2 C4/.75 C4/.25 D4 C4 G4 F4/2 C4/.75 C4/.25 C5 A4 F4 E4 D4 Bb4/.75 Bb4/.25 A4 F4 G4 F4/3' },
  { id: 'shark', level: 'fav', title: 'Baby Shark', bpm: 116,
    notes: 'D4/.5 E4/.5 G4/.5 G4/.5 G4/.5 G4/.25 G4/.5 G4/.25 G4/.5 D4/.5 E4/.5 G4/.5 G4/.5 G4/.5 G4/.25 G4/.5 G4/.25 G4/.5 D4/.5 E4/.5 G4/.5 G4/.5 G4/.5 G4/.25 G4/.5 G4/.25 G4/.5 G4/.5 G4/.5 F#4/3' },
  { id: 'sailor', level: 'fav', title: 'Drunken Sailor (Sea Shanty)', bpm: 120,
    notes: 'A4 A4/.5 A4/.5 A4 A4/.5 A4/.5 A4 D4 F4 A4 G4 G4/.5 G4/.5 G4 G4/.5 G4/.5 G4 C4 E4 G4 A4 A4/.5 A4/.5 A4 A4/.5 A4/.5 A4 B4 C5 D5 C5 A4 G4 E4 D4/2 D4/2' },
  { id: 'cucaracha', level: 'fav', title: 'La Cucaracha', bpm: 126,
    notes: 'C4/.5 C4/.5 C4/.5 F4/1.5 A4 C4/.5 C4/.5 C4/.5 F4/1.5 A4/2 F4 F4/.5 E4/.5 E4/.5 D4/.5 D4/.5 C4/2.5 C4/.5 C4/.5 C4/.5 E4/1.5 G4 C4/.5 C4/.5 C4/.5 E4/1.5 G4/2 C5 D5/.5 C5/.5 Bb4/.5 A4/.5 G4/.5 F4/2.5' },
  { id: 'entertainer', level: 'fav', title: 'The Entertainer', bpm: 132,
    notes: 'D4/.5 D#4/.5 E4/.5 C5 E4/.5 C5 E4/.5 C5/3 C5/.5 D5/.5 D#5/.5 E5/.5 C5/.5 D5/.5 E5 B4/.5 D5 C5/3 D4/.5 D#4/.5 E4/.5 C5 E4/.5 C5 E4/.5 C5/3 A4/.5 G4/.5 F#4/.5 A4/.5 C5/.5 E5 D5/.5 C5/.5 A4/.5 D5/3' },
  { id: 'fifth', level: 'fav', title: 'Beethoven’s 5th', bpm: 132,
    notes: 'G4/.5 G4/.5 G4/.5 Eb4/2.5 F4/.5 F4/.5 F4/.5 D4/2.5 G4/.5 G4/.5 G4/.5 Eb4/.5 Ab4/.5 Ab4/.5 Ab4/.5 G4/.5 Eb5/.5 Eb5/.5 Eb5/.5 C5/2.5 G4/.5 G4/.5 G4/.5 D4/.5 Ab4/.5 Ab4/.5 Ab4/.5 G4/.5 F5/.5 F5/.5 F5/.5 D5/2.5' },
  { id: 'canon', level: 'fav', title: 'Canon in D', bpm: 100,
    notes: 'F#5/2 E5/2 D5/2 C#5/2 B4/2 A4/2 B4/2 C#5/2 D5/2 C#5/2 B4/2 A4/2 G4/2 F#4/2 G4/2 E4/2 D4/4' },
  { id: 'sugarplum', level: 'fav', title: 'Dance of the Sugar Plum Fairy', bpm: 108,
    notes: 'G5/.5 E5/.5 G5 F#5 D#5 E5 D5/.5 D5/.5 D5 C#5/.5 C#5/.5 C#5 C5/.5 C5/.5 C5 B4/.5 E5/.5 C5/.5 E5/.5 B4/2' },
  { id: 'merry', level: 'fav', title: 'We Wish You a Merry Christmas', bpm: 132,
    notes: 'G4 C5 C5/.5 D5/.5 C5/.5 B4/.5 A4 A4 A4 D5 D5/.5 E5/.5 D5/.5 C5/.5 B4 G4 G4 E5 E5/.5 F5/.5 E5/.5 D5/.5 C5 A4 G4/.5 G4/.5 A4 D5 B4 C5/2' },
  { id: 'deck', level: 'fav', title: 'Deck the Halls', bpm: 126,
    notes: 'G4/1.5 F4/.5 E4 D4 C4 D4 E4 C4 D4/.5 E4/.5 F4/.5 D4/.5 E4/1.5 D4/.5 C4 B3 C4/2 G4/1.5 F4/.5 E4 D4 C4 D4 E4 C4 D4/.5 E4/.5 F4/.5 D4/.5 E4/1.5 D4/.5 C4 B3 C4/2 D4/1.5 E4/.5 F4 D4 E4/1.5 F4/.5 G4 D4 E4/.5 F#4/.5 G4 A4/.5 B4/.5 C5 B4 A4 G4/2 G4/1.5 F4/.5 E4 D4 C4 D4 E4 C4 A4/.5 A4/.5 A4/.5 A4/.5 G4/1.5 F4/.5 E4 D4 C4/2' },

  // ------------------------------------------------------------------ folk & nursery
  { id: 'spider', level: 'folk', title: 'Itsy Bitsy Spider', bpm: 112,
    notes: 'G3 C4 C4 C4 D4 E4/2 E4 D4 C4 D4 E4 C4/2 E4/2 E4 F4 G4/2 G4 F4 E4 F4 G4 E4/2 C4/2 C4 D4 E4/2 E4 D4 C4 D4 E4 C4/2 G3 G3 C4 C4 C4 D4 E4/2 E4 D4 C4 D4 E4 C4/2' },
  { id: 'bingo', level: 'folk', title: 'Bingo', bpm: 120,
    notes: 'G3 C4 C4 G3 G3 A3 A3 G3 G3 C4 C4 D4 D4 E4/2 C4/2 E4/2 E4 F4/.5 F4/.5 F4/2 D4/2 D4 E4/.5 E4/.5 E4/2 C4/2 C4 D4/.5 D4/.5 D4/.5 C4/.5 B3 G3 A3 B3 C4/2 C4/2' },
  { id: 'row', level: 'folk', title: 'Row, Row, Row Your Boat', bpm: 76,
    notes: 'C4 C4 C4/.67 D4/.33 E4 E4/.67 D4/.33 E4/.67 F4/.33 G4/2 C5/.33 C5/.33 C5/.34 G4/.33 G4/.33 G4/.34 E4/.33 E4/.33 E4/.34 C4/.33 C4/.33 C4/.34 G4/.67 F4/.33 E4/.67 D4/.33 C4/2' },
  { id: 'london', level: 'folk', title: 'London Bridge', bpm: 110,
    notes: 'G4/1.5 A4/.5 G4 F4 E4 F4 G4/2 D4 E4 F4/2 E4 F4 G4/2 G4/1.5 A4/.5 G4 F4 E4 F4 G4/2 D4/2 G4/2 E4 C4/3' },
  { id: 'frere', level: 'folk', title: 'Frère Jacques (Are You Sleeping?)', bpm: 110,
    notes: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4/2 E4 F4 G4/2 G4/.5 A4/.5 G4/.5 F4/.5 E4 C4 G4/.5 A4/.5 G4/.5 F4/.5 E4 C4 C4 G3 C4/2 C4 G3 C4/2' },
  { id: 'macdonald', level: 'folk', title: 'Old MacDonald Had a Farm', bpm: 110,
    notes: 'F4 F4 F4 C4 D4 D4 C4/2 A4 A4 G4 G4 F4/3 C4 F4 F4 F4 C4 D4 D4 C4/2 A4 A4 G4 G4 F4/4' },
  { id: 'yankee', level: 'folk', title: 'Yankee Doodle', bpm: 120,
    notes: 'C4 C4 D4 E4 C4 E4 D4 G3 C4 C4 D4 E4 C4/2 B3/2 C4 C4 D4 E4 F4 E4 D4 C4 B3 G3 A3 B3 C4/2 C4/2' },
  { id: 'susanna', level: 'folk', title: 'Oh! Susanna', bpm: 120,
    notes: 'C4/.5 D4/.5 E4 G4 G4/1.5 A4/.5 G4 E4 C4/1.5 D4/.5 E4 E4 D4 C4 D4/3 C4/.5 D4/.5 E4 G4 G4/1.5 A4/.5 G4 E4 C4/1.5 D4/.5 E4 E4 D4 D4 C4/3' },
  { id: 'camptown', level: 'folk', title: 'Camptown Races', bpm: 110,
    notes: 'G4/.5 G4/.5 E4/.5 G4/.5 A4/.5 G4/.5 E4 E4/.5 D4/1.5 E4/.5 D4/1.5 G4/.5 G4/.5 E4/.5 G4/.5 A4/.5 G4/.5 E4 D4/.75 E4/.25 D4 C4/2' },
  { id: 'grace', level: 'folk', title: 'Amazing Grace', bpm: 90,
    notes: 'D4 G4/2 B4/.5 G4/.5 B4/2 A4 G4/2 E4 D4/2 D4 G4/2 B4/.5 G4/.5 B4/2 A4 D5/5 B4 D5/1.5 B4/.5 D5/.5 B4/.5 G4/2 D4 E4/1.5 G4/.5 G4/.5 E4/.5 D4/2 D4 G4/2 B4/.5 G4/.5 B4/2 A4 G4/5' },

  // ------------------------------------------------------------------ beginning band favourites
  { id: 'clair', level: 'band', title: 'Au Clair de la Lune', bpm: 100,
    notes: 'C4 C4 C4 D4 E4/2 D4/2 C4 E4 D4 D4 C4/4 C4 C4 C4 D4 E4/2 D4/2 C4 E4 D4 D4 C4/4 D4 D4 D4 D4 A3/2 A3/2 D4 C4 B3 A3 G3/4 C4 C4 C4 D4 E4/2 D4/2 C4 E4 D4 D4 C4/4' },
  { id: 'lightly', level: 'band', title: 'Lightly Row', bpm: 110,
    notes: 'G4 E4 E4/2 F4 D4 D4/2 C4 D4 E4 F4 G4 G4 G4/2 G4 E4 E4/2 F4 D4 D4/2 C4 E4 G4 G4 E4/4 D4 D4 D4 D4 D4 E4 F4/2 E4 E4 E4 E4 E4 F4 G4/2 G4 E4 E4/2 F4 D4 D4/2 C4 E4 G4 G4 C4/4' },
  { id: 'ode', level: 'band', title: 'Ode to Joy', bpm: 110,
    notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4/1.5 D4/.5 D4/2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4/1.5 C4/.5 C4/2 D4 D4 E4 C4 D4 E4/.5 F4/.5 E4 C4 D4 E4/.5 F4/.5 E4 D4 C4 D4 G3/2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4/1.5 C4/.5 C4/2' },
  { id: 'jingle', level: 'band', title: 'Jingle Bells', bpm: 120,
    notes: 'E4 E4 E4/2 E4 E4 E4/2 E4 G4 C4/1.5 D4/.5 E4/4 F4 F4 F4/1.5 F4/.5 F4 E4 E4 E4/.5 E4/.5 E4 D4 D4 E4 D4/2 G4/2 E4 E4 E4/2 E4 E4 E4/2 E4 G4 C4/1.5 D4/.5 E4/4 F4 F4 F4/1.5 F4/.5 F4 E4 E4 E4/.5 E4/.5 G4 G4 F4 D4 C4/4' },
  { id: 'saints', level: 'band', title: 'When the Saints Go Marching In', bpm: 130,
    notes: 'C4 E4 F4 G4/5 C4 E4 F4 G4/5 C4 E4 F4 G4/2 E4/2 C4/2 E4/2 D4/4 E4 E4 D4 C4/3 C4 E4/2 G4/2 G4 F4/3 E4 F4 G4/2 E4/2 C4/2 D4/2 C4/4' },
  { id: 'america', level: 'band', title: 'America (My Country, ’Tis of Thee)', bpm: 96,
    notes: 'C4 C4 D4 B3/1.5 C4/.5 D4 E4 E4 F4 E4/1.5 D4/.5 C4 D4 C4 B3 C4/3 G4 G4 G4 G4/1.5 F4/.5 E4 F4 F4 F4 F4/1.5 E4/.5 D4 E4 F4/.5 E4/.5 D4/.5 C4/.5 E4/1.5 F4/.5 G4 A4/.5 F4/.5 E4 D4 C4/3' },
  { id: 'cancan', level: 'band', title: 'Can-Can', bpm: 132,
    notes: 'C4/2 D4/.5 F4/.5 E4/.5 D4/.5 G4 G4 G4/.5 A4/.5 E4/.5 F4/.5 D4 D4 D4/.5 F4/.5 E4/.5 D4/.5 C4/.5 C5/.5 B4/.5 A4/.5 G4/.5 F4/.5 E4/.5 D4/.5 C4/2 D4/.5 F4/.5 E4/.5 D4/.5 G4 G4 G4/.5 A4/.5 E4/.5 F4/.5 D4 D4 D4/.5 F4/.5 E4/.5 D4/.5 C4/.5 G4/.5 D4/.5 E4/.5 C4/2' },

  // ------------------------------------------------------------------ piano pieces (melody)
  { id: 'lullaby', level: 'piano', title: 'Brahms’ Lullaby', bpm: 84,
    notes: 'E4/.5 E4/.5 G4/1.5 E4/.5 E4 G4/2 E4/.5 G4/.5 C5 B4/1.5 A4/.5 A4 G4 D4/.5 E4/.5 F4 D4 D4/.5 E4/.5 F4/2 D4/.5 F4/.5 B4/.5 A4/.5 G4 B4 C5/2 C4/.5 C4/.5 C5/2 A4/.5 F4/.5 G4/2 E4/.5 C4/.5 F4 G4 A4 G4/2 C4/.5 C4/.5 C5/2 A4/.5 F4/.5 G4/2 E4/.5 C4/.5 F4 E4 D4 C4/2' },
  { id: 'mountain', level: 'piano', title: 'In the Hall of the Mountain King', bpm: 120,
    notes: 'A4/.5 B4/.5 C5/.5 D5/.5 E5/.5 C5/.5 E5 D#5/.5 C5/.5 D#5 D5/.5 B4/.5 D5 A4/.5 B4/.5 C5/.5 D5/.5 E5/.5 C5/.5 E5/.5 A5/.5 G5/.5 E5/.5 C5/.5 E5/.5 G5/2' },
  { id: 'nachtmusik', level: 'piano', title: 'Eine kleine Nachtmusik (Mozart)', bpm: 126,
    notes: 'G4 D4/.5 G4 D4/.5 G4/.5 D4/.5 G4/.5 B4/.5 D5/2 C5 A4/.5 C5 A4/.5 C5/.5 A4/.5 F#4/.5 A4/.5 D4/2' },
  { id: 'minuet', level: 'piano', title: 'Minuet in G', bpm: 116,
    notes: 'D5 G4/.5 A4/.5 B4/.5 C5/.5 D5 G4 G4 E5 C5/.5 D5/.5 E5/.5 F#5/.5 G5 G4 G4 C5 D5/.5 C5/.5 B4/.5 A4/.5 B4 C5/.5 B4/.5 A4/.5 G4/.5 F#4 G4/.5 A4/.5 B4/.5 G4/.5 A4/3 D5 G4/.5 A4/.5 B4/.5 C5/.5 D5 G4 G4 E5 C5/.5 D5/.5 E5/.5 F#5/.5 G5 G4 G4 C5 D5/.5 C5/.5 B4/.5 A4/.5 B4 C5/.5 B4/.5 A4/.5 G4/.5 A4 B4/.5 A4/.5 G4/.5 F#4/.5 G4/3' },
  { id: 'elise', level: 'piano', title: 'Für Elise (Beethoven)', bpm: 120,
    notes: 'E5/.5 D#5/.5 E5/.5 D#5/.5 E5/.5 B4/.5 D5/.5 C5/.5 A4/1.5 C4/.5 E4/.5 A4/.5 B4/1.5 E4/.5 G#4/.5 B4/.5 C5/1.5 E4/.5 E5/.5 D#5/.5 E5/.5 D#5/.5 E5/.5 B4/.5 D5/.5 C5/.5 A4/1.5 C4/.5 E4/.5 A4/.5 B4/1.5 E4/.5 C5/.5 B4/.5 A4/2' },
];

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Turns a song's note string into [{ n: MIDI note, d: beats, label: 'F♯' }]. */
export function parseNotes(text) {
  return text.trim().split(/\s+/).map((tok) => {
    const [pitch, dur] = tok.split('/');
    const m = /^([A-G])([#b]?)(\d)$/.exec(pitch);
    if (!m) throw new Error('Bad note: ' + tok);
    const n = STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (Number(m[3]) + 1);
    return { n, d: dur ? parseFloat(dur) : 1, label: m[1] + (m[2] === '#' ? '♯' : m[2] === 'b' ? '♭' : '') };
  });
}
