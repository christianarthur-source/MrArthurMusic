/**
 * Strict Classroom Profanity & Inappropriate Content Filter
 * Blocks profanity, slurs, anatomical/sexual terms, suggestive words or phrases,
 * bathroom humor, drug/alcohol references, violence/self-harm, and leetspeak obfuscations.
 */

// Words that must NEVER appear even as substrings inside alphanumeric chunks (after normalization)
const STRICT_SUBSTRING_ROOTS = [
  'fuck',
  'fuk',
  'fck',
  'fvck',
  'phuck',
  'phuk',
  'shit',
  'sh1t',
  'shyt',
  'bitch',
  'biatch',
  'b1tch',
  'bastard',
  'cunt',
  'cvnt',
  'kunt',
  'dick',
  'd1ck',
  'cock',
  'c0ck',
  'pussy',
  'pussies',
  'twat',
  'whore',
  'wh0re',
  'slut',
  'slvt',
  'skank',
  'faggot',
  'fag',
  'nigger',
  'nigga',
  'n1gga',
  'n1gger',
  'nigg',
  'chink',
  'spic',
  'wetback',
  'kike',
  'tranny',
  'retard',
  'r3tard',
  'asshole',
  'arsehole',
  'jackass',
  'dumbass',
  'badass',
  'fatass',
  'deadass',
  'headass',
  'buttplug',
  'butthole',
  'blowjob',
  'handjob',
  'rimjob',
  'footjob',
  'titjob',
  'boobjob',
  'cumshot',
  'creampie',
  'gangbang',
  'bukkake',
  'deepthroat',
  'masturbat',
  'jerkoff',
  'jackoff',
  'circlejerk',
  'dildo',
  'vibrator',
  'clitoris',
  'vagina',
  'penis',
  'testicle',
  'ballsack',
  'nutsack',
  'scrotum',
  'schlong',
  'boner',
  'erection',
  'orgasm',
  'foreskin',
  'smegma',
  'queef',
  'felch',
  'hentai',
  'pornhub',
  'onlyfans',
  'xvideos',
  'xnxx',
  'brazzers',
  'redtube',
  'youporn',
  'xhamster',
  'chaturbate',
  'stripchat',
  'pedophile',
  'ped0',
  'rapist',
  'molest',
  'bestiality',
  'zoophilia',
  'necrophilia',
  'prostitut',
  'brothel',
  'threesome',
  'foursome',
  'cameltoe',
  'titties',
  'titty',
  'boobies',
  'nipple',
  'jizz',
  'deeznuts',
  'deez',
  'ligma',
  'sugma',
  'skibidi',
  'gyatt',
  'cocaine',
  'heroin',
  'fentanyl',
  'methamphetamine',
  'oxycontin',
  'percocet',
  'xanax',
  'marijuana',
  'cannabis',
  'moonshine',
  'hennessy',
  'swastika',
  'hitler',
  'holocaust',
  'genocide',
  'suicide',
  'selfharm',
  'terrorist',
];

