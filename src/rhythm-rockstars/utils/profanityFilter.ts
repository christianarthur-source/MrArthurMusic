/**
 * School-friendly profanity and inappropriate language filter
 * Designed for elementary and K-12 music classroom environments.
 * Prevents common profanities, vulgarities, slurs, hate speech, and leetspeak bypasses,
 * while safely permitting school musical terms (e.g., "Bass", "Class", "Brass", "Pass").
 */

// Safe list of innocent words that contain substrings of banned words
const SAFE_WORDS = new Set([
  'bass',
  'bassist',
  'bassline',
  'brass',
  'class',
  'classes',
  'classic',
  'classical',
  'classroom',
  'classmate',
  'pass',
  'passage',
  'passcode',
  'passed',
  'passing',
  'compass',
  'grass',
  'glass',
  'glasses',
  'mass',
  'cassette',
  'asset',
  'assets',
  'assist',
  'assistant',
  'assisting',
  'associate',
  'association',
  'assembly',
  'embassy',
  'passion',
  'passionate',
  'trespass',
  'harass',
  'harassment',
  'butter',
  'button',
  'cockpit',
  'hancock',
  'peacock',
  'dickens',
  'title',
  'titles',
  'titular',
  'hello',
  'shell',
  'shellac',
  'seashell'
]);

// Explicit blocked roots and words (all lowercase)
const BLOCKED_WORDS = [
  // Profanities & Vulgarities
  'fuck',
  'fucker',
  'fucking',
  'fuk',
  'fuq',
  'fck',
  'motherfucker',
  'shit',
  'shitty',
  'shyt',
  'sh1t',
  'bullshit',
  'horseshit',
  'dipshit',
  'bitch',
  'bitches',
  'bitchy',
  'biatch',
  'b1tch',
  'bastard',
  'bastards',
  'cunt',
  'cunts',
  'twat',
  'wanker',
  'prick',
  'slut',
  'sluts',
  'whore',
  'whores',
  'hoe',
  'piss',
  'pissed',
  'pissing',
  'crap',
  'crappy',
  'dildo',
  'stfu',
  'wtf',
  'milf',

  // Ass & compounds
  'ass',
  'asses',
  'asshole',
  'assholes',
  'arse',
  'arsehole',
  'dumbass',
  'jackass',
  'badass',
  'fatass',
  'smartass',
  'kickass',
  'tightass',
  'butthole',

  // Anatomy & Sexual Terms
  'dick',
  'dicks',
  'dickhead',
  'cock',
  'cocks',
  'pussy',
  'pussies',
  'penis',
  'penises',
  'vagina',
  'vaginas',
  'anus',
  'anal',
  'clit',
  'clitoris',
  'scrotum',
  'testicle',
  'testicles',
  'boob',
  'boobs',
  'boobie',
  'boobies',
  'tit',
  'tits',
  'titties',
  'blowjob',
  'handjob',
  'cum',
  'cumming',
  'semen',
  'jizz',
  'ejaculate',
  'masturbat',
  'masturbate',
  'masturbation',
  'horny',
  'nude',
  'naked',
  'sex',
  'sexy',
  'porn',
  'porno',
  'pornography',
  'orgasm',

  // Slurs & Hate Speech
  'nigger',
  'nigga',
  'nigg',
  'faggot',
  'fag',
  'dyke',
  'retard',
  'tard',
  'chink',
  'spic',
  'kike',
  'wetback',
  'gook',
  'tranny',
  'shemale',

  // Harassment & Violence / Illegal Drugs
  'kill',
  'suicide',
  'murder',
  'hitler',
  'nazi',
  'cocaine',
  'heroin',
  'meth',
  'weed',
  'stoner',
  'crackhead'
];

/**
 * Normalizes leetspeak substitutions to standard Latin characters
 */
function normalizeLeetspeak(input: string): string {
  return input
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/vv/g, 'w')
    .replace(/8/g, 'b');
}

/**
 * Helper to check if a word is protected by the safe list
 */
function isSafeWord(word: string): boolean {
  return SAFE_WORDS.has(word.toLowerCase());
}

/**
 * Checks if a string contains inappropriate or profane language.
 * Handles spaces, symbols, and leetspeak substitutions.
 */
export function containsInappropriateLanguage(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  const rawLower = input.trim().toLowerCase();
  if (!rawLower) return false;

  // 1. Token-level check (space/punctuation separated)
  const tokens = rawLower.split(/[\s_\-.,!?#%&*+~=/\\]+/).filter(Boolean);
  for (const token of tokens) {
    if (isSafeWord(token)) continue;

    const normalizedToken = normalizeLeetspeak(token);
    const collapsedToken = normalizedToken.replace(/(.)\1+/g, '$1');

    if (isSafeWord(normalizedToken) || isSafeWord(collapsedToken)) continue;

    for (const bad of BLOCKED_WORDS) {
      // Direct token match
      if (normalizedToken === bad || collapsedToken === bad) {
        return true;
      }

      // Substring check for longer words (length >= 4)
      if (bad.length >= 4) {
        if (normalizedToken.includes(bad) || collapsedToken.includes(bad)) {
          // If token starts or ends with safe word, double-check
          if (!isSafeWord(normalizedToken) && !isSafeWord(collapsedToken)) {
            return true;
          }
        }
      }

      // Specific check for short words like 'ass', 'tit', 'fag', 'cum', 'hoe'
      if (['ass', 'tit', 'fag', 'cum', 'hoe'].includes(bad)) {
        if (normalizedToken === bad || collapsedToken === bad) {
          return true;
        }
        // Check for words ending or starting with ass: e.g. dumbass, badass
        if (bad === 'ass' && (normalizedToken.endsWith('ass') || collapsedToken.endsWith('ass'))) {
          if (!isSafeWord(normalizedToken) && !isSafeWord(collapsedToken)) {
            return true;
          }
        }
      }
    }
  }

  // 2. Compressed whole-string check (to catch bypasses like "f u c k", "b-i-t-c-h", "s.h.i.t", "a s s")
  const stripped = normalizeLeetspeak(rawLower).replace(/[^a-z]/g, '');
  const collapsedStripped = stripped.replace(/(.)\1+/g, '$1');

  if (isSafeWord(stripped) || isSafeWord(collapsedStripped)) {
    return false;
  }

  for (const bad of BLOCKED_WORDS) {
    if (bad === 'ass' || bad === 'hoe' || bad === 'tit') {
      // Must not match inside safe words like "bass", "classical", "butter"
      // Check regex on word boundaries in leet-normalized text
      const regex = new RegExp(`(^|[^a-z])${bad}([^a-z]|$)`, 'i');
      if (regex.test(normalizeLeetspeak(rawLower))) {
        return true;
      }
      // Or if the entire stripped input is just 'ass' or 'asses'
      if (stripped === bad || collapsedStripped === bad || stripped === bad + 'es') {
        return true;
      }
    } else if (bad.length >= 3) {
      if (stripped.includes(bad) || collapsedStripped.includes(bad)) {
        // Verify this wasn't an accidental substring of a safe musical word
        let harmless = false;
        for (const safe of SAFE_WORDS) {
          if (stripped.includes(safe) && safe.includes(bad)) {
            harmless = true;
            break;
          }
        }
        if (!harmless) {
          return true;
        }
      }
    }
  }

  return false;
}

export const PROFANITY_WARNING_MESSAGE =
  'That rockstar name contains inappropriate language! Please choose a fun, school-friendly stage name (e.g. Drummer Maya, BeatMaster Leo).';
