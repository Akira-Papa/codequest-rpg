import type { Scene, Area, Enemy, Chest } from '../types';
import type { Game } from '../game';
import { VIEW_W, VIEW_H } from '../constants';
import { AREAS } from '../data/areas';
import { ENEMIES } from '../data/enemies';
import { QUESTIONS } from '../data/questions';
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
  CHEST_CLOSED,
  CHEST_OPEN,
  CHEST_PALETTE,
} from '../render/sprites';
import { drawWindow, drawText, drawWrappedText, drawHpBar } from '../render/ui';
import { pickWeighted, gainExp, expForNext, attackForLevel } from '../core/logic';
import { sfx } from '../core/audio';
import { BattleScene } from './battle';
import { TitleScene } from './title';

type Dir = 'up' | 'down' | 'left' | 'right';
type MenuView = 'main' | 'status' | 'map';

const MOVE_MS = 160;

const MENU_ITEMS = ['つよさ', 'ちず', 'タイトルへ', 'とじる'] as const;
// メニューウィンドウ(右上)
const MENU_X = VIEW_W - 92;
const MENU_Y = 20;
const MENU_W = 88;
const MENU_ROW_H = 16;
// HUDのメニューボタン
const BTN = { x: VIEW_W - 46, y: 2, w: 44, h: 15 };

const CATEGORY_LABELS: [string, string][] = [
  ['variable', 'へんすう'],
  ['condition', 'じょうけん'],
  ['loop', 'ループ'],
];

export class FieldScene implements Scene {
  private area: Area;
  private tick = 0;
  private facing: Dir = 'down';
  private moving: { fromX: number; fromY: number; toX: number; toY: number; t: number } | null =
    null;
  private message = '';
  private messageTimer = 0;
  private areaNameTimer = 2200;
  private menu: { view: MenuView; cursor: number } | null = null;

