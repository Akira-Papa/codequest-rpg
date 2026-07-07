/**
 * まなびの石碑レッスン用アニメーションデモ。
 * 各デモは 幅232 x 高さ48 のエリア(x, y起点)にtickベースで描画する。
 */
import { drawText, setFont } from './ui';
import { drawSprite, HERO_SIDE, HERO_PALETTE, ENEMY_SPRITES } from './sprites';

const W = 232;
const H = 48;

/** 小さな箱を描く(変数の「はこ」メタファ) */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, w = 34, h = 26): void {
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f7d51d';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  drawText(ctx, label, x + 2, y - 9, '#f7d51d', 7);
}

export function drawDemo(
  ctx: CanvasRenderingContext2D,
  demo: string,
  x: number,
  y: number,
  tick: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, W, H);
  ctx.clip();
  setFont(ctx, 8);

  switch (demo) {
    case 'var-box': {
      // let x = 5; → x = 10; 値が箱に落ちて入れ替わる
      const phase = Math.floor(tick / 1400) % 2;
      const t = (tick % 1400) / 1400;
      const value = phase === 0 ? '5' : '10';
      box(ctx, x + 96, y + 16, 'x');
      const dropY = Math.min(1, t * 2) * 22;
      drawText(ctx, value, x + 108, y - 2 + dropY, '#4cd44c', 10);
      drawText(ctx, phase === 0 ? 'let x = 5;' : 'x = 10;', x + 8, y + 20, '#c8c8e0', 8);
      drawText(ctx, 'はこに いれる!', x + 150, y + 22, '#8888c0', 7);
      break;
    }
    case 'var-const': {
      // const の箱にはカギ。新しい値が弾かれる
      const t = (tick % 1600) / 1600;
      box(ctx, x + 96, y + 16, 'const name');
      drawText(ctx, '"ゆうしゃ"', x + 99, y + 26, '#4cd44c', 7);
      drawText(ctx, '◆', x + 126, y + 10, '#f7d51d', 8); // カギ
      const bx = x + 40 + Math.min(1, t * 2) * 46;
      const bounce = t > 0.5 ? (t - 0.5) * 60 : 0;
      drawText(ctx, '"まおう"', x + bx - bounce, y + 20, '#d43c3c', 7);
      if (t > 0.5) drawText(ctx, '×', x + 84, y + 14, '#d43c3c', 12);
      drawText(ctx, 'constは いれかえきんし', x + 140, y + 34, '#8888c0', 7);
      break;
    }
    case 'var-types': {
      // "5"(string) と 5(number) の違い
      const on = Math.floor(tick / 900) % 2 === 0;
      box(ctx, x + 30, y + 14, 'もじれつ', 44);
      drawText(ctx, '"5"', x + 42, y + 22, on ? '#f7d51d' : '#ffffff', 9);
      box(ctx, x + 130, y + 14, 'すうじ', 44);
      drawText(ctx, '5', x + 148, y + 22, on ? '#ffffff' : '#f7d51d', 9);
      drawText(ctx, '" "が あるかで かたが ちがう', x + 36, y + 44, '#8888c0', 7);
      break;
    }
    case 'cond-branch': {
      // if の分かれ道を勇者が歩く
      const phase = Math.floor(tick / 1800) % 2; // 0: true側 1: false側
      drawText(ctx, 'hp < 10 ?', x + 88, y + 2, '#f7d51d', 8);
      ctx.strokeStyle = '#8888c0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 112, y + 14);
      ctx.lineTo(x + 60, y + 34);
      ctx.moveTo(x + 112, y + 14);
      ctx.lineTo(x + 164, y + 34);
      ctx.stroke();
      drawText(ctx, 'true→にげる', x + 20, y + 38, phase === 0 ? '#4cd44c' : '#55557a', 7);
      drawText(ctx, 'false→たたかう', x + 140, y + 38, phase === 1 ? '#4cd44c' : '#55557a', 7);
      const t = (tick % 1800) / 1800;
      const hx = x + 104 + (phase === 0 ? -1 : 1) * Math.min(1, t * 1.5) * 44;
      drawSprite(ctx, HERO_SIDE, HERO_PALETTE, hx, y + 10, 1, phase === 0);
      break;
    }
    case 'cond-equals': {
      // = は「いれる」、=== は「くらべる」
      const on = Math.floor(tick / 1200) % 2 === 0;
      drawText(ctx, 'x = 5', x + 30, y + 8, on ? '#f7d51d' : '#55557a', 9);
      drawText(ctx, '→ はこに いれる', x + 96, y + 9, on ? '#ffffff' : '#55557a', 7);
      drawText(ctx, 'x === 5', x + 30, y + 28, !on ? '#f7d51d' : '#55557a', 9);
      drawText(ctx, '→ おなじか くらべる(true/false)', x + 96, y + 29, !on ? '#ffffff' : '#55557a', 7);
      break;
    }
    case 'loop-count': {
      // for (let i = 0; i < 3; i++) 勇者がスライムを3回攻撃
      const step = Math.floor(tick / 800) % 4; // 0,1,2 = 攻撃 3 = おわり
      const slime = ENEMY_SPRITES.bugslime;
      drawSprite(ctx, slime.sprite, slime.palette, x + 150, y + 14, 2);
      const lunge = step < 3 && tick % 800 < 400 ? 14 : 0;
      drawSprite(ctx, HERO_SIDE, HERO_PALETTE, x + 90 + lunge, y + 16, 2);
      drawText(ctx, step < 3 ? `i = ${step}` : 'i = 3 → おわり!', x + 10, y + 6, '#f7d51d', 8);
      drawText(ctx, 'i < 3 ?', x + 10, y + 20, step < 3 ? '#4cd44c' : '#d43c3c', 7);
      drawText(ctx, step < 3 ? 'true→こうげき!' : 'false→ループしゅうりょう', x + 10, y + 32, '#8888c0', 7);
      break;
    }
    case 'func-machine': {
      // 関数=機械: 2,3 を入れると 5 が出る
      const t = (tick % 2000) / 2000;
      box(ctx, x + 92, y + 12, 'add(a, b)', 52, 30);
      drawText(ctx, 'a+b', x + 106, y + 24, '#f7d51d', 8);
      const inX = Math.min(1, t * 2) * 60;
      if (t < 0.55) drawText(ctx, '2, 3', x + 30 + inX, y + 22, '#4cd44c', 9);
      if (t > 0.55) {
        const outX = (t - 0.55) * 2 * 50;
        drawText(ctx, '5', x + 150 + outX, y + 22, '#4cd44c', 11);
      }
      drawText(ctx, 'いれる→けいさん→return', x + 60, y + 46 - 4, '#8888c0', 7);
      break;
    }
    case 'func-return': {
      // return で値を持ち帰る / returnなしは undefined
      const on = Math.floor(tick / 1400) % 2 === 0;
      box(ctx, x + 30, y + 12, 'return "やあ"', 66, 26);
      drawText(ctx, on ? '→ "やあ"' : '', x + 104, y + 20, '#4cd44c', 8);
      box(ctx, x + 30 + 110, y + 12, 'returnなし', 56, 26);
      drawText(ctx, !on ? '→ undefined' : '', x + 30 + 110 + 8, y + 42 - 2, '#d43c3c', 7);
      break;
    }
    case 'array-index': {
      // 配列の箱の列と番号、ポインタが動く
      const idx = Math.floor(tick / 900) % 3;
      const vals = ['10', '20', '30'];
      for (let i = 0; i < 3; i++) {
        const bx = x + 50 + i * 44;
        ctx.fillStyle = i === idx ? '#3a3a1a' : '#2a2a4a';
        ctx.fillRect(bx, y + 14, 38, 22);
        ctx.strokeStyle = i === idx ? '#f7d51d' : '#8888c0';
        ctx.strokeRect(bx + 0.5, y + 14.5, 37, 21);
        drawText(ctx, vals[i], bx + 12, y + 20, i === idx ? '#f7d51d' : '#ffffff', 8);
        drawText(ctx, `${i}`, bx + 16, y + 38, '#8888c0', 7);
      }
      drawText(ctx, `arr[${idx}] は ${vals[idx]}`, x + 60, y + 2, '#4cd44c', 8);
      break;
    }
    case 'array-map': {
      // map: 全員へんしん
      const t = (tick % 1800) / 1800;
      const trans = Math.min(1, t * 1.6);
      const src = ['1', '2', '3'];
      const dst = ['2', '4', '6'];
      for (let i = 0; i < 3; i++) {
        const bx = x + 30 + i * 36;
        drawText(ctx, src[i], bx, y + 8, '#ffffff', 9);
        const done = trans > (i + 1) / 3;
        drawText(ctx, done ? dst[i] : '?', bx + 130, y + 8, done ? '#4cd44c' : '#55557a', 9);
      }
      drawText(ctx, '.map(x => x * 2) →', x + 62, y + 26, '#f7d51d', 7);
      drawText(ctx, 'ぜんいん 2ばいに へんしん!', x + 60, y + 40, '#8888c0', 7);
      break;
    }
    default: {
      drawText(ctx, `(demo: ${demo})`, x + 8, y + 20, '#55557a', 7);
    }
  }
  ctx.restore();
  void H;
}
