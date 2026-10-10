/**
 * New-order ringtone: loops assets/sounds/ringtone.mp3 (plays even with the
 * iPhone ring switch on silent) and pulses haptics until stopped. Replaces
 * the no-op stub left after the SDK 56 migration, when offers arrived
 * silently.
 */
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";

let player: AudioPlayer | null = null;
let hapticTimer: ReturnType<typeof setInterval> | null = null;
let ringtoneActive = false;
let audioModeSet = false;

const ensurePlayer = async () => {
  if (!audioModeSet) {
    audioModeSet = true;
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
    } catch (error) {
      console.log("[Ringtone] audio mode not set", error);
    }
  }
  if (!player) {
    player = createAudioPlayer(require("@/assets/sounds/ringtone.mp3"));
    player.loop = true;
    player.volume = 1;
  }
  return player;
};

export const playRingtone = async () => {
  if (ringtoneActive) return;
  ringtoneActive = true;
  try {
    const p = await ensurePlayer();
    p.seekTo(0);
    p.play();
  } catch (error) {
    console.log("[Ringtone] playback failed", error);
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  hapticTimer = setInterval(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  }, 1200);
};

export const stopRingtone = async () => {
  ringtoneActive = false;
  if (hapticTimer) {
    clearInterval(hapticTimer);
    hapticTimer = null;
  }
  try {
    player?.pause();
    player?.seekTo(0);
  } catch {
    // Player may already be released; nothing to stop.
  }
};

export const isRingtonePlaying = () => ringtoneActive;
