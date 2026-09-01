let continuousTimer: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

function playBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  void ctx.resume().then(() => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.12;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime;
    oscillator.start(start);
    oscillator.stop(start + 0.35);
  });
}

/** Repeating alarm when the meeting timer runs out, until both parties join the video call. */
export function startContinuousInterviewAlarm(): void {
  stopContinuousInterviewAlarm();
  playBeep();
  continuousTimer = window.setInterval(() => playBeep(), 1800);
}

export function stopContinuousInterviewAlarm(): void {
  if (continuousTimer !== null) {
    window.clearInterval(continuousTimer);
    continuousTimer = null;
  }
}
