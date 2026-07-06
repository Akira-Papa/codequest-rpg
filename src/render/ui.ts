/** ドラクエ風UI: 黒背景+白二重枠のウィンドウ、テキスト、HPバー */

const FONT = '"DotGothic16", monospace';

export function setFont(ctx: CanvasRenderingContext2D, size = 8): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textBaseline = 'top';
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

/** DQ風ウィンドウ(黒地+白枠、角を落とす) */
export function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(8, 8, 24, 0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffffff';
  // 外枠(角1pxを落として丸みを出す)
  ctx.fillRect(x + 1, y, w - 2, 2);
  ctx.fillRect(x + 1, y + h - 2, w - 2, 2);
  ctx.fillRect(x, y + 1, 2, h - 2);
  ctx.fillRect(x + w - 2, y + 1, 2, h - 2);
  // 内側の細ライン
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x + 3, y + 3, w - 6, 1);
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
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
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
  ctx.fillStyle = color;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return lines.length;
}

/** HPバー(色だけに依存せず数値も併記する前提で使う) */
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  hp: number,
  maxHp: number
): void {
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  ctx.fillStyle = '#3a3a5a';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = ratio > 0.5 ? '#4cd44c' : ratio > 0.25 ? '#f7d51d' : '#d43c3c';
  ctx.fillRect(x, y, Math.round(w * ratio), 4);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, 5);
}

/** 点滅する「▼」(メッセージ送り待ち) */
export function drawBlinkArrow(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  if (Math.floor(tick / 400) % 2 === 0) {
    drawText(ctx, '▼', x, y, '#ffffff', 8);
  }
}