  constructor(private game: Game) {
    this.area = AREAS[this.game.data.currentArea] ?? AREAS.area1;
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

  private chestAt(x: number, y: number): Chest | null {
    return this.area.chests?.find((c) => c.x === x && c.y === y) ?? null;
  }

  private showMessage(text: string, ms = 2600): void {
    this.message = text;
    this.messageTimer = ms;
  }

  // ---- 更新 -----------------------------------------------------------------

  update(dt: number): void {
    this.tick += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.areaNameTimer > 0) this.areaNameTimer -= dt;

    const input = this.game.input;

    if (this.menu) {
      this.updateMenu();
      return;
    }

    // メニューを開く: Escape/Xキー or メニューボタンタップ
    if (input.wasPressed('cancel')) {
      this.openMenu();
      return;
    }
    if (input.click) {
      const { x, y } = input.click;
      if (x >= BTN.x && x < BTN.x + BTN.w && y >= BTN.y && y < BTN.y + BTN.h) {
        this.openMenu();
        return;
      }
    }

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

  private openMenu(): void {
    sfx.confirm();
    this.menu = { view: 'main', cursor: 0 };
  }

  private closeMenu(): void {
    sfx.cursor();
    this.menu = null;
    this.game.saveNow();
  }

  private updateMenu(): void {
    const input = this.game.input;
    const menu = this.menu!;

    if (menu.view !== 'main') {
      // つよさ/ちず画面: なにか押せば戻る
      if (input.wasPressed('confirm', 'cancel') || input.click) {
        sfx.cursor();
        menu.view = 'main';
      }
      return;
    }

    if (input.wasPressed('cancel')) {
      this.closeMenu();
      return;
    }
    if (input.wasPressed('up')) {
      menu.cursor = (menu.cursor + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
      sfx.cursor();
    }
    if (input.wasPressed('down')) {
      menu.cursor = (menu.cursor + 1) % MENU_ITEMS.length;
      sfx.cursor();
    }
    if (input.click) {
      const { x, y } = input.click;
      if (x >= MENU_X && x < MENU_X + MENU_W) {
        const row = Math.floor((y - (MENU_Y + 10)) / MENU_ROW_H);
        if (row >= 0 && row < MENU_ITEMS.length) {
          menu.cursor = row;
          this.execMenu(row);
          return;
        }
      }
      // メニュー外タップで閉じる
      this.closeMenu();
      return;
    }
    if (input.wasPressed('confirm')) {
      this.execMenu(menu.cursor);
    }
  }

  private execMenu(index: number): void {
    sfx.confirm();
    switch (MENU_ITEMS[index]) {
      case 'つよさ':
        this.menu = { view: 'status', cursor: 0 };
        break;
      case 'ちず':
        this.menu = { view: 'map', cursor: 0 };
        break;
      case 'タイトルへ':
        this.game.saveNow();
        this.game.changeScene(new TitleScene(this.game));
        break;
      case 'とじる':
        this.closeMenu();
        break;
    }
  }

  /** 1歩進み終わったときのタイル効果 */
  private onStep(): void {
    const p = this.game.data.player;
    const tile = this.tileAt(p.x, p.y);

    // 宝箱: ちしきのたからばこ
    const chest = this.chestAt(p.x, p.y);
    if (chest && !this.game.data.openedChests.includes(chest.id)) {
      this.game.data.openedChests.push(chest.id);
      const beforeLevel = p.level;
      const ups = gainExp(p, chest.exp);
      p.hp = p.maxHp;
      sfx.heal();
      if (ups > 0) {
        sfx.levelup();
        this.showMessage(
          `ちしきのたからばこ! けいけんち+${chest.exp}! レベルアップ! Lv${beforeLevel}→Lv${p.level}!`,
          3200
        );
      } else {
        this.showMessage(`ちしきのたからばこを あけた! けいけんち+${chest.exp}! HPぜんかいふく!`, 3200);
      }
      this.game.saveNow();
      return;
    }

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

  // ---- 描画 -----------------------------------------------------------------

  draw(ctx: CanvasRenderingContext2D): void {
    const { map } = this.area;
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        drawTile(ctx, map[y][x], x * TILE, y * TILE, this.tick);
      }
    }

    // 宝箱
    for (const chest of this.area.chests ?? []) {
      const opened = this.game.data.openedChests.includes(chest.id);
      drawSprite(
        ctx,
        opened ? CHEST_OPEN : CHEST_CLOSED,
        CHEST_PALETTE,
        chest.x * TILE,
        chest.y * TILE,
        1
      );
    }

    // ボスシンボル
    const boss = this.area.boss;
    if (boss && !this.game.data.defeatedBosses.includes(boss.enemyId)) {
      const e = ENEMIES[boss.enemyId];
      const bob = Math.floor(this.tick / 400) % 2;
      drawSprite(ctx, e.sprite, e.palette, boss.x * TILE, boss.y * TILE + bob, 1);
    }

    // プレイヤー(移動中は補間+2フレーム歩行アニメ)
    const p = this.game.data.player;
    let px = p.x * TILE;
    let py = p.y * TILE;
    let walkFrame = 0;
    if (this.moving) {
      const t = Math.min(1, this.moving.t);
      px = (this.moving.fromX + (this.moving.toX - this.moving.fromX) * t) * TILE;
      py = (this.moving.fromY + (this.moving.toY - this.moving.fromY) * t) * TILE;
      walkFrame = Math.floor(t * 2) % 2;
    }
    const sprite =
      this.facing === 'up' ? HERO_UP : this.facing === 'down' ? HERO_DOWN : HERO_SIDE;
    // 歩行アニメ: 上下向きは左右反転で足を入れ替え、横向きは1px弾む
    const flip = this.facing === 'left' ? walkFrame === 0 : walkFrame === 1;
    const bounce = (this.facing === 'left' || this.facing === 'right') && walkFrame === 1 ? -1 : 0;
    drawSprite(ctx, sprite, HERO_PALETTE, px, py + bounce, 1, flip);

    // HUD
    drawWindow(ctx, 2, 2, 84, 30);
    drawText(ctx, `Lv ${p.level}`, 8, 8, '#f7d51d');
    drawText(ctx, `HP ${p.hp}/${p.maxHp}`, 8, 18);
    drawHpBar(ctx, 46, 10, 34, p.hp, p.maxHp);

    // メニューボタン
    drawWindow(ctx, BTN.x, BTN.y, BTN.w, BTN.h);
    drawText(ctx, 'メニュー', BTN.x + 6, BTN.y + 4, '#c8c8e0', 7);

    // エリア名(入場時のみ)
    if (this.areaNameTimer > 0 && !this.menu) {
      const w = this.area.name.length * 9 + 24;
      drawWindow(ctx, (VIEW_W - w) / 2, 40, w, 20);
      drawText(ctx, this.area.name, (VIEW_W - w) / 2 + 12, 46, '#f7d51d');
    }

    // メッセージ
    if (this.messageTimer > 0 && this.message && !this.menu) {
      drawWindow(ctx, 4, 158, VIEW_W - 8, 30);
      drawWrappedText(ctx, this.message, 12, 163, VIEW_W - 24, 10);
    }

    // クリア済みバッジ
    if (this.game.data.cleared) {
      drawText(ctx, '★', BTN.x - 12, 6, '#f7d51d');
    }

    if (this.menu) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (this.menu.view === 'main') this.drawMainMenu(ctx);
      else if (this.menu.view === 'status') this.drawStatus(ctx);
      else this.drawWorldMap(ctx);
    }
  }

