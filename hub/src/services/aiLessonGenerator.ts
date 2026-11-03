import { GradeLevel, LessonPlan, ActivityStep } from '../types';
import { NYS_MUSIC_STANDARDS } from './nysStandards';

export interface GenerateLessonOptions {
  prompt: string;
  grade?: GradeLevel;
  durationMinutes?: number;
  apiKey?: string;
  provider?: 'builtin' | 'claude' | 'gemini';
  claudeApiKey?: string;
  geminiApiKey?: string;
}

export interface GeneratedLessonResult {
  title: string;
  grade: GradeLevel;
  unit: string;
  durationMinutes: number;
  overview: string;
  objectives: string[];
  musicalConcepts: string[];
  standards: string[];
  materialsNeeded: string[];
  activities: Omit<ActivityStep, 'id'>[];
  assessmentStrategy: string;
  differentiationNotes?: string;
}

// -------------------------------------------------------------
// 1. Built-in Pedagogical Music Education Generative Engine
// -------------------------------------------------------------
export function generatePedagogicalLesson(
  prompt: string,
  preferredGrade?: GradeLevel,
  preferredDuration?: number
): GeneratedLessonResult {
  const p = prompt.toLowerCase();

  // 1. Detect Grade
  let grade: GradeLevel = preferredGrade && preferredGrade !== 'All' ? preferredGrade : '3';
  if (!preferredGrade || preferredGrade === 'All') {
    if (p.includes('kindergarten') || p.match(/\bgrade k\b/) || p.match(/\bkinder\b/)) grade = 'K';
    else if (p.includes('1st') || p.includes('first grade') || p.match(/\bgrade 1\b/)) grade = '1';
    else if (p.includes('2nd') || p.includes('second grade') || p.match(/\bgrade 2\b/)) grade = '2';
    else if (p.includes('3rd') || p.includes('third grade') || p.match(/\bgrade 3\b/)) grade = '3';
    else if (p.includes('4th') || p.includes('fourth grade') || p.match(/\bgrade 4\b/)) grade = '4';
    else if (p.includes('5th') || p.includes('fifth grade') || p.match(/\bgrade 5\b/)) grade = '5';
    else if (p.includes('6th') || p.includes('sixth grade') || p.match(/\bgrade 6\b/)) grade = '6';
    else if (p.includes('chorus') || p.includes('choir') || p.includes('ensemble') || p.includes('rehearsal')) grade = 'Chorus';
  }

  // 2. Detect Target Duration (default 35 or preferred)
  let duration = preferredDuration || 35;
  const durationMatch = prompt.match(/(\d{1,3})\s*(?:min|minute|minutes|m\b)/i);
  if (durationMatch) {
    const parsed = parseInt(durationMatch[1], 10);
    if (parsed >= 15 && parsed <= 90) {
      duration = parsed;
    }
  }

  // 3. Detect Topics & Pedagogical Focus
  const isRhythm = p.includes('rhythm') || p.includes('beat') || p.includes('tempo') || p.includes('ta') || p.includes('ti-ti') || p.includes('syncopat') || p.includes('meter') || p.includes('ostinato');
  const isSolfege = p.includes('pitch') || p.includes('solfege') || p.includes('melody') || p.includes('high') || p.includes('low') || p.includes('do re mi') || p.includes('sing') || p.includes('vocal');
  const isRecorder = p.includes('recorder') || p.includes('bag') || p.includes('woodwind');
  const isBoomwhackers = p.includes('boomwhacker') || p.includes('boomwhackers') || p.includes('tubes') || p.includes('color');
  const isOrff = p.includes('orff') || p.includes('xylophone') || p.includes('metallophone') || p.includes('glockenspiel') || p.includes('mallet') || p.includes('bordun');
  const isMovement = p.includes('scarf') || p.includes('scarves') || p.includes('movement') || p.includes('dance') || p.includes('freeze') || p.includes('parachute');
  const isInstruments = p.includes('orchestra') || p.includes('carnival of the animals') || p.includes('peter and the wolf') || p.includes('families') || p.includes('timbre') || p.includes('instruments');
  const isChorus = grade === 'Chorus' || p.includes('chorus') || p.includes('harmony') || p.includes('2-part') || p.includes('two-part') || p.includes('round') || p.includes('canon');

  // Allocate step durations to sum exactly to target duration
  // E.g. for 35 min: [5, 8, 12, 6, 4]
  const dWarmup = Math.max(3, Math.round(duration * 0.14));
  const dHook = Math.max(5, Math.round(duration * 0.22));
  const dCoolDown = Math.max(3, Math.round(duration * 0.12));
  const dGame = Math.max(4, Math.round(duration * 0.18));
  const dMain = duration - (dWarmup + dHook + dCoolDown + dGame);

  let title = '';
  let unit = '';
  let overview = '';
  let objectives: string[] = [];
  let musicalConcepts: string[] = [];
  let materialsNeeded: string[] = [];
  let activities: Omit<ActivityStep, 'id'>[] = [];
  let assessmentStrategy = '';
  let differentiationNotes = '';

  if (isRecorder) {
    title = `Grade ${grade} Recorder Basics: Tone Production & BAG Fingerings`;
    unit = 'Instrument Literacy & Woodwind Technique';
    overview = `Focused recorder literacy workshop where students establish proper gentle breath control ("warm air"), left-hand-on-top finger positioning, and accurate articulation (tonguing "du") on notes B, A, and G.`;
    musicalConcepts = ['Tone Production', 'Articulation', 'Note Literacy (B-A-G)', 'Ensemble Blending'];
    objectives = [
      'Students will demonstrate correct left-hand-on-top finger placement with full tone-hole coverage.',
      'Students will articulate notes B, A, and G cleanly using gentle "du" tonguing without overblowing.',
      'Students will accurately sight-read and perform a 4-measure song in unison.'
    ];
    materialsNeeded = ['Soprano Recorders (1 per student)', 'Recorder Karate / BAG sheet music flashcards', 'Cleaning rods / sanitizing wipes', 'Smart Board visual fingering chart'];
    activities = [
      {
        title: 'Air Flow & Posture Preparation',
        durationMinutes: dWarmup,
        musicalConcept: 'Tone Production',
        description: 'Breathing warmup: "Whisper warm air onto your palm like steaming a mirror." Practice silent finger placement on the chin before blowing.'
      },
      {
        title: 'Echo Pitching & Tonguing Drill',
        durationMinutes: dHook,
        musicalConcept: 'Articulation',
        description: 'Call-and-response echo patterns on Note B and Note A. Teacher models clean "du-du-du" articulation; class responds in unison.'
      },
      {
        title: 'The BAG Literacy Challenge',
        durationMinutes: dMain,
        musicalConcept: 'Melodic Reading',
        description: 'Read and perform "Hot Cross Buns" or "Gently Sleep" from the interactive staff. Half the class plays while the other half tracks fingerings in the air, then switch.'
      },
      {
        title: 'Partner Belt Testing / Ensemble Game',
        durationMinutes: dGame,
        musicalConcept: 'Performance Technique',
        description: 'Partner practice: pairs take turns listening and coaching each other on squeak-free tone and left hand placement.'
      },
      {
        title: 'Clean-Up & Silent Exit Reflection',
        durationMinutes: dCoolDown,
        musicalConcept: 'Instrument Care',
        description: 'Swab recorders, pack cases, and review the golden rule: "Left hand on top, blow warm soft air."'
      }
    ];
    assessmentStrategy = 'Formative observation checklist of left-hand placement, no-leak tone hole seal, and clean articulation during partner play.';
    differentiationNotes = 'Place adhesive tactile dots on tone holes for students with fine motor challenges. Provide challenge extension with Note E or C for advanced students.';
  } else if (isBoomwhackers) {
    title = `Grade ${grade} Boomwhacker Harmonic Ostinatos & Color Score Reading`;
    unit = 'Harmonic Literacy & Ensemble Playing';
    overview = `Dynamic, full-ensemble lesson utilizing color-coded diatonic Boomwhackers to explore chord progressions, melodic contour, and rhythmic coordination without vocal fatigue.`;
    musicalConcepts = ['Harmonic Texture', 'Color-Coded Pitch Reading', 'Ensemble Timing', 'Ostinato'];
    objectives = [
      'Students will strike Boomwhackers against palm or thighs with proper rebound technique to produce a pure tone.',
      'Students will follow a scrolling color-coded score to perform their designated pitch on the correct beat.',
      'Students will maintain an independent rhythmic ostinato while another group performs the melody.'
    ];
    materialsNeeded = ['Diatonic Boomwhacker tubes (C4–C5 sets)', 'Octavator caps (optional)', 'Smart Board for scrolling visual score', 'Foam floor tiles / carpet spots'];
    activities = [
      {
        title: 'Physical Pulse & Tube Rebound Warmup',
        durationMinutes: dWarmup,
        musicalConcept: 'Tone Production',
        description: 'Students tap tubes gently against palm or thigh. Practice the "bounce-off" technique: do not dead-stick against the surface.'
      },
      {
        title: 'Color-Note Call and Echo',
        durationMinutes: dHook,
        musicalConcept: 'Pitch Recognition',
        description: 'Teacher points to red (C), yellow (E), or teal (G) on the smart board. The corresponding color section sounds their pitch in tempo.'
      },
      {
        title: 'Full Class Play-Along Song Score',
        durationMinutes: dMain,
        musicalConcept: 'Ensemble Performance',
        description: 'Perform a 3-part accompaniment (Bass C/G, Chords F/A, Melody) to an upbeat backing track. Rotate tubes among rows every round.'
      },
      {
        title: 'Improvisation & Rhythmic Jam',
        durationMinutes: dGame,
        musicalConcept: 'Creativity',
        description: 'Keep a steady 4/4 bass groove going. Individual students or pairs solo a 4-beat rhythm fill on the cue.'
      },
      {
        title: 'Silent Tube Rest & Exit Check',
        durationMinutes: dCoolDown,
        musicalConcept: 'Formative Assessment',
        description: 'Tubes placed in rest position between feet. Teacher tests pitch names: "Who holds the E tube? What color is it?"'
      }
    ];
    assessmentStrategy = 'Visual and auditory assessment: rhythmic precision on beat entries and respectful instrument care during transitions.';
    differentiationNotes = 'Pair students holding identical tubes to build rhythmic confidence. Provide Octavator caps for lower-octave reinforcement.';
  } else if (isOrff) {
    title = `Grade ${grade} Orff Schulwerk: Pentatonic Mallet Bordun & Speech Rhyme`;
    unit = 'Orff Schulwerk & Active Music Making';
    overview = `An elemental Orff experience combining spoken folk poetry, body percussion, and barred percussion instruments set in a C-Pentatonic tonality with an alternating bordun accompaniment.`;
    musicalConcepts = ['Pentatonic Scale', 'Bordun Accompaniment', 'Mallet Bounce Technique', 'Form (AB)'];
    objectives = [
      'Students will chant a 4-line speech rhyme with expressive dynamic contrast and clear diction.',
      'Students will perform an alternating octave/fifth bordun on Orff xylophones using relaxed bouncy mallets.',
      'Students will improvise a 4-beat pentatonic melodic response within the steady ensemble groove.'
    ];
    materialsNeeded = ['Soprano & Alto Xylophones (F and B bars removed for C-Pentatonic)', 'Metallophones / Glockenspiels', 'Yarn and felt mallets (1 pair per instrument)', 'Smart Board visual'];
    activities = [
      {
        title: 'Speech Rhyme & Body Percussion Transfer',
        durationMinutes: dWarmup,
        musicalConcept: 'Rhythm & Diction',
        description: 'Teach the rhyme by rote (e.g., "Engine, Engine Number Nine"). Transfer the steady beat to lap pats (bordun) and clapping the rhythm of the words.'
      },
      {
        title: 'Air Mallet Technique & Bar Setup',
        durationMinutes: dHook,
        musicalConcept: 'Instrument Technique',
        description: 'Demonstrate relaxed "bouncing ball" mallet motion. Ensure F and B bars are removed so any note combination harmonizes in pentatonic tonality.'
      },
      {
        title: 'Barred Instrument Ensemble Play',
        durationMinutes: dMain,
        musicalConcept: 'Harmonic Bordun',
        description: 'Basses play C and G bordun. Sopranos play melodic ostinato. Alto xylophones play speech rhythm. Half the class sings/chants while half plays, then rotate.'
      },
      {
        title: 'Pentatonic Question & Answer Improv',
        durationMinutes: dGame,
        musicalConcept: 'Improvisation',
        description: 'Teacher plays a 4-beat "Question" melody ending on G. A student volunteer answers with a 4-beat "Answer" ending on Home Do (C).'
      },
      {
        title: 'Mallet Rest & Cool-Down Reflection',
        durationMinutes: dCoolDown,
        musicalConcept: 'Closure',
        description: 'Mallets placed across instrument bars like railroad tracks. Review: "What notes did we take away to make our scale foolproof?"'
      }
    ];
    assessmentStrategy = 'Performance rubric evaluating mallet bounce (relaxed wrists) and maintaining the bordun pulse without speeding up.';
    differentiationNotes = 'Assign non-pitched percussion (hand drum, triangle) to students working on pulse before moving to barred instruments.';
  } else if (isChorus) {
    title = `6th Grade Chorus: 2-Part Balance, Breath Energy & Diction`;
    unit = 'Choral Artistry & Part Independence';
    overview = `Comprehensive rehearsal design targeting vocal warmups, resonance placement, breath management, clean consonants, and building independent part confidence on 2-part harmony.`;
    musicalConcepts = ['Vocal Tone', '2-Part Harmony', 'Diction & Consonants', 'Dynamic Balance'];
    objectives = [
      'Singers will align choral posture and execute low diaphragmatic breathing exercises.',
      'Singers will sing a 2-part round or partner song maintaining pitch independence against the other section.',
      'Singers will shape vowels uniformly (pure open vowels) and articulate crisp ending consonants.'
    ];
    materialsNeeded = ['Choral octavos / lyrics on smart board', 'Piano / Accompaniment track', 'Pitch pipe / Tuner', 'Pencils for score marking'];
    activities = [
      {
        title: 'Physical & Vocal Warmup Ritual',
        durationMinutes: dWarmup,
        musicalConcept: 'Vocal Health',
        description: 'Shoulder rolls, rib cage expansion, lip trills, sirening up to head voice, and vowel unification exercise ("Me-May-Mah-Mo-Moo").'
      },
      {
        title: 'Sight-Singing & Harmonic Interval Tuning',
        durationMinutes: dHook,
        musicalConcept: 'Ear Training',
        description: 'Sing a sustained unison pitch, then Part 2 splits upward to a major 3rd. Rehearse resolving vertical harmonies until chords ring clear.'
      },
      {
        title: 'Repertoire Drill: Difficult Transition Measures',
        durationMinutes: dMain,
        musicalConcept: 'Part Independence',
        description: 'Isolate measures 16–32. Part 1 speaks rhythm on neutral syllable while Part 2 sings their line, then combine both parts with piano support.'
      },
      {
        title: 'Expression & Balance Run-Through',
        durationMinutes: dGame,
        musicalConcept: 'Choral Artistry',
        description: 'Full run-through of the piece with dynamics and phrasing. Record 60 seconds on teacher phone or iPad and play back for self-evaluation.'
      },
      {
        title: 'Reflection & Pencil Score Marking',
        durationMinutes: dCoolDown,
        musicalConcept: 'Choral Literacy',
        description: 'Singers mark breath marks (apostrophe) and circle dynamic changes in their music before orderly departure.'
      }
    ];
    assessmentStrategy = 'Audio playback self-critique: singers evaluate balance between Part 1 and Part 2 and precision of cutoff consonants.';
    differentiationNotes = 'Place stronger independent pitch-matchers in the middle of each section to anchor neighboring singers.';
  } else if (isMovement || p.includes('scarf')) {
    title = `Grade ${grade} Movement & Scarf Play: Dynamics, Tempo & Contour`;
    unit = 'Expressive Movement & Dalcroze Eurhythmics';
    overview = `High-energy, imaginative movement exploration using colorful chiffon scarves to physically manifest high/low pitch, fast/slow tempo, and loud/quiet dynamic changes.`;
    musicalConcepts = ['Melodic Contour', 'Dynamic Contrast (Forte/Piano)', 'Tempo (Allegro/Adagio)', 'Movement Expression'];
    objectives = [
      'Students will physically mirror musical tempo changes using whole-body scarf movements.',
      'Students will toss and float scarves to demonstrate high melodic peaks and low descending resolutions.',
      'Students will freeze in an expressive statue instantly when music pauses.'
    ];
    materialsNeeded = ['Juggling / Chiffon Scarves (1 per student)', 'Bluetooth Speaker / Sound Studio', 'Camille Saint-Saëns "The Aquarium" or Brahms Hungarian Dance track', 'Smart Board visual timer'];
    activities = [
      {
        title: 'Personal Bubble & Space Exploration',
        durationMinutes: dWarmup,
        musicalConcept: 'Spatial Awareness',
        description: 'Establish safe movement rules: "Stay in your bubble." Practice walking to the beat of the hand drum without touching anyone.'
      },
      {
        title: 'Scarf Flight & High/Low Pitch Contour',
        durationMinutes: dHook,
        musicalConcept: 'Pitch Contour',
        description: 'Distribute scarves. When the music goes high (violins/flute), scarves reach for the clouds; when music goes low (cello/bass), scarves sweep the floor.'
      },
      {
        title: 'Saint-Saëns "The Aquarium" Listening & Floating',
        durationMinutes: dMain,
        musicalConcept: 'Expressive Responding',
        description: 'Active listening piece: Students glide like sea creatures through deep water. Every time the glass harmonica glissando sparkles, scarves toss upward.'
      },
      {
        title: 'The Freeze Dance & Tempo Accelerator',
        durationMinutes: dGame,
        musicalConcept: 'Tempo & Auditory Reaction',
        description: 'Drum beat moves from Adagio (slow glide) to Presto (rapid flutter). Teacher stops drumming abruptly—everyone freezes in a statuesque pose!'
      },
      {
        title: 'Scarf Origami & Calming Breath Cool-Down',
        durationMinutes: dCoolDown,
        musicalConcept: 'Self-Regulation',
        description: 'Fold scarves into neat small squares while taking 3 slow deep breaths matching a soft chime.'
      }
    ];
    assessmentStrategy = 'Observational assessment of student reaction speed to tempo shifts and ability to mirror musical mood physically.';
    differentiationNotes = 'Provide seated movement adaptations for students with mobility differences—arm extensions and scarf waves produce identical expressive benefit.';
  } else if (isInstruments) {
    title = `Grade ${grade} Instruments of the Orchestra: Timbre, Families & Storytelling`;
    unit = 'Instrument Timbre & Musical Storytelling';
    overview = `Engaging listening and timbre-identification lab exploring the four instrument families (Strings, Woodwinds, Brass, Percussion) through classic programmatic works like Peter & the Wolf or Carnival of the Animals.`;
    musicalConcepts = ['Timbre (Tone Color)', 'Instrument Families', 'Programmatic Music', 'Acoustic Vibrations'];
    objectives = [
      'Students will identify the four families of the orchestra and describe how each produces sound.',
      'Students will aurally distinguish string, woodwind, brass, and percussion timbres in musical excerpts.',
      'Students will match specific characters or animals to their corresponding instrument motifs.'
    ];
    materialsNeeded = ['Orchestra instrument flashcards / posters', 'Audio playback of Prokofiev\'s "Peter and the Wolf" or Saint-Saëns', 'Sample classroom instruments (violin, flute, trumpet mouthpiece, drum)'];
    activities = [
      {
        title: 'How Sound Is Made: The Vibration Mystery',
        durationMinutes: dWarmup,
        musicalConcept: 'Acoustics & Timbre',
        description: 'Feel vibrations: touch throat while humming. Demonstrate how vibrating strings, air columns, buzzing lips, and struck membranes make sound.'
      },
      {
        title: 'The 4 Family Corners Guided Tour',
        durationMinutes: dHook,
        musicalConcept: 'Instrument Families',
        description: 'Designate the 4 corners of the classroom as Strings, Woodwinds, Brass, and Percussion. Show photos and listen to a 15-second solo of each.'
      },
      {
        title: 'Peter and the Wolf Character Detective',
        durationMinutes: dMain,
        musicalConcept: 'Programmatic Listening',
        description: 'Play character themes: Bird (flute), Duck (oboe), Cat (clarinet), Grandfather (bassoon), Wolf (horns). Students raise the matching character card.'
      },
      {
        title: 'Orchestra Four-Corners Listening Game',
        durationMinutes: dGame,
        musicalConcept: 'Aural Identification',
        description: 'Play a mystery excerpt. Students silently walk to the family corner they believe is performing the primary melody.'
      },
      {
        title: 'Wrap-Up Timbre Check',
        durationMinutes: dCoolDown,
        musicalConcept: 'Review & Closure',
        description: 'Quick exit question: "Which family uses horsehair bows? Which family buzzes lips into a cup mouthpiece?"'
      }
    ];
    assessmentStrategy = 'Formative check during the 4-corners game: percentage of class correctly classifying instruments by family.';
    differentiationNotes = 'Provide tactile instruments (letting students hold a real violin or feel the vibration of a bass drum) to solidify acoustic concepts.';
  } else if (isSolfege || p.includes('sing') || p.includes('do re mi')) {
    title = `Grade ${grade} Solfege & Melodic Contour: Curwen Hand Signs & Pentatonic Reading`;
    unit = 'Melodic Literacy & Solfege Singing';
    overview = `A Kodály-inspired melodic literacy workshop building pure singing tone, pitch matching, and connecting Curwen hand signs (Do-Re-Mi-Sol-La) to visual staff notation.`;
    musicalConcepts = ['Solfege (Do-Re-Mi)', 'Curwen Hand Signs', 'Pitch Matching', 'Melodic Contour'];
    objectives = [
      'Students will sing in head voice matching pitches on Sol, Mi, and La with accurate intonation.',
      'Students will display the proper Curwen hand sign for each pitch while singing.',
      'Students will read a 3-note melodic pattern on a 2-line or 5-line staff and sing it in pitch.'
    ];
    materialsNeeded = ['Curwen hand signs chart', 'Pitch pipe or classroom keyboard', 'Melodic flashcards with solfege syllables', 'Smart Board visual staff'];
    activities = [
      {
        title: 'Head Voice Vocal Siren & Warmup',
        durationMinutes: dWarmup,
        musicalConcept: 'Vocal Placement',
        description: 'Follow the vocal roller coaster: students siren on "ooh" with hand tracing highs and lows in the air to engage light head voice.'
      },
      {
        title: 'Curwen Sign Echo & Tone Ladder',
        durationMinutes: dHook,
        musicalConcept: 'Curwen Hand Signs',
        description: 'Teacher models Sol (horizontal palm), Mi (flat palm facing down), La (curved tent). Students echo pitch and physical sign simultaneously.'
      },
      {
        title: 'Mystery Song Decoding from the Staff',
        durationMinutes: dMain,
        musicalConcept: 'Melodic Reading',
        description: 'Present a 4-measure song (e.g. "Bounce High, Bounce Low" or "Lucy Locket"). Class reads solfege syllables, sings in inner hearing, then sings aloud.'
      },
      {
        title: 'Singing Circle & Elimination Game',
        durationMinutes: dGame,
        musicalConcept: 'Solo/Small Group Singing',
        description: 'Singing game: "Who has the Sol-Mi ball?" The student holding the beanbag sings their solo response using beautiful head tone.'
      },
      {
        title: 'Silent Hand Sign Exit Check',
        durationMinutes: dCoolDown,
        musicalConcept: 'Formative Check',
        description: 'Teacher shows a hand sign without singing. Students whisper the pitch name and sing the pitch before lining up.'
      }
    ];
    assessmentStrategy = 'Individual assessment of head voice pitch accuracy and correct Curwen sign shape during the singing circle.';
    differentiationNotes = 'Anchor pitch matching by having students place hands on chest and bridge of nose to feel vocal resonance.';
  } else {
    // Default / Rhythm / General
    title = `Grade ${grade} Rhythm Literacy: Ostinatos & Syncopated Patterns`;
    unit = 'Rhythm Literacy & Beat Mastery';
    overview = `High-engagement rhythm literacy class connecting physical body percussion, Kodály rhythm syllables (Ta, Ti-Ti, Rest, Syncopa), and collaborative group ostinatos.`;
    musicalConcepts = ['Steady Beat vs. Rhythm', 'Kodály Syllables (Ta, Ti-Ti)', 'Syncopation', 'Polyrhythm Ostinatos'];
    objectives = [
      'Students will differentiate between a steady macro-beat and subdivided rhythmic word patterns.',
      'Students will read, speak, and clap 4-beat rhythm flashcards with 100% accuracy in tempo.',
      'Students will perform a multi-layer classroom ostinato without losing the collective pulse.'
    ];
    materialsNeeded = ['Rhythm flashcards / train visualizer', 'Rhythm sticks or unpitched percussion (1 pair per student)', 'Smart Board metronome display'];
    activities = [
      {
        title: 'Follow-The-Leader Pulse Warmup',
        durationMinutes: dWarmup,
        musicalConcept: 'Steady Beat',
        description: 'Physical pulse warmup: Stomp on 1 and 3, chest tap on 2 and 4, pat knees on continuous eighth notes. Teacher varies tempo smoothly.'
      },
      {
        title: 'Kodály Flashcard Echo & Reading',
        durationMinutes: dHook,
        musicalConcept: 'Rhythm Syllables',
        description: 'Flash 4-beat cards: Ta, Ti-Ti, Half Note, Quarter Rest. Class speaks rhythm syllables first, then claps without speaking ("inner hearing").'
      },
      {
        title: '3-Layer Class Ostinato Groove',
        durationMinutes: dMain,
        musicalConcept: 'Ensemble Polyrhythm',
        description: 'Divide class into 3 teams: Team 1 plays steady beat on rhythm sticks; Team 2 claps syncopated pattern; Team 3 pats sixteenth notes. Rotate parts.'
      },
      {
        title: 'Poison Pattern Elimination Game',
        durationMinutes: dGame,
        musicalConcept: 'Ear Training & Focus',
        description: 'Establish the "Poison Pattern" (e.g., Ti-Ti Ta Ti-Ti Ta). Teacher claps various patterns for class to echo; if teacher claps poison, class must stay silent!'
      },
      {
        title: 'Rhythm Exit Ticket',
        durationMinutes: dCoolDown,
        musicalConcept: 'Formative Assessment',
        description: 'Each student claps a 2-beat flashcard as their "ticket" out the door.'
      }
    ];
    assessmentStrategy = 'Call-and-response accuracy check during the poison rhythm game, plus observational check of ostinato balance.';
    differentiationNotes = 'Allow students who struggle with syncopation to maintain the foundational macro-beat on a bass resonator or floor stomp.';
  }

  // 4. Select Authentic NYS Music Standards matching grade and strand
  const standardsForGrade = NYS_MUSIC_STANDARDS.filter(
    (s) => s.grade === grade || (s.grade === 'K' && grade === 'K') || s.grade === 'General'
  );
  const pickedStandards = standardsForGrade.slice(0, 3).map((s) => s.code);
  if (pickedStandards.length === 0) {
    pickedStandards.push(`MU:Cr1.1.${grade === 'Chorus' ? '6' : grade}`, `MU:Pr4.2.${grade === 'Chorus' ? '6' : grade}`);
  }

  return {
    title,
    grade,
    unit,
    durationMinutes: duration,
    overview,
    objectives,
    musicalConcepts,
    standards: pickedStandards,
    materialsNeeded,
    activities,
    assessmentStrategy,
    differentiationNotes
  };
}

