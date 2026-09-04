import { Vibration } from 'react-native';

let continuousTimer: ReturnType<typeof setInterval> | null = null;

/** Repeating vibration alarm until both parties join the video call. */
export function startContinuousInterviewAlarm(): void {
  stopContinuousInterviewAlarm();
  Vibration.vibrate([0, 400, 200, 400], true);
  continuousTimer = setInterval(() => {
    Vibration.vibrate([0, 400, 200, 400]);
  }, 1800);
}

export function stopContinuousInterviewAlarm(): void {
  if (continuousTimer !== null) {
    clearInterval(continuousTimer);
    continuousTimer = null;
  }
  Vibration.cancel();
}
