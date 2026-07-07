/**
 * 画面全体の空気感エフェクト。
 * パーティクルはステートレス(tickとインデックスから決定的に計算)なので
 * GC負荷ゼロ・リロード安全。
 */
import { VIEW_W, VIEW_H } from '../constants';

export type AmbientTheme = 'grass' | 'forest' | 'cave' | 'tower' | 'sea' | 'night';

/** 擬似ハッシュ(0..1) */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface ThemeDef {
  count: number;
  color: string;
  size: number;
  /** 上昇/漂いの速さ */
  drift: number;
  rise: number;
  twinkle: number;
}

const THEMES: Record<AmbientTheme, ThemeDef> = {
  grass: { count: 14, color: '247, 213, 29', size: 1.4, drift: 8, rise: -5, twinkle: 900 }, // 蛍
  forest: { count: 12, color: '180, 255, 160', size: 1.2, drift: 6, rise: 4, twinkle: 1200 }, // 木漏れ日の粒
  cave: { count: 10, color: '150, 160, 220', size: 1.1, drift: 4, rise: -3, twinkle: 1500 }, // 鉱石の粉塵
  tower: { count: 12, color: '190, 150, 255', size: 1.3, drift: 5, rise: -6, twinkle: 1000 }, // 魔力の光
  sea: { count: 14, color: '160, 230, 255', size: 1.3, drift: 12, rise: -2, twinkle: 800 }, // 潮のきらめき
  night: { count: 10, color: '255, 255, 255', size: 1, drift: 3, rise: -2, twinkle: 1400 },
};

/** エリアの空気感パーティクル(手前レイヤーに描く) */
export function drawAmbient(ctx: CanvasRenderingContext2D, theme: AmbientTheme, tick: number): void {
  const t = THEMES[theme];
  for (let i = 0; i < t.count; i++) {
    const h1 = hash(i, 1);
    const h2 = hash(i, 2);
    const h3 = hash(i, 3);
    const period = 6000 + h3 * 6000;
    const phase = ((tick + h1 * period) % period) / period; // 0..1
    const x = (h1 * VIEW_W + tick * (t.drift / 1000) * (0.5 + h2) + Math.sin(tick / 900 + i) * 6) % VIEW_W;
    const y = (h2 * VIEW_H + phase * t.rise * 24 + VIEW_H) % VIEW_H;
    const alpha = (0.25 + 0.55 * Math.abs(Math.sin(tick / t.twinkle + i * 1.7))) * (0.5 + h3 * 0.5);
    ctx.fillStyle = `rgba(${t.color}, ${alpha.toFixed(2)})`;
    const s = t.size * (0.7 + h3 * 0.6);
    ctx.fillRect(x, y, s, s);
  }
}

// ビネット(四隅を柔らかく落とす)はキャンバスに1度だけ描いてキャッシュ
let vignetteCanvas: HTMLCanvasElement | null = null;

export function drawVignette(ctx: CanvasRenderingContext2D, strength = 0.45): void {
  if (!vignetteCanvas) {
    vignetteCanvas = document.createElement('canvas');
    vignetteCanvas.width = VIEW_W;
    vignetteCanvas.height = VIEW_H;
    const vctx = vignetteCanvas.getContext('2d')!;
    const g = vctx.createRadialGradient(
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_H * 0.45,
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_W * 0.72
    );
    g.addColorStop(0, 'rgba(4, 4, 18, 0)');
    g.addColorStop(1, 'rgba(4, 4, 18, 1)');
    vctx.fillStyle = g;
    vctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.drawImage(vignetteCanvas, 0, 0);
  ctx.restore();
}

/** スプライトの足元の落ち影 */
export function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 12, 0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, w / 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** バトルの敵の足元ステージ(楕円+リムライト) */
export function drawStage(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rim: string): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 14, 0.38)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** バトル背景のオーロラ帯(ゆっくり漂う光) */
export function drawAurora(ctx: CanvasRenderingContext2D, tick: number, colors: [string, string]): void {
  ctx.save();
  for (let band = 0; band < 2; band++) {
    const yBase = 26 + band * 26;
    const drift = Math.sin(tick / (2600 + band * 900) + band * 2) * 18;
    ctx.fillStyle = colors[band];
    ctx.beginPath();
    ctx.ellipse(VIEW_W / 2 + drift, yBase, VIEW_W * 0.62, 13 + band * 5, -0.06 + band * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
