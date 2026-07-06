import type { Scene, Area, Enemy } from '../types';
import type { Game } from '../game';
import { VIEW_W } from '../constants';
import { AREAS } from '../data/areas';
import { ENEMIES } from '../data/enemies';
import {
  drawTile,
  drawSprite,
  isWalkable,
  isEncounterTile,
  TILE,
  HERO_DOWN,
  HERO_UP,
  HERO_SIDE,
  HERO_PALETTE,
} from '../render/sprites';
import { drawWindow, drawText, drawWrappedText, drawHpBar } from '../render/ui';
import { pickWeighted } from '../core/logic';
import { sfx } from '../core/audio';
import { BattleScene } from './battle';

type Dir = 'up' | 'down' | 'left' | 'right';

const MOVE_MS = 160;

export class FieldScene implements Scene {
  private area: Area;
  private tick = 0;
  private facing: Dir = 'down';
  private moving: { fromX: number; fromY: number; toX: number; toY: number; t: number } | null = null;
  private message = '';
  private messageTimer = 0;
  private areaNameTimer = 2200;

  constructor(private game: Game) {
    this.area = AREAS[game.data.currentArea] ?? AREAS.area1;
  }

  onEnter(): void {
    this.game.saveNow();
  }

  private tileAt(x: number, y: number): string {
    if (y < 0 || y >= this.area.map.length) return 't';
    const row = this.area.map[y];
    if (x < 0 || x >= row.length) return 't';
    return row[x];
  }

  /** 座標に未撃破ボスがいればその敵データを返す */
  private bossAt(x: number, y: number): Enemy | null {
    const boss = this.area.boss;
    if (!boss) return null;
    if (this.game.data.defeatedBosses.includes(boss.enemyId)) return null;
    if (boss.x !== x || boss.y !== y) return null;
    return ENEMIES[boss.enemyId] ?? null;
  }

  private showMessage(text: string, ms = 2200): void {
    this.message = text;
    this.messageTimer = ms;
  }

  update(dt: number): void {
    this.tick += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.areaNameTimer > 0) this.areaNameTimer -= dt;

    const p = this.game.data.player;

    if (this.moving) {
      this.moving.t += dt / MOVE_MS;
      if (this.moving.t >= 1) {
        p.x = this.moving.toX;
        p.y = this.moving.toY;
        this.moving = null;
        this.onStep();
      }
      return;
    }

    const input = this.game.input;
    let dir: Dir | null = null;
    if (input.isDown('up')) dir = 'up';
    else if (input.isDown('down')) dir = 'down';
    else if (input.isDown('left')) dir = 'left';
    else if (input.isDown('right')) dir = 'right';

    // タップ移動: 押している間、その方向へ歩き続ける(長押し対応)
    if (!dir && input.pointer) {
      const px = p.x * TILE + TILE / 2;
      const py = p.y * TILE + TILE / 2;
      const dx = input.pointer.x - px;
      const dy = input.pointer.y - py;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      }
    }

    if (!dir) return;
    this.facing = dir;

    const nx = p.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0);
    const ny = p.y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0);

    // ボスに接触 → ボス戦
    const boss = this.bossAt(nx, ny);
    if (boss) {
      sfx.encounter();
      this.game.changeScene(new BattleScene(this.game, boss));
      return;
    }

    const tile = this.tileAt(nx, ny);
    if (!isWalkable(tile)) return;

    this.moving = { fromX: p.x, fromY: p.y, toX: nx, toY: ny, t: 0 };
  }

  /** 1歩進み終わったときのタイル効果 */
  private onStep(): void {
    const p = this.game.data.player;
    const tile = this.tileAt(p.x, p.y);

    // 村: 回復
    if (tile === 'V') {
      if (p.hp < p.maxHp) {
        p.hp = p.maxHp;
        sfx.heal();
        this.showMessage('やどやで ひとやすみ。HPが かいふくした!');
        this.game.saveNow();
      }
      return;
    }

    // エリア出入口
    if (tile === 'F' || tile === 'C' || tile === 'H') {
      const exit = this.area.exits.find((e) => e.x === p.x && e.y === p.y);
      if (exit) {
        const dest = AREAS[exit.to];
        const locked =
          dest.unlockedBy && !this.game.data.defeatedBosses.includes(dest.unlockedBy);
        if (locked) {
          this.showMessage('つよい モンスターの けはいがする… まだ すすめない!');
          return;
        }
        this.game.data.currentArea = dest.id;
        p.x = exit.spawnX;
        p.y = exit.spawnY;
        if (!this.game.data.unlockedAreas.includes(dest.id)) {
          this.game.data.unlockedAreas.push(dest.id);
        }
        this.game.saveNow();
        this.game.changeScene(new FieldScene(this.game));
      }
      return;
    }

    // エンカウント
    if (isEncounterTile(tile) && this.area.encounters.length > 0) {
      if (Math.random() < this.area.encounterRate) {
        const table = this.area.encounters;
        const picked = pickWeighted(
          table.map((e) => e.enemyId),
          table.map((e) => e.weight),
          Math.random
        );
        sfx.encounter();
        this.game.changeScene(new BattleScene(this.game, ENEMIES[picked]));
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { map } = this.area;
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        drawTile(ctx, map[y][x], x * TILE, y * TILE, this.tick);
      }
    }

    // ボスシンボル
    const boss = this.area.boss;
    if (boss && !this.game.data.defeatedBosses.includes(boss.enemyId)) {
      const e = ENEMIES[boss.enemyId];
      const bob = Math.floor(this.tick / 400) % 2;
      drawSprite(ctx, e.sprite, e.palette, boss.x * TILE, boss.y * TILE + bob, 1);
    }

    // プレイヤー(移動中は補間)
    const p = this.game.data.player;
    let px = p.x * TILE;
    let py = p.y * TILE;
    if (this.moving) {
      const t = Math.min(1, this.moving.t);
      px = (this.moving.fromX + (this.moving.toX - this.moving.fromX) * t) * TILE;
      py = (this.moving.fromY + (this.moving.toY - this.moving.fromY) * t) * TILE;
    }
    const sprite =
      this.facing === 'up' ? HERO_UP : this.facing === 'down' ? HERO_DOWN : HERO_SIDE;
    drawSprite(ctx, sprite, HERO_PALETTE, px, py, 1, this.facing === 'left');

    // HUD
    drawWindow(ctx, 2, 2, 84, 30);
    drawText(ctx, `Lv ${p.level}`, 8, 8, '#f7d51d');
    drawText(ctx, `HP ${p.hp}/${p.maxHp}`, 8, 18);
    drawHpBar(ctx, 46, 10, 34, p.hp, p.maxHp);

    // エリア名(入場時のみ)
    if (this.areaNameTimer > 0) {
      const w = this.area.name.length * 9 + 24;
      drawWindow(ctx, (VIEW_W - w) / 2, 40, w, 20);
      drawText(ctx, this.area.name, (VIEW_W - w) / 2 + 12, 46, '#f7d51d');
    }

    // メッセージ
    if (this.messageTimer > 0 && this.message) {
      drawWindow(ctx, 4, 158, VIEW_W - 8, 30);
      drawWrappedText(ctx, this.message, 12, 165, VIEW_W - 24, 10);
    }

    // クリア済みバッジ
    if (this.game.data.cleared) {
      drawText(ctx, '★クリア', VIEW_W - 44, 6, '#f7d51d');
    }
  }
}