// Standalone words or tokens (checked on word boundaries so normal words like "class", "bass", "title", "classic", "grape", "button", "scrap", "sexton", "therapist", "analyze" are checked carefully; note that in a strict K-12 filter we block even risky standalone words)
const STRICT_TOKEN_WORDS = new Set([
  // Profanity & mild swears
  'ass',
  'arse',
  'asses',
  'damn',
  'dammit',
  'damnit',
  'goddamn',
  'crap',
  'crappy',
  'piss',
  'pissed',
  'prick',
  'wank',
  'wanker',
  'bollocks',
  'bugger',
  'hell',
  'wtf',
  'stfu',
  'gtfo',
  'lmfao',
  'af',
  'bs',
  'mf',
  'mfer',
  'milf',
  'dilf',
  'gilf',
  'thot',
  'hoe',
  'hoes',
  'ho',
  'incel',
  'simp',
  'chode',
  'dong',
  'wang',
  'wiener',
  'weiner',
  'weenie',
  'peen',
  'pp',
  'cooch',
  'coochie',
  'cooter',
  'snatch',
  'minge',
  'punani',
  'poontang',
  'bussy',
  'thrussy',
  'clit',
  'tits',
  'tit',
  'boob',
  'boobs',
  'bra',
  'panties',
  'thong',
  'lingerie',
  'cleavage',
  'butt',
  'butts',
  'booty',
  'bum',
  'anus',
  'rectum',
  'anal',
  'oral',
  'cum',
  'cumming',
  'semen',
  'sperm',
  'groin',
  'crotch',
  'pubes',
  'pubic',
  'condom',
  'condoms',
  'lube',
  'viagra',
  'cialis',
  // Sexual / Suggestive terms
  'sex',
  'sexy',
  'sexual',
  'sexually',
  'horny',
  'erotic',
  'kinky',
  'fetish',
  'bdsm',
  'bondage',
  'sadism',
  'masochism',
  'dominatrix',
  'stripper',
  'strippers',
  'hooker',
  'hookers',
  'escort',
  'pimp',
  'orgy',
  'nude',
  'nudes',
  'nudity',
  'naked',
  'undress',
  'porn',
  'porno',
  'nsfw',
  'xxx',
  'hump',
  'humping',
  'twerk',
  'twerking',
  'lapdance',
  'makeout',
  'hickey',
  'hookup',
  'fap',
  'fapping',
  'edging',
  'goon',
  'gooning',
  'gooner',
  'rizz',
  'rizzler',
  'gyat',
  'daddy',
  'papi',
  'zaddy',
  'virgin',
  'virginity',
  'rape',
  'raped',
  'incest',
  'pedo',
  'groomer',
  // Bathroom / Crude humor
  'poop',
  'poopy',
  'pee',
  'peepee',
  'peeing',
  'fart',
  'farts',
  'farting',
  'turd',
  'turds',
  'diarrhea',
  'enema',
  'uranus',
  'booger',
  'vomit',
  'puke',
  // Drugs, Alcohol, Vaping, Tobacco
  'weed',
  'thc',
  'cbd',
  'bong',
  'blunt',
  'spliff',
  'reefer',
  'ganja',
  'kush',
  'dope',
  'coke',
  'crack',
  'meth',
  'molly',
  'mdma',
  'ecstasy',
  'lsd',
  'shrooms',
  'ketamine',
  'adderall',
  'opioid',
  'narcotic',
  'overdose',
  'vape',
  'vaping',
  'juul',
  'zyns',
  'zyn',
  'nicotine',
  'cigarette',
  'cigarettes',
  'cigar',
  'tobacco',
  'beer',
  'beers',
  'vodka',
  'whiskey',
  'tequila',
  'rum',
  'liquor',
  'booze',
  'drunk',
  'wasted',
  'hangover',
  'alcohol',
  'alcoholic',
  'wine',
  'champagne',
  'keg',
  'shotgunning',
  // Violence, Weapons, Self-harm, Hate
  'kill',
  'killing',
  'murder',
  'murderer',
  'kms',
  'kys',
  'die',
  'dying',
  'dead',
  'death',
  'corpse',
  'blood',
  'bloody',
  'gore',
  'gory',
  'stab',
  'stabbing',
  'shoot',
  'shooter',
  'shooting',
  'gun',
  'guns',
  'pistol',
  'rifle',
  'shotgun',
  'glock',
  'ak47',
  'ar15',
  'uzis',
  'uzi',
  'bomb',
  'bombs',
  'bomber',
  'grenade',
  'nuke',
  'nazi',
  'nazis',
  'kkk',
  'klan',
  'isis',
  'alqaeda',
  'taliban',
  'slavery',
  'slave',
  'lynch',
  // Suggestive numbers & codes
  '69',
  '420',
  '666',
  '8008',
  '80085',
  '8008135',
  '5318008',
  '1488',
]);

// Multi-word suggestive, disrespectful, or inappropriate phrases
const STRICT_PHRASES = [
  'bend over',
  'on my knees',
  'on your knees',
  'in my bed',
  'in bed with',
  'touch me',
  'touch my',
  'lick my',
  'suck my',
  'suck it',
  'suck on',
  'eat my',
  'eat me',
  'kiss my',
  'bite my',
  'sit on my',
  'sit on it',
  'ride my',
  'ride it',
  'all night long',
  'one night stand',
  'friends with benefits',
  'netflix and chill',
  'turn me on',
  'turns me on',
  'make love',
  'get laid',
  'sleep with',
  'sleeping with',
  'hook up',
  'hooking up',
  'take it off',
  'take off your',
  'strip down',
  'big balls',
  'my balls',
  'your balls',
  'his balls',
  'blue balls',
  'balls deep',
  'nut in',
  'busted a nut',
  'bust a nut',
  'deez nuts',
  'deez nutz',
  'your mom',
  'ur mom',
  'yo mama',
  'joe mama',
  'shut up',
  'hate you',
  'i hate',
  'you suck',
  'this sucks',
  'kill yourself',
  'go die',
  'cut myself',
  'hang myself',
  'shoot up',
  'blow up',
  'smoke weed',
  'get high',
  'getting high',
  'so high',
  'get drunk',
  'getting drunk',
  'hot girl',
  'hot boy',
  'sexy girl',
  'sexy boy',
  'sugar daddy',
  'sugar baby',
  'sugar mommy',
  'good girl',
  'bad girl',
  'bad boy',
  'spank me',
  'choke me',
  'step bro',
  'step sis',
  'stepbrother',
  'stepsister',
  'what are you doing step',
  'ice wallow come',
  'mike hunt',
  'mike oxlong',
  'mike hawk',
  'ben dover',
  'jack mehOff',
  'seymour butts',
  'hugh jass',
  'ivana tinkle',
  'amanda hugginkiss',
  'anita bath',
  'pierre pants',
  'dixie normous',
  'barry mccockiner',
  'jenna tolls',
  'gabe itch',
  'wayne kerr',
  'phil mccracken',
  'pat mcgroin',
  'eileen ulick',
  'lou sassle',
  'knee grow',
  'nick gur',
  'nick ga',
  'sofa king',
  'alpha male',
  'sigma male',
];