  private drawMainMenu(ctx: CanvasRenderingContext2D): void {
    const h = MENU_ITEMS.length * MENU_ROW_H + 18;
    drawWindow(ctx, MENU_X, MENU_Y, MENU_W, h);
    MENU_ITEMS.forEach((label, i) => {
      const y = MENU_Y + 12 + i * MENU_ROW_H;
      if (i === this.menu!.cursor) drawText(ctx, '▶', MENU_X + 8, y, '#f7d51d');
      drawText(ctx, label, MENU_X + 20, y, i === this.menu!.cursor ? '#f7d51d' : '#ffffff');
    });
    drawText(ctx, 'Esc/Xで とじる', MENU_X - 2, MENU_Y + h + 4, '#8888c0', 7);
  }

  private drawStatus(ctx: CanvasRenderingContext2D): void {
    const p = this.game.data.player;
    const d = this.game.data;
    drawWindow(ctx, 20, 12, VIEW_W - 40, VIEW_H - 24);
    drawText(ctx, '― ゆうしゃの つよさ ―', 62, 20, '#f7d51d');

    drawText(ctx, `レベル: ${p.level}`, 32, 38);
    drawText(ctx, `HP: ${p.hp}/${p.maxHp}`, 130, 38);
    drawText(ctx, `こうげき: ${attackForLevel(p.level)}`, 32, 50);
    drawText(ctx, `つぎのLvまで: あと${expForNext(p.level) - p.exp}`, 130, 50);
    drawText(ctx, `たたかいの かち: ${d.battleWins}回`, 32, 62);
    drawText(ctx, `さいこうコンボ: ${d.bestCombo}`, 130, 62);

    drawText(ctx, '― がくしゅうの きろく ―', 58, 80, '#4cd44c');
    CATEGORY_LABELS.forEach(([cat, label], i) => {
      let asked = 0;
      let correct = 0;
      for (const q of QUESTIONS) {
        if (q.category !== cat) continue;
        const s = d.stats[q.id];
        if (s) {
          asked += s.asked;
          correct += s.correct;
        }
      }
      const y = 94 + i * 13;
      const rate = asked > 0 ? Math.round((correct / asked) * 100) : null;
      drawText(ctx, label, 32, y);
      drawText(
        ctx,
        rate === null ? 'まだ みとうの りょういき' : `せいかいりつ ${rate}%  (${correct}/${asked})`,
        96,
        y,
        rate === null ? '#55557a' : rate >= 80 ? '#4cd44c' : rate >= 50 ? '#f7d51d' : '#d43c3c'
      );
    });

    drawText(ctx, '― たおした ボス ―', 70, 136, '#d43c3c');
    const bosses: [string, string][] = [
      ['nullghost', 'ヌルポインタゴースト'],
      ['nesthydra', 'ネストヒュドラ'],
      ['loopdragon', 'むげんループドラゴン'],
    ];
    bosses.forEach(([id, name], i) => {
      const done = d.defeatedBosses.includes(id);
      drawText(ctx, `${done ? '☑' : '☐'} ${name}`, 32, 147 + i * 9, done ? '#4cd44c' : '#55557a', 7);
    });
    if (d.cleared) drawText(ctx, '★クリアずみ!', 176, 20, '#f7d51d', 7);

    drawText(ctx, 'キー/タップで もどる', 156, 164, '#8888c0', 7);
  }

