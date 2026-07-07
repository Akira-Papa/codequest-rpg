/** モダン・レトロUI: ガラスパネル+2トーンの光る枠、グラデーションHPバー */

const FONT = '"DotGothic16", monospace';

export function setFont(ctx: CanvasRenderingContext2D, size = 8): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textBaseline = 'top';
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * ガラス風ウィンドウ。accent=trueで金色の強調枠(ボス名・タイトルなど)
 */
export function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent = false
): void {
  // 落ち影
  ctx.fillStyle = 'rgba(0, 0, 6, 0.45)';
  roundRectPath(ctx, x + 1.5, y + 2.5, w, h, 5);
  ctx.fill();

  // ガラス本体(下にいくほど深い色)
  roundRectPath(ctx, x, y, w, h, 5);
  ctx.fillStyle = 'rgba(13, 15, 38, 0.93)';
  ctx.fill();

  // 上部のシーン(光の映り込み)
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(140, 160, 255, 0.08)';
  ctx.fillRect(x, y, w, Math.min(10, h * 0.35));
  ctx.fillStyle = 'rgba(0, 0, 20, 0.25)';
  ctx.fillRect(x, y + h - 5, w, 5);
  ctx.restore();

  // 外側のほのかな発光ライン
  roundRectPath(ctx, x - 1, y - 1, w + 2, h + 2, 6);
  ctx.strokeStyle = accent ? 'rgba(247, 213, 29, 0.28)' : 'rgba(110, 130, 255, 0.30)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // メインの枠線
  roundRectPath(ctx, x, y, w, h, 5);
  ctx.strokeStyle = accent ? '#f0d060' : '#dfe4ff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = '#ffffff',
  size = 8
): void {
  setFont(ctx, size);
  // 可読性のためのソフトシャドウ
  ctx.fillStyle = 'rgba(0, 0, 10, 0.55)';
  ctx.fillText(text, x + 0.7, y + 0.9);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** 折り返し計算(描画と同一アルゴリズム)。行の配列を返す */
export function layoutLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size = 8
): string[] {
  setFont(ctx, size);
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** 日本語対応の文字単位折り返し。描画した行数を返す */
export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 10,
  color = '#ffffff',
  size = 8
): number {
  const lines = layoutLines(ctx, text, maxWidth, size);
  for (let i = 0; i < lines.length; i++) {
    drawText(ctx, lines[i], x, y + i * lineHeight, color, size);
  }
  return lines.length;
}

/**
 * HPバー: 角丸トラック+2トーングラデ風フィル+端の光。
 * chipRatio(遅れて減る白いチップ)を渡すとダメージ演出になる。
 */
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  hp: number,
  maxHp: number,
  chipRatio?: number
): void {
  const h = 5;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));

  // トラック
  roundRectPath(ctx, x, y, w, h, 2.5);
  ctx.fillStyle = '#141530';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 210, 255, 0.35)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // ダメージチップ(遅れて減る)
  if (chipRatio !== undefined && chipRatio > ratio) {
    roundRectPath(ctx, x + 0.5, y + 0.5, Math.max(2, (w - 1) * chipRatio), h - 1, 2);
    ctx.fillStyle = 'rgba(255, 235, 235, 0.85)';
    ctx.fill();
  }

  if (ratio > 0) {
    const base = ratio > 0.5 ? '#3ecf5a' : ratio > 0.25 ? '#f2c522' : '#e04848';
    const light = ratio > 0.5 ? '#8af59c' : ratio > 0.25 ? '#ffe89a' : '#ff9a8a';
    const fw = Math.max(2, (w - 1) * ratio);
    roundRectPath(ctx, x + 0.5, y + 0.5, fw, h - 1, 2);
    ctx.fillStyle = base;
    ctx.fill();
    // 上半分のハイライトで立体感
    ctx.save();
    roundRectPath(ctx, x + 0.5, y + 0.5, fw, h - 1, 2);
    ctx.clip();
    ctx.fillStyle = light;
    ctx.fillRect(x, y + 0.5, fw + 1, 1.6);
    ctx.restore();
  }
}

/** 点滅する「▼」(メッセージ送り待ち) */
export function drawBlinkArrow(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  if (Math.floor(tick / 400) % 2 === 0) {
    drawText(ctx, '▼', x, y, '#f7d51d', 8);
  }
}