function normalizeLeet(input: string): string {
  return input
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/\^/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/\|/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\+/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'g')
    .replace(/2/g, 'z');
}

function collapseRepeatedLetters(input: string): string {
  // Collapse 3+ identical consecutive letters to 1 or 2 so "fuuuuck" -> "fuck", "shiiiit" -> "shit"
  return input.replace(/([a-z])\1{2,}/g, '$1');
}

/**
 * Checks whether a string contains any profanity, slurs, or suggestive/inappropriate language.
 */
export function containsProfanity(rawText: string): boolean {
  if (!rawText || !rawText.trim()) return false;

  const lower = rawText.toLowerCase();

  // 1) Check direct numeric codes & raw tokens before leet conversion (so "69", "420" are caught)
  const rawTokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of rawTokens) {
    if (STRICT_TOKEN_WORDS.has(token)) {
      return true;
    }
  }

  // 2) Normalize leetspeak and punctuation
  const normalized = normalizeLeet(lower);
  const collapsed = collapseRepeatedLetters(normalized);

  // 3) Check multi-word phrases
  const cleanSpaceString = collapsed.replace(/[^a-z0-9]+/g, ' ').trim();
  for (const phrase of STRICT_PHRASES) {
    const normPhrase = normalizeLeet(phrase.toLowerCase());
    const regex = new RegExp(`\\b${normPhrase.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(cleanSpaceString) || regex.test(lower.replace(/[^a-z0-9]+/g, ' '))) {
      return true;
    }
  }

  // 4) Check token words on normalized & collapsed text
  const normTokens = cleanSpaceString.split(/\s+/).filter(Boolean);
  for (const token of normTokens) {
    if (STRICT_TOKEN_WORDS.has(token)) {
      return true;
    }
    const dedupToken = token.replace(/([a-z])\1+/g, '$1');
    if (dedupToken.length >= 3 && STRICT_TOKEN_WORDS.has(dedupToken)) {
      return true;
    }
  }

  // 5) Check asterisk/symbol censored swear patterns like f*ck, s**t, b*tch, a$$
  if (
    /\b[fph][*#_\-.!?@%$&]+[ck]{1,2}\b/i.test(lower) ||
    /\bs[*#_\-.!?@%$&]+[t]\b/i.test(lower) ||
    /\bb[*#_\-.!?@%$&]+tch\b/i.test(lower) ||
    /\bd[*#_\-.!?@%$&]+ck\b/i.test(lower) ||
    /\bc[*#_\-.!?@%$&]+nt\b/i.test(lower) ||
    /\bp[*#_\-.!?@%$&]+ssy\b/i.test(lower) ||
    /\bn[*#_\-.!?@%$&]+gg[aer]*\b/i.test(lower) ||
    /\ba\$\$+\b/i.test(lower)
  ) {
    return true;
  }

  // 6) Check strict substring roots inside each word (and across spaced-out single letters like "f u c k")
  for (const token of normTokens) {
    for (const root of STRICT_SUBSTRING_ROOTS) {
      if (token.includes(root)) {
        return true;
      }
    }
  }

  // Detect spaced-out single-letter evasion like "f u c k" or "s e x" or "p o r n"
  const singleLetterRuns = cleanSpaceString.replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1');
  const joinedSingleTokens = singleLetterRuns.split(/\s+/).filter(Boolean);
  for (const token of joinedSingleTokens) {
    if (STRICT_TOKEN_WORDS.has(token)) {
      return true;
    }
    for (const root of STRICT_SUBSTRING_ROOTS) {
      if (token.includes(root)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sanitizes a user-entered string. If it contains profanity or inappropriate content,
 * returns `{ isClean: false, value: fallback }` so the caller can reject the edit and warn the student.
 */
export function validateClassroomText(
  input: string,
  fallback: string = ''
): { isClean: boolean; value: string } {
  if (containsProfanity(input)) {
    return { isClean: false, value: fallback };
  }
  return { isClean: true, value: input };
}
