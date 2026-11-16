import confetti from 'canvas-confetti';

/**
 * canvas-confetti with the "reduced motion" preference honoured (audit WP-6.6): a student whose device asks for
 * less motion sees no confetti. Same call shape as the library's own function.
 */
export default function celebrate(options?: confetti.Options) {
  return confetti({ disableForReducedMotion: true, ...options });
}
