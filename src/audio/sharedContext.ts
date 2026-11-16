// One shared AudioContext for the classroom tools (toolbox, tuner), created on first use.

let audioCtx: AudioContext | null = null;

export async function getToolboxAudioContext(): Promise<AudioContext | null> {
  if (!audioCtx) {
    try {
      const winAudio = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (winAudio) {
        audioCtx = new winAudio();
      }
    } catch {
      // AudioContext unavailable
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      // resume failed or waiting for user interaction
    }
  }
  return audioCtx;
}
