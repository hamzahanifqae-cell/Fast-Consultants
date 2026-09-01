import { Vibration } from 'react-native';

let continuousTimer: ReturnType<typeof setInterval> | null = null;
let audioReady = false;

async function playBeep(): Promise<void> {
  try {
    // Lazy-load so missing native AV (Expo Go / web) does not crash app startup.
    const { Audio } = await import('expo-av');
    if (!audioReady) {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      audioReady = true;
    }
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/beep.wav'),
      { shouldPlay: true, volume: 1 },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    // Vibration still provides feedback if audio / native module is unavailable.
  }
}

/** Repeating alarm until both parties join the video call. */
export function startContinuousInterviewAlarm(): void {
  stopContinuousInterviewAlarm();
  void playBeep();
  Vibration.vibrate([0, 400, 200, 400], true);
  continuousTimer = setInterval(() => {
    void playBeep();
  }, 1800);
}

export function stopContinuousInterviewAlarm(): void {
  if (continuousTimer !== null) {
    clearInterval(continuousTimer);
    continuousTimer = null;
  }
  Vibration.cancel();
}
