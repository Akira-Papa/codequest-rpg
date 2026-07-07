import type { Scene } from '../types';
import type { Game } from '../game';
import { VIEW_W, VIEW_H } from '../constants';
import { drawText, drawWindow, setFont } from '../render/ui';
import { drawSprite, ENEMY_SPRITES, HERO_DOWN, HERO_PALETTE } from '../render/sprites';
import { loadSave, newSave, hasSave } from '../core/save';
import { sfx } from '../core/audio';
import { drawAurora } from '../render/fx';
import { FieldScene } from './field';

/** 背景の星(決定的に配置) */
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 61) % VIEW_W,
  y: (i * 37) % 110,
  speed: 300 + (i % 3) * 250,
}));

// メニューのヒット領域(描画座標と一致させる)
const MENU_X = 72;
const MENU_W = 112;
const MENU_ROWS = [
  { y: 132, h: 16 }, // はじめから
  { y: 148, h: 16 }, // つづきから
];

export class TitleScene implements Scene {
  private cursor = 0;
  private tick = 0;
  private canContinue = hasSave();
  /** 'menu' | 'confirm'(セーブ上書き確認) */
  private mode: 'menu' | 'confirm' = 'menu';
  private bgGrad: CanvasGradient | null = null;

  constructor(private game: Game) {}

  update(dt: number): void {
    this.tick += dt;
    const input = this.game.input;

    if (input.wasPressed('up', 'down')) {
      this.cursor = 1 - this.cursor;
      sfx.cursor();
    }

    if (this.mode === 'confirm') {
      if (input.wasPressed('cancel')) {
        this.mode = 'menu';
        this.cursor = 0;
        sfx.cursor();
        return;
      }
      if (input.click) {
        const row = this.menuRowAt(input.click.x, input.click.y);
        if (row < 0) return;
        if (row !== this.cursor) {
          this.cursor = row;
          sfx.cursor();
          return;
        }
        this.decideConfirm(row);
        return;
      }
      if (input.wasPressed('confirm')) this.decideConfirm(this.cursor);
      return;
    }

    if (input.click) {
      const row = this.menuRowAt(input.click.x, input.click.y);
      if (row < 0) return;
      // 2段階タップ: 1回目は選択のみ(誤タップによるセーブ消滅防止)
      if (row !== this.cursor) {
        this.cursor = row;
        sfx.cursor();
        return;
      }
      this.select(row);
      return;
    }
    if (input.wasPressed('confirm')) {
      this.select(this.cursor);
    }
  }

  private menuRowAt(x: number, y: number): number {
    if (x < MENU_X || x > MENU_X + MENU_W) return -1;
    for (let i = 0; i < MENU_ROWS.length; i++) {
      if (y >= MENU_ROWS[i].y && y < MENU_ROWS[i].y + MENU_ROWS[i].h) return i;
    }
    return -1;
  }

  private select(index: number): void {
    if (index === 0) {
      if (this.canContinue) {
        // 既存セーブがあるときは上書き確認を挟む
        sfx.confirm();
        this.mode = 'confirm';
        this.cursor = 1; // 安全側(いいえ)を初期選択
        return;
      }
      this.start(newSave());
      return;
    }
    if (!this.canContinue) {
      sfx.wrong();
      return;
    }
    const saved = loadSave();
    if (!saved) {
      sfx.wrong();
      this.canContinue = false;
      return;
    }
    this.start(saved);
  }

  private decideConfirm(index: number): void {
    if (index === 0) {
      this.start(newSave());
    } else {
      sfx.cursor();
      this.mode = 'menu';
      this.cursor = 0;
    }
  }

  private start(data: ReturnType<typeof newSave>): void {
    sfx.confirm();
    this.game.data = data;
    this.game.changeScene(new FieldScene(this.game));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.bgGrad) {
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#070718');
      grad.addColorStop(0.55, '#141238');
      grad.addColorStop(1, '#2a1c50');
      this.bgGrad = grad;
    }
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // オーロラ
    drawAurora(ctx, this.tick, ['rgba(90, 220, 180, 0.06)', 'rgba(140, 120, 255, 0.08)']);

