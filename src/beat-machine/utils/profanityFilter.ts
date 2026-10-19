/**
 * Classroom-friendly profanity filter utility.
 * Protects against inappropriate language in custom sound names, recording labels,
 * search queries, and shared project titles.
 */

// Comprehensive list of inappropriate words, slurs, profanity, vulgarities,
// and common leetspeak/substitution variations.
const PROFANE_WORDS = new Set([
  // Core profanities & variations
  'fuck', 'fucker', 'fucking', 'fucked', 'fucks', 'fuckin', 'fuk', 'fuking', 'fck', 'fckn', 'fcker',
  'shit', 'shitty', 'shitter', 'shits', 'shite', 'bullshit', 'sh1t',
  'bitch', 'bitches', 'bitching', 'bitchy', 'b1tch',
  'ass', 'asshole', 'assholes', 'dumbass', 'badass', 'fatass', 'jackass', 'smartass', 'arse', 'arsehole',
  'bastard', 'bastards',
  'damn', 'dammit', 'damned',
  'crap', 'crappy',
  'dick', 'dicks', 'dickhead', 'd1ck',
  'cock', 'cocks', 'cocksucker',
  'pussy', 'pussies', 'puss',
  'cunt', 'cunts',
  'tits', 'titties', 'titty', 'boobs', 'boob',
  'whore', 'whores', 'slut', 'sluts', 'skank',
  'vagina', 'penis', 'dildo', 'masturbate', 'masturbation', 'orgasm', 'porn', 'porno', 'pornography', 'xxx', 'hentai',
  'nude', 'nudes', 'naked', 'sex', 'sexy', 'blowjob', 'handjob', 'cum', 'cumming', 'semen', 'ejaculate',
  'boner',

  // Hate speech, racial/ethnic/homophobic slurs
  'nigger', 'niggers', 'nigga', 'niggas', 'n1gger', 'n1gga',
  'faggot', 'faggots', 'fag', 'fags', 'f@g', 'f@ggot',
  'retard', 'retarded', 'tard',
  'spic', 'spick', 'chink', 'gook', 'kike', 'kyke', 'wetback', 'coon',
  'dyke', 'tranny',

  // Violence / Self-harm / Drugs inappropriate for school
  'kill yourself', 'kys', 'suicide', 'murder',
  'cocaine', 'heroin', 'meth', 'weed', 'blunt', 'stoned',
]);

// Patterns for regex check (e.g. word boundary checks with character substitutions)
const LEET_REPLACEMENTS: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
};

/**
 * Normalizes text to detect obfuscated profanity like "f.u.c.k", "b!tch", "sh1t"
 */
function normalizeForCheck(text: string): string {
  let lower = text.toLowerCase();
  for (const [char, replacement] of Object.entries(LEET_REPLACEMENTS)) {
    lower = lower.split(char).join(replacement);
  }
  return lower;
}

/**
 * Checks if a given text string contains profanity or inappropriate language.
 */
export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  const raw = text.trim();
  if (!raw) return false;

  const normalized = normalizeForCheck(raw);

  // 1. Direct whole-word token check
  const words = normalized.split(/[\s_\-.,!?/\\+=;:()&^*%#@~`|<>"{}\[\]]+/);
  for (const word of words) {
    if (!word) continue;
    if (PROFANE_WORDS.has(word)) {
      return true;
    }
  }

  // 2. Continuous stripped check (detects f-u-c-k, f_u_c_k, f u c k)
  const stripped = normalized.replace(/[^a-z0-9]/g, '');
  for (const bad of PROFANE_WORDS) {
    // For words of 4 or more chars, check if stripped contains the word or equals it
    if (bad.length >= 4) {
      if (stripped.includes(bad.replace(/[^a-z0-9]/g, ''))) {
        return true;
      }
    }
  }

  // 3. Multi-word phrase check (like "kill yourself")
  for (const bad of PROFANE_WORDS) {
    if (bad.includes(' ') && normalized.includes(bad)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitizes input text by replacing offensive words with kid-friendly stars or returning a clean fallback.
 */
export function cleanProfanity(text: string, fallback = 'Fun Sound'): string {
  if (!text) return fallback;
  if (containsProfanity(text)) {
    return fallback;
  }
  return text;
}
