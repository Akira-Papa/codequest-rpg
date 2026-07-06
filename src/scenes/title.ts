import type { Scene } from '../types';
import type { Game } from '../game';
import { VIEW_W, VIEW_H } from '../constants';
import { drawText, drawWindow, setFont } from '../render/ui';
import { drawSprite, ENEMY_SPRITES, HERO_DOWN, HERO_PALETTE } from '../render/sprites';
import { loadSave, newSave, hasSave } from '../core/save';
import { sfx } from '../core/audio';
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
      grad.addColorStop(0, '#0a0a28');
      grad.addColorStop(1, '#1c1c4a');
      this.bgGrad = grad;
    }
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    for (const s of STARS) {
      const on = Math.floor(this.tick / s.speed) % 2 === 0;
      ctx.fillStyle = on ? '#ffffff' : '#555588';
      ctx.fillRect(s.x, s.y, 1, 1);
    }

    // 地面と登場キャラ
    ctx.fillStyle = '#123a20';
    ctx.fillRect(0, 168, VIEW_W, 24);
    const slime = ENEMY_SPRITES.bugslime;
    const dragon = ENEMY_SPRITES.loopdragon;
    drawSprite(ctx, slime.sprite, slime.palette, 24, 152, 1);
    drawSprite(ctx, HERO_DOWN, HERO_PALETTE, 44, 152, 1);
    drawSprite(ctx, dragon.sprite, dragon.palette, 204, 144, 2);

    // ロゴ
    setFont(ctx, 24);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#16213e';
    ctx.fillText('コードクエスト', 46, 34);
    ctx.fillStyle = '#f7d51d';
    ctx.fillText('コードクエスト', 44, 32);
    drawText(ctx, '- CODE QUEST -', 86, 62, '#8888c0', 8);
    drawText(ctx, 'たたかって まなぶ JavaScriptの ぼうけん', 34, 78, '#c8c8e0', 8);

    if (this.mode === 'confirm') {
      drawWindow(ctx, 40, 108, 176, 20);
      drawText(ctx, 'セーブデータを うわがきしますか?', 48, 114, '#f7d51d');
      drawWindow(ctx, MENU_X, 126, MENU_W, 52);
      drawText(ctx, 'はい(さいしょから)', 100, 136, '#ffffff');
      drawText(ctx, 'いいえ', 100, 152, '#ffffff');
      drawText(ctx, '▶', 88, 136 + this.cursor * 16, '#f7d51d');
    } else {
      drawWindow(ctx, MENU_X, 126, MENU_W, 52);
      drawText(ctx, 'はじめから', 100, 136, '#ffffff');
      drawText(ctx, 'つづきから', 100, 152, this.canContinue ? '#ffffff' : '#55557a');
      drawText(ctx, '▶', 88, 136 + this.cursor * 16, '#f7d51d');
    }

    drawText(ctx, '↑↓で えらんで Enter / 2かいタップ', 56, 182, '#55557a');
  }
}
