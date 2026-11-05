// Authentic New York State Arts Learning Standards for Music (K-6)

export interface NYSStandard {
  code: string;
  discipline: 'Music';
  strand: 'Creating' | 'Performing' | 'Responding' | 'Connecting';
  grade: 'K' | '1' | '2' | '3' | '4' | '5' | '6' | 'General';
  anchor: string;
  description: string;
}

export const NYS_MUSIC_STANDARDS: NYSStandard[] = [
  // --- CREATING ---
  {
    code: 'MU:Cr1.1.K',
    discipline: 'Music',
    strand: 'Creating',
    grade: 'K',
    anchor: 'Anchor Standard 1: Generate and conceptualize artistic ideas and work',
    description: 'With guidance, explore and experience music concepts (such as beat and melodic contour) through movement and playful vocalization.'
  },
  {
    code: 'MU:Cr1.1.1',
    discipline: 'Music',
    strand: 'Creating',
    grade: '1',
    anchor: 'Anchor Standard 1: Generate and conceptualize artistic ideas and work',
    description: 'With limited guidance, create musical ideas (such as answering a musical question) for a specific purpose.'
  },
  {
    code: 'MU:Cr1.1.2',
    discipline: 'Music',
    strand: 'Creating',
    grade: '2',
    anchor: 'Anchor Standard 1: Generate and conceptualize artistic ideas and work',
    description: 'Improvise rhythmic and melodic patterns and musical ideas for a specific purpose.'
  },
  {
    code: 'MU:Cr1.1.3',
    discipline: 'Music',
    strand: 'Creating',
    grade: '3',
    anchor: 'Anchor Standard 1: Generate and conceptualize artistic ideas and work',
    description: 'Generate musical ideas (such as rhythms and melodic phrases) within a given tonality and/or meter.'
  },
  {
    code: 'MU:Cr1.1.4',
    discipline: 'Music',
    strand: 'Creating',
    grade: '4',
    anchor: 'Anchor Standard 1: Generate and conceptualize artistic ideas and work',
    description: 'Improvise rhythmic, melodic, and harmonic ideas, and explain connection to specific purpose or context (such as social, cultural, or historical).'
  },
  {
    code: 'MU:Cr1.1.5',
    discipline: 'Music',
    strand: 'Creating',
    grade: '5',
    anchor: 'Anchor Standard 1: Generate and conceptualize artistic ideas and work',
    description: 'Generate musical ideas (such as rhythmic, melodic, and accompaniment patterns) within specified tonalities and meters.'
  },
  {
    code: 'MU:Cr1.1.6',
    discipline: 'Music',
    strand: 'Creating',
    grade: '6',
    anchor: 'Anchor Standard 1: Generate and conceptualize artistic ideas and work',
    description: 'Generate simple rhythmic, melodic, and harmonic phrases within AB or ABA musical forms.'
  },
  {
    code: 'MU:Cr2.1.2',
    discipline: 'Music',
    strand: 'Creating',
    grade: '2',
    anchor: 'Anchor Standard 2: Organize and develop artistic ideas and work',
    description: 'Demonstrate and discuss personal reasons for selecting patterns and ideas for musical arrangements.'
  },
  {
    code: 'MU:Cr2.1.4',
    discipline: 'Music',
    strand: 'Creating',
    grade: '4',
    anchor: 'Anchor Standard 2: Organize and develop artistic ideas and work',
    description: 'Demonstrate selected and organized musical ideas through standard or non-standard notation, performance, or audio recording.'
  },
  {
    code: 'MU:Cr2.1.6',
    discipline: 'Music',
    strand: 'Creating',
    grade: '6',
    anchor: 'Anchor Standard 2: Organize and develop artistic ideas and work',
    description: 'Select, organize, and document personal musical ideas using standard notation or audio recording.'
  },

  // --- PERFORMING ---
  {
    code: 'MU:Pr4.1.K',
    discipline: 'Music',
    strand: 'Performing',
    grade: 'K',
    anchor: 'Anchor Standard 4: Select, analyze, and interpret artistic work for presentation',
    description: 'With guidance, demonstrate steady beat and perform simple songs and chants with head voice.'
  },
  {
    code: 'MU:Pr4.2.1',
    discipline: 'Music',
    strand: 'Performing',
    grade: '1',
    anchor: 'Anchor Standard 4: Select, analyze, and interpret artistic work for presentation',
    description: 'With guidance, read and perform rhythm patterns using iconic or standard notation (quarter notes, paired eighths, quarter rest).'
  },
  {
    code: 'MU:Pr4.2.2',
    discipline: 'Music',
    strand: 'Performing',
    grade: '2',
    anchor: 'Anchor Standard 4: Select, analyze, and interpret artistic work for presentation',
    description: 'Read and perform rhythmic and melodic patterns using standard notation (so-mi-la solfege, half notes).'
  },
  {
    code: 'MU:Pr4.2.3',
    discipline: 'Music',
    strand: 'Performing',
    grade: '3',
    anchor: 'Anchor Standard 4: Select, analyze, and interpret artistic work for presentation',
    description: 'Read and perform rhythmic and melodic patterns in treble clef staff notation using solfege or absolute letter names.'
  },
  {
    code: 'MU:Pr4.2.4',
    discipline: 'Music',
    strand: 'Performing',
    grade: '4',
    anchor: 'Anchor Standard 4: Select, analyze, and interpret artistic work for presentation',
    description: 'Demonstrate understanding of the structure and the elements of music (such as rhythm, pitch, form, and harmony) in music selected for performance (e.g. recorder, Orff).'
  },
  {
    code: 'MU:Pr4.2.5',
    discipline: 'Music',
    strand: 'Performing',
    grade: '5',
    anchor: 'Anchor Standard 4: Select, analyze, and interpret artistic work for presentation',
    description: 'Demonstrate how the elements of music and expressive qualities (such as dynamics, tempo, articulation, and phrasing) are used in singers/players performances.'
  },
  {
    code: 'MU:Pr4.2.6',
    discipline: 'Music',
    strand: 'Performing',
    grade: '6',
    anchor: 'Anchor Standard 4: Select, analyze, and interpret artistic work for presentation',
    description: 'Read and perform standard notation in 2-part chorus literature, demonstrating vocal balance, blend, accurate intonation, and posture.'
  },
  {
    code: 'MU:Pr6.1.4',
    discipline: 'Music',
    strand: 'Performing',
    grade: '4',
    anchor: 'Anchor Standard 6: Convey meaning through the presentation of artistic work',
    description: 'Perform music, alone or with others, with expression and technical accuracy, and appropriate etiquette for the audience and context.'
  },
  {
    code: 'MU:Pr6.1.6',
    discipline: 'Music',
    strand: 'Performing',
    grade: '6',
    anchor: 'Anchor Standard 6: Convey meaning through the presentation of artistic work',
    description: 'Perform chorus repertoire with technical accuracy and stylistic expression in a school concert setting.'
  },

  // --- RESPONDING ---
  {
    code: 'MU:Re7.1.K',
    discipline: 'Music',
    strand: 'Responding',
    grade: 'K',
    anchor: 'Anchor Standard 7: Perceive and analyze artistic work',
    description: 'With guidance, list personal interests and identify contrast in music (such as fast/slow, loud/soft, high/low).'
  },
  {
    code: 'MU:Re7.2.2',
    discipline: 'Music',
    strand: 'Responding',
    grade: '2',
    anchor: 'Anchor Standard 7: Perceive and analyze artistic work',
    description: 'Describe how specific music concepts (such as dynamics, tempo, timbre) are used to support a purpose.'
  },
  {
    code: 'MU:Re7.2.4',
    discipline: 'Music',
    strand: 'Responding',
    grade: '4',
    anchor: 'Anchor Standard 7: Perceive and analyze artistic work',
    description: 'Demonstrate and explain how expressive qualities (such as dynamics, tempo, and timbre) are used in performers and composers selections.'
  },
  {
    code: 'MU:Re7.2.6',
    discipline: 'Music',
    strand: 'Responding',
    grade: '6',
    anchor: 'Anchor Standard 7: Perceive and analyze artistic work',
    description: 'Classify instrument families and analyze how compositional choices (meter, key, texture) support musical meaning.'
  },

  // --- CONNECTING ---
  {
    code: 'MU:Cn10.1.3',
    discipline: 'Music',
    strand: 'Connecting',
    grade: '3',
    anchor: 'Anchor Standard 10: Synthesize and relate knowledge and personal experiences to make art',
    description: 'Demonstrate how personal interests and knowledge relate to choices made when creating, performing, and responding to music.'
  },
  {
    code: 'MU:Cn11.1.5',
    discipline: 'Music',
    strand: 'Connecting',
    grade: '5',
    anchor: 'Anchor Standard 11: Relate artistic ideas and works with societal, cultural, and historical context',
    description: 'Demonstrate understanding of relationships between music and the other arts, other disciplines, varied contexts, and daily life.'
  },
  {
    code: 'MU:Cn11.1.6',
    discipline: 'Music',
    strand: 'Connecting',
    grade: '6',
    anchor: 'Anchor Standard 11: Relate artistic ideas and works with societal, cultural, and historical context',
    description: 'Explain the historical, social, and cultural context of chorus and general music selections.'
  }
];
