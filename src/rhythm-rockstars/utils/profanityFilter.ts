/**
 * Global Classroom Profanity Filter (Unified)
 * Re-exports the master profanity filter from src/utils/profanityFilter
 */
export {
  containsProfanity,
  cleanProfanity,
  validateClassroomText,
  containsInappropriateLanguage,
  PROFANITY_WARNING_MESSAGE,
} from '../../utils/profanityFilter';
