"use client";

// Мягкий звук «бульк» при новом сообщении (WebAudio — без аудиофайлов) + лёгкая вибрация.
// Браузер разрешает звук только после первого взаимодействия — «разблокируем» контекст по клику.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

// Вызвать на первом пользовательском клике (resume — тихо, без звука).
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

// Приятный двухнотный «бульк»: короткая синус-нота вверх с плавным затуханием.
export function playPing() {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const t = c.currentTime;
  const gain = c.createGain();
  gain.connect(c.destination);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.exponentialRampToValueAtTime(990, t + 0.16);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + 0.5);
}

// Лёгкая вибрация на мобильных (тихо игнорируется, где не поддерживается).
export function vibrate() {
  try {
    navigator.vibrate?.(35);
  } catch { /* ignore */ }
}
