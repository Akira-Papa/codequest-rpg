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
  ELDER,
  ELDER_PALETTE,
} from '../render/sprites';
import { drawDemo } from '../render/demos';
import { drawAmbient, drawVignette, drawShadow, type AmbientTheme } from '../render/fx';

const AREA_THEME: Record<string, AmbientTheme> = {
  area1: 'grass',
  area2: 'forest',
  area3: 'cave',
  area4: 'tower',
  area5: 'sea',
};
import { drawWindow, drawText, drawWrappedText, drawHpBar } from '../render/ui';
import { pickWeighted, gainExp, expForNext, attackForLevel } from '../core/logic';
import { sfx } from '../core/audio';
import { LESSONS, LESSON_FOR_AREA, lessonById } from '../data/lessons';
import { BattleScene } from './battle';
import { TitleScene } from './title';

type Dir = 'up' | 'down' | 'left' | 'right';
type MenuView = 'main' | 'status' | 'map' | 'learn' | 'lesson';

const MOVE_MS = 160;

const MENU_ITEMS = ['つよさ', 'まなぶ', 'ちず', 'タイトルへ', 'とじる'] as const;
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
  ['function', 'かんすう'],
  ['array', 'はいれつ'],
];

const BOSS_LIST: [string, string][] = [
  ['nullghost', 'ヌルポインタゴースト'],
  ['nesthydra', 'ネストヒュドラ'],
  ['loopdragon', 'むげんループドラゴン'],
  ['recursion', 'リカージョン'],
  ['kraken', 'はいれつクラーケン'],
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
  // レッスンビューアの状態
  private lessonId: string | null = null;
  private lessonPage = 0;
  private lessonFrom: 'menu' | 'stone' = 'menu';

  constructor(private game: Game) {
    this.area = AREAS[this.game.data.currentArea] ?? AREAS.area1;
    // このエリアのレッスンが未読なら石碑へ誘導する
    const lessonId = LESSON_FOR_AREA[this.area.id];
    if (lessonId && !this.game.data.readLessons.includes(lessonId)) {
      this.showMessage('ひかる「まなびの石碑」で まなんでから たたかうと よいぞ!', 3600);
    }
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

  /** 石碑またはメニューからレッスンを開く */
  private openLesson(lessonId: string, from: 'menu' | 'stone'): void {
    sfx.confirm();
    this.lessonId = lessonId;
    this.lessonPage = 0;
    this.lessonFrom = from;
    this.menu = { view: 'lesson', cursor: 0 };
  }

  private finishLesson(): void {
    if (this.lessonId && !this.game.data.readLessons.includes(this.lessonId)) {
      this.game.data.readLessons.push(this.lessonId);
      sfx.heal();
      this.game.saveNow();
    }
    if (this.lessonFrom === 'stone') {
      this.menu = null;
      this.showMessage('「まなんだ!」メニューの「まなぶ」から いつでも よみかえせるぞ。', 3600);
    } else {
      this.menu = { view: 'learn', cursor: 0 };
    }
    this.lessonId = null;
  }

  /** レッスンが読める状態か(エリア解放済みなら読める) */
  private lessonUnlocked(lessonId: string): boolean {
    const areaId = Object.entries(LESSON_FOR_AREA).find(([, l]) => l === lessonId)?.[0];
    if (!areaId) return false;
    const area = AREAS[areaId];
    return !area.unlockedBy || this.game.data.defeatedBosses.includes(area.unlockedBy);
  }

  private updateMenu(): void {
    const input = this.game.input;
    const menu = this.menu!;

    if (menu.view === 'lesson') {
      const lesson = this.lessonId ? lessonById(this.lessonId) : undefined;
      if (!lesson) {
        this.menu = { view: 'main', cursor: 0 };
        return;
      }
      if (input.wasPressed('cancel')) {
        sfx.cursor();
        this.finishLesson();
        return;
      }
      if (input.wasPressed('confirm', 'right') || input.click) {
        sfx.cursor();
        if (this.lessonPage < lesson.pages.length - 1) {
          this.lessonPage += 1;
        } else {
          this.finishLesson();
        }
        return;
      }
      if (input.wasPressed('left') && this.lessonPage > 0) {
        sfx.cursor();
        this.lessonPage -= 1;
      }
      return;
    }

    if (menu.view === 'learn') {
      if (input.wasPressed('cancel')) {
        sfx.cursor();
        menu.view = 'main';
        return;
      }
      if (input.wasPressed('up')) {
        menu.cursor = (menu.cursor + LESSONS.length - 1) % LESSONS.length;
        sfx.cursor();
      }
      if (input.wasPressed('down')) {
        menu.cursor = (menu.cursor + 1) % LESSONS.length;
        sfx.cursor();
      }
      let chosen = -1;
      if (input.wasPressed('confirm')) chosen = menu.cursor;
      if (input.click) {
        const row = Math.floor((input.click.y - 48) / 15);
        if (row >= 0 && row < LESSONS.length) {
          if (row === menu.cursor) chosen = row;
          else {
            menu.cursor = row;
            sfx.cursor();
          }
        } else {
          sfx.cursor();
          menu.view = 'main';
          return;
        }
      }
      if (chosen >= 0) {
        const lesson = LESSONS[chosen];
        if (this.lessonUnlocked(lesson.id)) {
          this.openLesson(lesson.id, 'menu');
        } else {
          sfx.wrong();
        }
      }
      return;
    }

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
      case 'まなぶ':
        this.menu = { view: 'learn', cursor: 0 };
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

    // まなびの石碑
    if (tile === 'L') {
      const lessonId = LESSON_FOR_AREA[this.area.id];
      if (lessonId) this.openLesson(lessonId, 'stone');
      return;
    }

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

    // 未読レッスンの石碑を光らせて誘導
    const areaLesson = LESSON_FOR_AREA[this.area.id];
    if (areaLesson && !this.game.data.readLessons.includes(areaLesson)) {
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          if (map[y][x] !== 'L') continue;
          if (Math.floor(this.tick / 350) % 2 === 0) {
            drawText(ctx, '!', x * TILE + 6, y * TILE - 9, '#f7d51d', 10);
          }
          ctx.fillStyle = 'rgba(247, 213, 29, 0.18)';
          ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
        }
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

    // ボスシンボル(落ち影つき)
    const boss = this.area.boss;
    if (boss && !this.game.data.defeatedBosses.includes(boss.enemyId)) {
      const e = ENEMIES[boss.enemyId];
      const bob = Math.floor(this.tick / 400) % 2;
      drawShadow(ctx, boss.x * TILE + 8, boss.y * TILE + 15, 13);
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
    drawShadow(ctx, px + 8, py + 15, 11);
    drawSprite(ctx, sprite, HERO_PALETTE, px, py + bounce, 1, flip);

    // 空気感: エリア別パーティクル+ビネット
    drawAmbient(ctx, AREA_THEME[this.area.id] ?? 'grass', this.tick);
    drawVignette(ctx, 0.4);

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
      switch (this.menu.view) {
        case 'main':
          this.drawMainMenu(ctx);
          break;
        case 'status':
          this.drawStatus(ctx);
          break;
        case 'map':
          this.drawWorldMap(ctx);
          break;
        case 'learn':
          this.drawLearnList(ctx);
          break;
        case 'lesson':
          this.drawLesson(ctx);
          break;
      }
    }
  }

  private drawLearnList(ctx: CanvasRenderingContext2D): void {
    drawWindow(ctx, 28, 24, VIEW_W - 56, 130);
    drawText(ctx, '― まなびの しょ ―', 74, 32, '#4cd44c');
    LESSONS.forEach((lesson, i) => {
      const y = 48 + i * 15;
      const unlocked = this.lessonUnlocked(lesson.id);
      const read = this.game.data.readLessons.includes(lesson.id);
      if (i === this.menu!.cursor) drawText(ctx, '▶', 36, y, '#f7d51d');
      drawText(
        ctx,
        unlocked ? lesson.title : '???(エリアかいほうで よめる)',
        48,
        y,
        !unlocked ? '#55557a' : i === this.menu!.cursor ? '#f7d51d' : '#ffffff'
      );
      if (read) drawText(ctx, '☑', VIEW_W - 48, y, '#4cd44c');
    });
    drawText(ctx, 'Enter/タップで よむ  Esc/Xで もどる', 48, 140, '#8888c0', 7);
  }

  private drawLesson(ctx: CanvasRenderingContext2D): void {
    const lesson = this.lessonId ? lessonById(this.lessonId) : undefined;
    if (!lesson) return;
    const page = lesson.pages[this.lessonPage];
    drawWindow(ctx, 12, 18, VIEW_W - 24, VIEW_H - 34);

    // 長老が教えてくれる
    drawSprite(ctx, ELDER, ELDER_PALETTE, 18, 22, 2);
    drawText(ctx, `ちょうろう「${lesson.title}」`, 54, 28, '#f7d51d');
    drawText(ctx, `${this.lessonPage + 1}/${lesson.pages.length}`, VIEW_W - 52, 28, '#8888c0');

    drawWrappedText(ctx, page.text, 22, 58, VIEW_W - 44, 11);

    // アニメーションデモ
    if (page.demo) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(20, 112, VIEW_W - 40, 50);
      drawDemo(ctx, page.demo, 22, 114, this.tick);
    }

    const last = this.lessonPage === lesson.pages.length - 1;
    drawText(
      ctx,
      last ? 'Enter/タップで おわる' : 'Enter/タップで つぎへ (←で もどる)',
      22,
      VIEW_H - 26,
      '#8888c0',
      7
    );
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
    if (d.cleared) drawText(ctx, '★', 208, 20, '#f7d51d');

    drawText(ctx, `レベル: ${p.level}`, 32, 34);
    drawText(ctx, `HP: ${p.hp}/${p.maxHp}`, 130, 34);
    drawText(ctx, `こうげき: ${attackForLevel(p.level)}`, 32, 46);
    drawText(ctx, `つぎのLvまで: あと${expForNext(p.level) - p.exp}`, 130, 46);
    drawText(ctx, `たたかいの かち: ${d.battleWins}回`, 32, 58);
    drawText(ctx, `さいこうコンボ: ${d.bestCombo}`, 130, 58);

    drawText(ctx, '― がくしゅうの きろく ―', 58, 74, '#4cd44c');
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
      const y = 86 + i * 10;
      const rate = asked > 0 ? Math.round((correct / asked) * 100) : null;
      drawText(ctx, label, 32, y, '#ffffff', 7);
      drawText(
        ctx,
        rate === null ? 'まだ みとうの りょういき' : `せいかいりつ ${rate}%  (${correct}/${asked})`,
        92,
        y,
        rate === null ? '#55557a' : rate >= 80 ? '#4cd44c' : rate >= 50 ? '#f7d51d' : '#d43c3c',
        7
      );
    });

    drawText(ctx, '― たおした ボス ―', 70, 138, '#d43c3c');
    BOSS_LIST.forEach(([id, name], i) => {
      const done = d.defeatedBosses.includes(id);
      const col = i < 3 ? 0 : 1;
      const row = i < 3 ? i : i - 3;
      drawText(
        ctx,
        `${done ? '☑' : '☐'} ${name}`,
        col === 0 ? 30 : 134,
        149 + row * 9,
        done ? '#4cd44c' : '#55557a',
        6
      );
    });

    drawText(ctx, 'キー/タップで もどる', 148, 168, '#8888c0', 7);
  }

  /** 点線の道を描く */
  private dottedPath(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.floor(dist / 8);
    ctx.fillStyle = '#c8a05c';
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      ctx.fillRect(Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), 3, 2);
    }
  }

  private drawWorldMap(ctx: CanvasRenderingContext2D): void {
    const d = this.game.data;
    drawWindow(ctx, 12, 12, VIEW_W - 24, VIEW_H - 24);
    drawText(ctx, '― せかいの ちず ―', 78, 18, '#f7d51d');

    const nodes = [
      { id: 'area1', x: 48, y: 58, label: 'へんすうの村' },
      { id: 'area2', x: 126, y: 58, label: 'ぶんきの森' },
      { id: 'area3', x: 204, y: 58, label: 'ループのどうくつ' },
      { id: 'area4', x: 90, y: 112, label: 'かんすうの塔' },
      { id: 'area5', x: 178, y: 112, label: 'はいれつの海' },
    ];

    // つなぐ道(点線): 村→森→洞窟、洞窟→塔→海
    this.dottedPath(ctx, 60, 62, 114, 62);
    this.dottedPath(ctx, 138, 62, 192, 62);
    this.dottedPath(ctx, 198, 70, 104, 108);
    this.dottedPath(ctx, 104, 116, 164, 116);

    for (const node of nodes) {
      const area = AREAS[node.id];
      const ny = node.y;
      const unlocked = !area.unlockedBy || d.defeatedBosses.includes(area.unlockedBy);

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
      } else if (node.id === 'area3') {
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
      } else if (node.id === 'area4') {
        // 塔
        ctx.fillStyle = '#8a8aa8';
        ctx.fillRect(node.x - 5, ny - 10, 10, 18);
        ctx.fillRect(node.x - 7, ny - 10, 3, 4);
        ctx.fillRect(node.x + 4, ny - 10, 3, 4);
        ctx.fillStyle = '#4a3a70';
        ctx.fillRect(node.x - 2, ny + 2, 4, 6);
      } else {
        // 海: 波
        ctx.fillStyle = '#3c5cd4';
        ctx.fillRect(node.x - 10, ny - 4, 20, 10);
        ctx.fillStyle = '#7c9cf0';
        const ph = Math.floor(this.tick / 500) % 2;
        ctx.fillRect(node.x - 8 + ph * 2, ny - 2, 6, 1);
        ctx.fillRect(node.x + 2 - ph * 2, ny + 2, 6, 1);
      }

      if (!unlocked) {
        ctx.fillStyle = 'rgba(10, 10, 24, 0.72)';
        ctx.fillRect(node.x - 12, ny - 12, 24, 22);
        drawText(ctx, '?', node.x - 3, ny - 6, '#8888c0', 10);
      }

      drawText(
        ctx,
        node.label,
        node.x - node.label.length * 3.5,
        ny + 12,
        unlocked ? '#ffffff' : '#55557a',
        7
      );

      const bossId = area.boss?.enemyId;
      if (bossId && unlocked) {
        const done = d.defeatedBosses.includes(bossId);
        drawText(ctx, done ? '☑ボスげきは' : '!ボスがまつ', node.x - 18, ny + 21, done ? '#4cd44c' : '#d43c3c', 6);
      }

      if (d.currentArea === node.id) {
        if (Math.floor(this.tick / 400) % 2 === 0) {
          drawText(ctx, '▼', node.x - 4, ny - 24, '#f7d51d');
        }
        drawText(ctx, 'いまここ', node.x - 14, ny + 29, '#f7d51d', 6);
      }
    }

    // 進行度
    const total = Object.values(AREAS).filter((a) => a.boss).length;
    const done = d.defeatedBosses.length;
    drawText(ctx, `ボス ${done}/${total}`, 30, 152, '#c8c8e0', 7);
    const chestsTotal = Object.values(AREAS).reduce((n, a) => n + (a.chests?.length ?? 0), 0);
    drawText(ctx, `たからばこ ${d.openedChests.length}/${chestsTotal}`, 84, 152, '#c8c8e0', 7);
    drawText(ctx, `レッスン ${d.readLessons.length}/${LESSONS.length}`, 160, 152, '#c8c8e0', 7);
    if (d.cleared) drawText(ctx, '★でんせつの けんじゃ★', 82, 28, '#f7d51d', 7);

    drawText(ctx, 'なにかキー/タップで もどる', 76, VIEW_H - 22, '#8888c0', 7);
  }
}