  private drawWorldMap(ctx: CanvasRenderingContext2D): void {
    const d = this.game.data;
    drawWindow(ctx, 12, 12, VIEW_W - 24, VIEW_H - 24);
    drawText(ctx, '― せかいの ちず ―', 78, 20, '#f7d51d');

    const nodes = [
      { id: 'area1', x: 52, label: 'へんすうの村' },
      { id: 'area2', x: 128, label: 'ぶんきの森' },
      { id: 'area3', x: 204, label: 'ループのどうくつ' },
    ];
    const ny = 84;

    // つなぐ道(点線)
    ctx.fillStyle = '#c8a05c';
    for (let x = 64; x < 200; x += 8) {
      ctx.fillRect(x, ny + 7, 4, 2);
    }

    for (const node of nodes) {
      const area = AREAS[node.id];
      const unlocked =
        !area.unlockedBy || d.defeatedBosses.includes(area.unlockedBy);

      // ノードのアイコン
      if (node.id === 'area1') {
        // 村: 家
        ctx.fillStyle = '#d43c3c';
        ctx.fillRect(node.x - 8, ny - 8, 16, 7);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(node.x - 6, ny - 1, 12, 9);
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(node.x - 2, ny + 2, 4, 6);
      } else if (node.id === 'area2') {
        // 森: 木
        ctx.fillStyle = '#1e5a34';
        ctx.fillRect(node.x - 8, ny - 6, 16, 10);
        ctx.fillRect(node.x - 5, ny - 10, 10, 6);
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(node.x - 2, ny + 4, 4, 5);
      } else {
        // 洞窟: 山
        ctx.fillStyle = '#6a6a80';
        ctx.beginPath();
        ctx.moveTo(node.x - 10, ny + 8);
        ctx.lineTo(node.x, ny - 10);
        ctx.lineTo(node.x + 10, ny + 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#22222e';
        ctx.fillRect(node.x - 3, ny + 1, 6, 7);
      }

      if (!unlocked) {
        // 未解放: 暗く+カギ
        ctx.fillStyle = 'rgba(10, 10, 24, 0.72)';
        ctx.fillRect(node.x - 12, ny - 12, 24, 22);
        drawText(ctx, '?', node.x - 3, ny - 6, '#8888c0', 10);
      }

      // エリア名
      drawText(
        ctx,
        node.label,
        node.x - node.label.length * 3.5,
        ny + 14,
        unlocked ? '#ffffff' : '#55557a',
        7
      );

      // ボス状態
      const bossId = area.boss?.enemyId;
      if (bossId && unlocked) {
        const done = d.defeatedBosses.includes(bossId);
        drawText(ctx, done ? '☑ボスげきは' : '!ボスがまつ', node.x - 18, ny + 24, done ? '#4cd44c' : '#d43c3c', 7);
      }

      // 現在地マーカー
      if (d.currentArea === node.id) {
        if (Math.floor(this.tick / 400) % 2 === 0) {
          drawText(ctx, '▼', node.x - 4, ny - 26, '#f7d51d');
        }
        drawText(ctx, 'いまここ', node.x - 14, ny + 33, '#f7d51d', 7);
      }
    }

    // 進行度
    const total = Object.values(AREAS).filter((a) => a.boss).length;
    const done = d.defeatedBosses.length;
    drawText(ctx, `ぼうけんの しんこう: ボス ${done}/${total}`, 32, 138, '#c8c8e0');
    const chestsTotal = Object.values(AREAS).reduce((n, a) => n + (a.chests?.length ?? 0), 0);
    drawText(ctx, `たからばこ: ${d.openedChests.length}/${chestsTotal}`, 32, 150, '#c8c8e0');
    if (d.cleared) drawText(ctx, '★でんせつの けんじゃ★', 150, 144, '#f7d51d');

    drawText(ctx, 'なにかキー/タップで もどる', 76, VIEW_H - 22, '#8888c0', 7);
  }
}