    // 星(またたき)
    for (const s of STARS) {
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(this.tick / s.speed + s.x));
      ctx.fillStyle = `rgba(255, 255, 255, ${tw.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }

    // 流れ星(約5秒周期)
    const meteorT = (this.tick % 5200) / 5200;
    if (meteorT < 0.12) {
      const mt = meteorT / 0.12;
      const mx = 220 - mt * 150;
      const my = 14 + mt * 44;
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.8 * (1 - mt)).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + 14, my - 5);
      ctx.stroke();
    }

    // 月(グロー付き)
    ctx.save();
    ctx.shadowColor = 'rgba(240, 240, 200, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#f4f0d8';
    ctx.beginPath();
    ctx.arc(218, 26, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(180, 180, 150, 0.5)';
    ctx.fillRect(214, 22, 3, 3);
    ctx.fillRect(221, 29, 2, 2);

    // 山のシルエット(2層パララックス風)
    ctx.fillStyle = '#100e2c';
    ctx.beginPath();
    ctx.moveTo(0, 168);
    ctx.lineTo(30, 128);
    ctx.lineTo(70, 158);
    ctx.lineTo(110, 122);
    ctx.lineTo(150, 156);
    ctx.lineTo(200, 126);
    ctx.lineTo(VIEW_W, 160);
    ctx.lineTo(VIEW_W, 192);
    ctx.lineTo(0, 192);
    ctx.fill();
    ctx.fillStyle = '#0a081f';
    ctx.beginPath();
    ctx.moveTo(0, 178);
    ctx.lineTo(50, 148);
    ctx.lineTo(96, 172);
    ctx.lineTo(160, 142);
    ctx.lineTo(220, 170);
    ctx.lineTo(VIEW_W, 152);
    ctx.lineTo(VIEW_W, 192);
    ctx.lineTo(0, 192);
    ctx.fill();

    // 地面と登場キャラ(ゆったり呼吸)
    ctx.fillStyle = '#0e2c1a';
    ctx.fillRect(0, 170, VIEW_W, 22);
    const bob = Math.round(Math.sin(this.tick / 600) * 1.5);
    const slime = ENEMY_SPRITES.bugslime;
    const dragon = ENEMY_SPRITES.loopdragon;
    drawSprite(ctx, slime.sprite, slime.palette, 24, 154 + bob, 1);
    drawSprite(ctx, HERO_DOWN, HERO_PALETTE, 44, 154 - bob, 1);
    drawSprite(ctx, dragon.sprite, dragon.palette, 204, 146 + bob, 2);

    // ロゴ(グロー+ゆらぎ)
    const logoY = 30 + Math.sin(this.tick / 1400) * 2;
    setFont(ctx, 24);
    ctx.textBaseline = 'top';
    ctx.save();
    ctx.shadowColor = 'rgba(247, 213, 29, 0.55)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#16213e';
    ctx.fillText('コードクエスト', 46, logoY + 2);
    ctx.fillStyle = '#f7d51d';
    ctx.fillText('コードクエスト', 44, logoY);
    ctx.restore();
    drawText(ctx, '- CODE QUEST -', 86, logoY + 30, '#9aa2e0', 8);
    drawText(ctx, 'たたかって まなぶ JavaScriptの ぼうけん', 34, logoY + 46, '#d0d4f0', 8);

    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(this.tick / 500));
    if (this.mode === 'confirm') {
      drawWindow(ctx, 40, 108, 176, 20, true);
      drawText(ctx, 'セーブデータを うわがきしますか?', 48, 114, '#f7d51d');
      drawWindow(ctx, MENU_X, 126, MENU_W, 52);
      drawText(ctx, 'はい(さいしょから)', 100, 136, '#ffffff');
      drawText(ctx, 'いいえ', 100, 152, '#ffffff');
      ctx.globalAlpha = pulse;
      drawText(ctx, '▶', 88, 136 + this.cursor * 16, '#f7d51d');
      ctx.globalAlpha = 1;
    } else {
      drawWindow(ctx, MENU_X, 126, MENU_W, 52);
      drawText(ctx, 'はじめから', 100, 136, '#ffffff');
      drawText(ctx, 'つづきから', 100, 152, this.canContinue ? '#ffffff' : '#55557a');
      ctx.globalAlpha = pulse;
      drawText(ctx, '▶', 88, 136 + this.cursor * 16, '#f7d51d');
      ctx.globalAlpha = 1;
    }

    drawText(ctx, '↑↓で えらんで Enter / 2かいタップ', 56, 182, '#8a8fb8');
  }
}