// -------------------------------------------------------------
// 2. Live Google Gemini API Integration
// -------------------------------------------------------------
export async function generateGeminiLesson(
  prompt: string,
  apiKey: string,
  preferredGrade?: GradeLevel,
  preferredDuration?: number
): Promise<GeneratedLessonResult> {
  const systemInstruction = `You are an expert Master Elementary General Music Educator (K-6) and Choral Director.
Create an authentic, practical, standards-aligned music lesson plan based on the user's prompt.
The lesson plan must be detailed, age-appropriate, musically sound (Kodály, Orff, Dalcroze), and ready to teach from a rolling music cart or classroom.
Ensure activity step durations sum EXACTLY to the specified durationMinutes.
Respond ONLY with a valid JSON object matching this schema:
{
  "title": "string",
  "grade": "K" | "1" | "2" | "3" | "4" | "5" | "6" | "Chorus",
  "unit": "string",
  "durationMinutes": number,
  "overview": "string",
  "objectives": ["string", "string"],
  "musicalConcepts": ["string", "string"],
  "standards": ["MU:Cr1.1.X", "MU:Pr4.2.X", "MU:Re7.2.X"],
  "materialsNeeded": ["string"],
  "activities": [
    {
      "title": "string",
      "durationMinutes": number,
      "musicalConcept": "string",
      "description": "string"
    }
  ],
  "assessmentStrategy": "string",
  "differentiationNotes": "string"
}`;

  const userQuery = `Prompt: "${prompt}"
${preferredGrade && preferredGrade !== 'All' ? `Target Grade: Grade ${preferredGrade}` : ''}
${preferredDuration ? `Target Duration: ${preferredDuration} minutes` : ''}

Generate the complete JSON elementary music lesson plan now.`;

  // Use Gemini 2.0 Flash or 1.5 Flash
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\n${userQuery}` }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawContent) {
    throw new Error('Gemini API returned an empty response.');
  }

  // Parse JSON
  let cleaned = rawContent.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();

  const parsed = JSON.parse(cleaned);

  // Validate critical fields
  const validGrades: GradeLevel[] = ['K', '1', '2', '3', '4', '5', '6', 'Chorus'];
  const grade: GradeLevel = validGrades.includes(parsed.grade) ? parsed.grade : preferredGrade || '3';
  const durationMinutes: number = typeof parsed.durationMinutes === 'number' && parsed.durationMinutes > 0 ? parsed.durationMinutes : preferredDuration || 35;

  return {
    title: parsed.title || 'Elementary Music Lesson',
    grade,
    unit: parsed.unit || 'General Music Curriculum',
    durationMinutes,
    overview: parsed.overview || prompt,
    objectives: Array.isArray(parsed.objectives) ? parsed.objectives : ['Perform rhythms with accurate steady pulse.'],
    musicalConcepts: Array.isArray(parsed.musicalConcepts) ? parsed.musicalConcepts : ['Beat', 'Rhythm'],
    standards: Array.isArray(parsed.standards) ? parsed.standards : [`MU:Pr4.2.${grade === 'Chorus' ? '6' : grade}`],
    materialsNeeded: Array.isArray(parsed.materialsNeeded) ? parsed.materialsNeeded : ['Smart Board', 'Percussion Instruments'],
    activities: Array.isArray(parsed.activities)
      ? parsed.activities.map((a: any) => ({
          title: a.title || 'Musical Activity',
          durationMinutes: typeof a.durationMinutes === 'number' ? a.durationMinutes : 5,
          musicalConcept: a.musicalConcept || 'Music Making',
          description: a.description || ''
        }))
      : [
          {
            title: 'Warmup',
            durationMinutes: 5,
            musicalConcept: 'Preparation',
            description: 'Vocal and physical warmup.'
          }
        ],
    assessmentStrategy: parsed.assessmentStrategy || 'Formative observation during ensemble play.',
    differentiationNotes: parsed.differentiationNotes || 'Provide visual cues and peer support.'
  };
}

// -------------------------------------------------------------
// 3. Live Anthropic Claude API Integration
// -------------------------------------------------------------
export async function generateClaudeLesson(
  prompt: string,
  apiKey: string,
  preferredGrade?: GradeLevel,
  preferredDuration?: number
): Promise<GeneratedLessonResult> {
  const systemInstruction = `You are an expert Master Elementary General Music Educator (K-6) and Choral Director with deep pedagogical expertise in Kodály, Orff-Schulwerk, Dalcroze, and Feierabend First Steps in Music.
Create an authentic, practical, standards-aligned music lesson plan based on the user's prompt.
The lesson plan must be detailed, age-appropriate, musically sound, and ready to teach from a rolling music cart or classroom.
Ensure activity step durations sum EXACTLY to the specified durationMinutes.
Respond ONLY with a valid JSON object matching this schema (do NOT include markdown code fences or conversational text):
{
  "title": "string",
  "grade": "K" | "1" | "2" | "3" | "4" | "5" | "6" | "Chorus",
  "unit": "string",
  "durationMinutes": number,
  "overview": "string",
  "objectives": ["string", "string"],
  "musicalConcepts": ["string", "string"],
  "standards": ["MU:Cr1.1.X", "MU:Pr4.2.X", "MU:Re7.2.X"],
  "materialsNeeded": ["string"],
  "activities": [
    {
      "title": "string",
      "durationMinutes": number,
      "musicalConcept": "string",
      "description": "string"
    }
  ],
  "assessmentStrategy": "string",
  "differentiationNotes": "string"
}`;

  const userQuery = `Prompt: "${prompt}"
${preferredGrade && preferredGrade !== 'All' ? `Target Grade: Grade ${preferredGrade}` : ''}
${preferredDuration ? `Target Duration: ${preferredDuration} minutes` : ''}

Generate the complete JSON elementary music lesson plan now. Return ONLY valid JSON.`;

  let responseText = '';
  let lastError = '';

  // 1. Try Direct Anthropic Messages API (with direct browser access header)
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 2500,
        system: systemInstruction,
        messages: [{ role: 'user', content: userQuery }]
      })
    });

    if (response.ok) {
      const json = await response.json();
      responseText = json?.content?.[0]?.text || '';
    } else {
      const err = await response.text();
      lastError = `Claude API error (${response.status}): ${err}`;
    }
  } catch (err: any) {
    lastError = err?.message || String(err);
  }

  // 2. Fall back to the site's Claude helper (/api/hub/claude)
  if (!responseText) {
    try {
      const proxyRes = await fetch('/api/hub/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim()
        },
        body: JSON.stringify({
          model: 'claude-haiku-5-5',
          max_tokens: 2500,
          system: systemInstruction,
          messages: [{ role: 'user', content: userQuery }]
        })
      });
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        responseText = json?.content?.[0]?.text || '';
      }
    } catch {}
  }

  if (!responseText) {
    throw new Error(lastError || 'Failed to connect to Claude API. Please check your Anthropic API key.');
  }

  // Parse JSON
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();

  const parsed = JSON.parse(cleaned);

  // Validate critical fields
  const validGrades: GradeLevel[] = ['K', '1', '2', '3', '4', '5', '6', 'Chorus'];
  const grade: GradeLevel = validGrades.includes(parsed.grade) ? parsed.grade : preferredGrade || '3';
  const durationMinutes: number = typeof parsed.durationMinutes === 'number' && parsed.durationMinutes > 0 ? parsed.durationMinutes : preferredDuration || 35;

  return {
    title: parsed.title || 'Elementary Music Lesson',
    grade,
    unit: parsed.unit || 'General Music Curriculum',
    durationMinutes,
    overview: parsed.overview || prompt,
    objectives: Array.isArray(parsed.objectives) ? parsed.objectives : ['Perform rhythms with accurate steady pulse.'],
    musicalConcepts: Array.isArray(parsed.musicalConcepts) ? parsed.musicalConcepts : ['Beat', 'Rhythm'],
    standards: Array.isArray(parsed.standards) ? parsed.standards : [`MU:Pr4.2.${grade === 'Chorus' ? '6' : grade}`],
    materialsNeeded: Array.isArray(parsed.materialsNeeded) ? parsed.materialsNeeded : ['Smart Board', 'Percussion Instruments'],
    activities: Array.isArray(parsed.activities)
      ? parsed.activities.map((a: any) => ({
          title: a.title || 'Musical Activity',
          durationMinutes: typeof a.durationMinutes === 'number' ? a.durationMinutes : 5,
          musicalConcept: a.musicalConcept || 'Music Making',
          description: a.description || ''
        }))
      : [
          {
            title: 'Warmup',
            durationMinutes: 5,
            musicalConcept: 'Preparation',
            description: 'Vocal and physical warmup.'
          }
        ],
    assessmentStrategy: parsed.assessmentStrategy || 'Formative observation during ensemble play.',
    differentiationNotes: parsed.differentiationNotes || 'Provide visual cues and peer support.'
  };
}

// -------------------------------------------------------------
// 4. Unified Lesson Generator Router
// -------------------------------------------------------------
export async function generateLessonPlan(options: GenerateLessonOptions): Promise<GeneratedLessonResult> {
  const provider = options.provider || (options.claudeApiKey ? 'claude' : options.geminiApiKey || options.apiKey ? 'gemini' : 'builtin');

  if (provider === 'claude' && (options.claudeApiKey || options.apiKey)) {
    return generateClaudeLesson(
      options.prompt,
      options.claudeApiKey || options.apiKey!,
      options.grade,
      options.durationMinutes
    );
  }

  if (provider === 'gemini' && (options.geminiApiKey || options.apiKey)) {
    return generateGeminiLesson(
      options.prompt,
      options.geminiApiKey || options.apiKey!,
      options.grade,
      options.durationMinutes
    );
  }

  // Fallback to Instant Built-in Pedagogical Music Engine
  return Promise.resolve(generatePedagogicalLesson(options.prompt, options.grade, options.durationMinutes));
}
