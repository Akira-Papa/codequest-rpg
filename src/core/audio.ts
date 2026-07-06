/** ファミコン風の効果音をWeb Audio APIで合成する(音声ファイル不使用) */

let ctx: AudioContext | null = null;

/** 初回ユーザー操作時に呼ぶ(ブラウザの自動再生制限対応) */
export function initAudio(): void {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  startDelay = 0,
  volume = 0.12,
  slideTo?: number
): void {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + startDelay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
  }
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.01);
}

let noiseBuffer: AudioBuffer | null = null;

function noise(duration: number, volume = 0.1, startDelay = 0): void {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + startDelay;
  // ノイズバッファは1回だけ生成して使い回す(最大1秒分)
  if (!noiseBuffer) {
    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  const buffer = noiseBuffer;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(gain).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.01);
}

export const sfx = {
  /** カーソル移動: ピッ */
  cursor(): void {
    tone(880, 0.05, 'square', 0, 0.06);
  },
  /** 決定: ピコッ */
  confirm(): void {
    tone(660, 0.06, 'square', 0, 0.08);
    tone(990, 0.08, 'square', 0.06, 0.08);
  },
  /** 攻撃ヒット: ザシュッ */
  hit(): void {
    noise(0.15, 0.12);
    tone(400, 0.15, 'square', 0, 0.1, 80);
  },
  /** 正解: ピロリン */
  correct(): void {
    tone(784, 0.08, 'square', 0, 0.1);
    tone(1175, 0.14, 'square', 0.08, 0.1);
  },
  /** 不正解: ブブー */
  wrong(): void {
    tone(220, 0.18, 'triangle', 0, 0.14, 130);
    tone(180, 0.22, 'triangle', 0.16, 0.14, 100);
  },
  /** レベルアップ: ファンファーレ風アルペジオ */
  levelup(): void {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => tone(f, 0.12, 'square', i * 0.09, 0.1));
    tone(1319, 0.4, 'square', seq.length * 0.09, 0.1);
  },
  /** ボス撃破ファンファーレ */
  fanfare(): void {
    const seq = [392, 392, 392, 523, 659, 784];
    seq.forEach((f, i) => tone(f, 0.14, 'square', i * 0.12, 0.11));
    tone(1047, 0.5, 'square', seq.length * 0.12, 0.11);
  },
  /** エンカウント: デデン */
  encounter(): void {
    tone(196, 0.12, 'square', 0, 0.12);
    tone(147, 0.25, 'square', 0.12, 0.12);
  },
  /** 回復: キラリン */
  heal(): void {
    tone(1047, 0.07, 'triangle', 0, 0.1);
    tone(1319, 0.07, 'triangle', 0.07, 0.1);
    tone(1568, 0.15, 'triangle', 0.14, 0.1);
  },
};
