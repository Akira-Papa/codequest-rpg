import type { Scene, Enemy, Question } from '../types';
import type { Game } from '../game';
import { VIEW_W, VIEW_H } from '../constants';
import { QUESTIONS } from '../data/questions';
import { AREAS } from '../data/areas';
import { drawSprite } from '../render/sprites';
import {
  drawWindow,
  drawText,
  drawWrappedText,
  drawHpBar,
  drawBlinkArrow,
  layoutLines,
} from '../render/ui';
import {
  selectQuestion,
  shuffleChoices,
  comboDamage,
  comboMultiplier,
  recordAnswer,
  resolveVictory,
  resolveDefeat,
} from '../core/logic';
import { sfx } from '../core/audio';
import { FieldScene } from './field';

type Phase = 'message' | 'command' | 'question' | 'explain';

interface Msg {
  text: string;
  /** このメッセージが表示された瞬間に鳴らすSE */
  se?: () => void;
}

interface PresentedQuestion {
  q: Question;
  choices: string[];
  answer: number;
}

const WIN_Y = 120; // コマンド/メッセージの下部ウィンドウ
const Q_TOP = 88; // クイズウィンドウ(広め)
const Q_LINE_H = 9;
const SPRITE_SCALE = 5;
const SPRITE_X = (VIEW_W - 16 * SPRITE_SCALE) / 2;
const SPRITE_Y = 22;

/** ボス撃破時の学習マスターメッセージ */
const BOSS_MASTERY: Record<string, string> = {
  nullghost: 'へんすうを マスターした!',
  nesthydra: 'じょうけんぶんきを マスターした!',
  loopdragon: 'ループを マスターした!',
  recursion: 'かんすうを マスターした!',
  kraken: 'はいれつを マスターした!',
};

/** ボス撃破で解放されるエリア名(logic.resolveVictoryに渡す)。最後のボスは記載なし=クリア */
const BOSS_UNLOCKS: Record<string, string> = {
  nullghost: 'じょうけんぶんきの森',
  nesthydra: 'ループのどうくつ',
  loopdragon: 'かんすうの塔',
  recursion: 'はいれつの海',
};

export class BattleScene implements Scene {
  private phase: Phase = 'message';
  private tick = 0;

  private enemyHp: number;
  private asked = new Set<string>();

  private msgs: Msg[] = [];
  private afterMsgs: (() => void) | null = null;

  private cursor = 0;
  private pq: PresentedQuestion | null = null;

  // クイズレイアウト(出題時に折り返し行数から計算)
  private qLines = 0;
  private choicesY = 0;
  private choiceSpacing = 12;

  // ヒント(使うとその一撃のダメージ半減)
  private hintUsed = false;
  private showHint = false;

  private explainCorrect = false;
  private explainLock = 0; // 不正解時の解説強制読了(ms)

  private shakeTimer = 0;
  private flashTimer = 0;
  private lungeTimer = 0; // 敵の攻撃モーション(不正解時)

  // 連続正解コンボ
  private combo = 0;
  private lastDamage = 0;

  // ダメージ数字のポップアップ
  private popups: { text: string; x: number; y: number; age: number; color: string }[] = [];

  private bgGrad: CanvasGradient | null = null;
  private readonly whitePalette: Record<string, string>;

  constructor(
    private game: Game,
    private enemy: Enemy
  ) {
    this.enemyHp = enemy.maxHp;
    this.whitePalette = Object.fromEntries(
      Object.keys(enemy.palette).map((k) => [k, '#ffffff'])
    );

    const intro: Msg[] = [{ text: `${enemy.name}が あらわれた!` }];
    const rec = enemy.recommendLevel;
    if (enemy.isBoss && rec && game.data.player.level < rec) {
      intro.push({
        text: `(すいしょうの こえ: つよてきだ! Lv${rec}いじょうで いどむのが おすすめじゃ…)`,
      });
    }
    // 初めての戦闘: 長老がバトルの流れをガイドする
    if (!game.data.tutorialSeen) {
      game.data.tutorialSeen = true;
      intro.push(
        { text: '(ちょうろうの こえ: おちついて。クイズに せいかいすると こうげきが あたるぞ)' },
        { text: '(こまったら みぎうえの「ヒント」を おすのじゃ。ダメージは はんぶんに なるが かならず ちかづける)' },
        { text: '(まちがえても だいじょうぶ。かいせつを よめば つぎは あたる。それが がくしゅうじゃ!)' }
      );
    }
    this.queueMessages(intro, () => {
      this.phase = 'command';
      this.cursor = 0;
    });
  }

  private queueMessages(msgs: Msg[], after: () => void): void {
    this.msgs = [...msgs];
    this.afterMsgs = after;
    this.phase = 'message';
    this.msgs[0]?.se?.();
  }

  private advanceMessage(): void {
    this.msgs.shift();
    if (this.msgs.length === 0) {
      const cb = this.afterMsgs;
      this.afterMsgs = null;
      cb?.();
    } else {
      this.msgs[0].se?.();
    }
  }

  // ---- 更新 -----------------------------------------------------------------

  update(dt: number): void {
    this.tick += dt;
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.lungeTimer > 0) this.lungeTimer -= dt;
    if (this.explainLock > 0) this.explainLock -= dt;
    for (const pop of this.popups) pop.age += dt;
    this.popups = this.popups.filter((pop) => pop.age < 900);

    const input = this.game.input;

    switch (this.phase) {
      case 'message': {
        if (input.wasPressed('confirm') || input.click) {
          sfx.cursor();
          this.advanceMessage();
        }
        break;
      }
      case 'command': {
        if (input.wasPressed('up', 'down')) {
          this.cursor = 1 - this.cursor;
          sfx.cursor();
        }
        if (input.click) {
          const row = this.commandRowAt(input.click.x, input.click.y);
          if (row >= 0) {
            // 2段階タップ: 1回目で選択、同じ行をもう1回で実行(誤タップ防止)
            if (row === this.cursor) {
              this.execCommand(row);
            } else {
              this.cursor = row;
              sfx.cursor();
            }
            return;
          }
        }
        if (input.wasPressed('confirm')) {
          this.execCommand(this.cursor);
        }
        break;
      }
      case 'question': {
        if (!this.pq) return;

        // ヒント: Hキー or ヒントボタン
        if (input.wasPressed('hint')) {
          this.toggleHint();
        }
        if (input.click && this.hintButtonAt(input.click.x, input.click.y)) {
          this.toggleHint();
          return;
        }

        let answered = -1;
        if (input.wasPressed('1')) answered = 0;
        else if (input.wasPressed('2')) answered = 1;
        else if (input.wasPressed('3')) answered = 2;
        else if (input.wasPressed('4')) answered = 3;

        if (input.wasPressed('up')) {
          this.cursor = (this.cursor + 3) % 4;
          sfx.cursor();
        }
        if (input.wasPressed('down')) {
          this.cursor = (this.cursor + 1) % 4;
          sfx.cursor();
        }
        if (input.wasPressed('confirm')) answered = this.cursor;

        if (input.click) {
          const row = this.choiceRowAt(input.click.x, input.click.y);
          if (row >= 0) {
            if (row === this.cursor) {
              answered = row; // 2タップ目で確定
            } else {
              this.cursor = row;
              sfx.cursor();
            }
          }
        }

        if (answered >= 0 && answered < this.pq.choices.length) {
          this.judge(answered);
        }
        break;
      }
      case 'explain': {
        if (this.explainLock > 0) return; // 強制読了中
        if (input.wasPressed('confirm') || input.click) {
          sfx.cursor();
          this.afterExplain();
        }
        break;
      }
    }
  }

  private execCommand(index: number): void {
    sfx.confirm();
    if (index === 0) {
      this.askQuestion();
    } else {
      this.tryFlee();
    }
  }

  private askQuestion(): void {
    const q = selectQuestion(
      QUESTIONS,
      this.game.data.stats,
      this.enemy.categories,
      this.enemy.difficulty,
      this.asked,
      Math.random
    );
    this.asked.add(q.id);
    const shuffled = shuffleChoices(q, Math.random);
    this.pq = { q, choices: shuffled.choices, answer: shuffled.answer };
    this.cursor = 0;
    this.hintUsed = false;
    this.showHint = false;

    // レイアウト計算: 問題文の折り返し行数から選択肢の位置と行間を決める
    this.qLines = layoutLines(this.game.ctx, q.text, VIEW_W - 32).length;
    this.choicesY = Q_TOP + 5 + this.qLines * Q_LINE_H + 3;
    const available = VIEW_H - 6 - 2 - this.choicesY;
    this.choiceSpacing = Math.max(10, Math.min(15, Math.floor(available / 4)));
    this.phase = 'question';
  }

  private judge(answered: number): void {
    if (!this.pq) return;
    const correct = answered === this.pq.answer;
    recordAnswer(this.game.data.stats, this.pq.q.id, correct);

    if (correct) {
      this.combo += 1;
      if (this.combo > this.game.data.bestCombo) {
        this.game.data.bestCombo = this.combo;
      }
      let dmg = comboDamage(this.game.data.player.level, this.combo);
      if (this.hintUsed) dmg = Math.max(1, Math.floor(dmg / 2));
      this.lastDamage = dmg;
      this.enemyHp = Math.max(0, this.enemyHp - dmg);
      sfx.correct();
      sfx.hit();
      this.shakeTimer = 350;
      this.flashTimer = 250;
      this.popups.push({
        text: `-${dmg}`,
        x: SPRITE_X + 40 + (Math.random() - 0.5) * 20,
        y: SPRITE_Y + 20,
        age: 0,
        color: this.combo >= 3 ? '#f7d51d' : '#ffffff',
      });
      this.explainCorrect = true;
      this.explainLock = 0;
    } else {
      this.combo = 0;
      const p = this.game.data.player;
      p.hp = Math.max(0, p.hp - this.enemy.attack);
      sfx.wrong();
      this.lungeTimer = 400; // 敵が襲いかかるモーション
      this.popups.push({
        text: `-${this.enemy.attack}`,
        x: VIEW_W - 46,
        y: 46,
        age: 0,
        color: '#d43c3c',
      });
      this.explainCorrect = false;
      this.explainLock = 1500;
    }
    this.phase = 'explain';
  }

  private afterExplain(): void {
    this.pq = null;
    const p = this.game.data.player;

    if (this.enemyHp <= 0) {
      this.onVictory();
      return;
    }
    if (p.hp <= 0) {
      this.onDefeat();
      return;
    }
    this.phase = 'command';
    this.cursor = 0;
  }

  private tryFlee(): void {
    if (this.enemy.isBoss) {
      this.queueMessages([{ text: `${this.enemy.name}に まわりこまれてしまった!` }], () => {
        this.phase = 'command';
      });
      return;
    }
    if (Math.random() < 0.5) {
      this.queueMessages([{ text: 'うまく にげきれた!' }], () => {
        this.game.saveNow();
        this.game.changeScene(new FieldScene(this.game));
      });
    } else {
      const p = this.game.data.player;
      p.hp = Math.max(0, p.hp - this.enemy.attack);
      this.queueMessages(
        [
          {
            text: `にげられなかった! ${this.enemy.name}の こうげき! ${this.enemy.attack}の ダメージ!`,
            se: sfx.wrong,
          },
        ],
        () => {
          if (p.hp <= 0) {
            this.onDefeat();
          } else {
            this.phase = 'command';
          }
        }
      );
    }
  }

  private onVictory(): void {
    const p = this.game.data.player;
    const beforeLevel = p.level;
    const result = resolveVictory(this.game.data, this.enemy, BOSS_UNLOCKS);

    const msgs: Msg[] = [
      { text: `${this.enemy.name}を たおした!` },
      { text: `けいけんち ${this.enemy.exp}ポイント かくとく!` },
    ];
    if (result.levelUps > 0) {
      msgs.push({
        text: `レベルアップ! Lv${beforeLevel} → Lv${p.level}! さいだいHPが ${p.maxHp}に あがった! HPぜんかいふく!`,
        se: sfx.levelup,
      });
    }
    if (this.enemy.isBoss && BOSS_MASTERY[this.enemy.id]) {
      msgs.push({ text: BOSS_MASTERY[this.enemy.id], se: sfx.fanfare });
    }
    if (result.unlockedAreaName) {
      msgs.push({
        text: `「${result.unlockedAreaName}」への みちが ひらかれた! HPが ぜんかいふくした!`,
        se: sfx.heal,
      });
    }
    if (result.cleared) {
      msgs.push(
        { text: 'せかいに へいわが もどった!' },
        { text: 'おめでとう! きみは JavaScriptきほんの けんじゃに なった!' },
        { text: 'これからも ぼうけん(がくしゅう)は つづく…' }
      );
    }

    this.queueMessages(msgs, () => {
      this.game.saveNow();
      this.game.changeScene(new FieldScene(this.game));
    });
  }

  private onDefeat(): void {
    this.queueMessages(
      [
        { text: 'めのまえが まっくらに なった…' },
        { text: 'きがつくと 村に もどっていた。(けいけんちは そのまま!)' },
      ],
      () => {
        resolveDefeat(this.game.data, AREAS.area1.spawn);
        this.game.saveNow();
        this.game.changeScene(new FieldScene(this.game));
      }
    );
  }

  private toggleHint(): void {
    if (!this.pq) return;
    sfx.cursor();
    this.showHint = !this.showHint;
    if (this.showHint) this.hintUsed = true; // 一度でも見たら半減
  }

  // ---- ヒットテスト(描画座標から導出) --------------------------------------

  /** ヒントボタン(出題ウィンドウ右上)の領域 */
  private hintButtonAt(x: number, y: number): boolean {
    return x >= VIEW_W - 66 && x <= VIEW_W - 6 && y >= Q_TOP - 15 && y < Q_TOP - 1;
  }

  /** コマンド行(0=たたかう, 1=にげる)。ヒットしなければ-1 */
  private commandRowAt(x: number, y: number): number {
    if (x < 4 || x > 92) return -1;
    for (let i = 0; i < 2; i++) {
      const ry = WIN_Y + 14 + i * 18;
      if (y >= ry && y < ry + 18) return i;
    }
    return -1;
  }

  /** 選択肢の行。ヒットしなければ-1 */
  private choiceRowAt(x: number, y: number): number {
    if (!this.pq) return -1;
    if (x < 8 || x > VIEW_W - 8) return -1;
    for (let i = 0; i < this.pq.choices.length; i++) {
      const ry = this.choicesY + i * this.choiceSpacing;
      if (y >= ry - 1 && y < ry + this.choiceSpacing - 1) return i;
    }
    return -1;
  }

  // ---- 描画 -----------------------------------------------------------------

  draw(ctx: CanvasRenderingContext2D): void {
    // 背景(エリアの空気感)。グラデーションは初回のみ生成
    if (!this.bgGrad) {
      const area = AREAS[this.game.data.currentArea];
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, area?.skyColor ?? '#16213e');
      grad.addColorStop(1, '#0a0a18');
      this.bgGrad = grad;
    }
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 104, VIEW_W, VIEW_H - 104);

    // 敵スプライト(呼吸アニメ+シェイク+攻撃モーション)
    let ex = SPRITE_X;
    let ey = SPRITE_Y + Math.round(Math.sin(this.tick / 280) * 2);
    if (this.shakeTimer > 0) {
      ex += Math.round((Math.random() - 0.5) * 6);
      ey += Math.round((Math.random() - 0.5) * 4);
    }
    if (this.lungeTimer > 0) {
      // 0→1→0 の山なりでプレイヤー(右下のステータス窓)方向へ踏み込む
      const t = 1 - Math.abs(this.lungeTimer / 200 - 1);
      ex += Math.round(t * 24);
      ey += Math.round(t * 10);
    }
    if (this.enemyHp > 0) {
      const palette =
        this.flashTimer > 0 && Math.floor(this.tick / 60) % 2 === 0
          ? this.whitePalette
          : this.enemy.palette;
      drawSprite(ctx, this.enemy.sprite, palette, ex, ey, SPRITE_SCALE);
    }

    // 敵の名前+HPバー+HP数値
    if (this.enemyHp > 0) {
      const nameW = this.enemy.name.length * 8 + 92;
      const wx = (VIEW_W - nameW) / 2;
      drawWindow(ctx, wx, 2, nameW, 16);
      drawText(ctx, this.enemy.name, wx + 6, 6, this.enemy.isBoss ? '#f7d51d' : '#ffffff');
      drawHpBar(ctx, wx + nameW - 82, 8, 36, this.enemyHp, this.enemy.maxHp);
      drawText(ctx, `${this.enemyHp}/${this.enemy.maxHp}`, wx + nameW - 42, 5, '#c8c8e0', 7);
    }

    // プレイヤーステータス(右上)。被弾直後は赤くフラッシュ
    const p = this.game.data.player;
    drawWindow(ctx, VIEW_W - 78, 20, 76, 40);
    if (this.lungeTimer > 100 && this.lungeTimer < 300 && Math.floor(this.tick / 70) % 2 === 0) {
      ctx.fillStyle = 'rgba(212, 60, 60, 0.35)';
      ctx.fillRect(VIEW_W - 76, 22, 72, 36);
    }
    drawText(ctx, `ゆうしゃ Lv${p.level}`, VIEW_W - 72, 25, '#f7d51d');
    drawText(ctx, `HP ${p.hp}/${p.maxHp}`, VIEW_W - 72, 36);
    drawHpBar(ctx, VIEW_W - 72, 48, 64, p.hp, p.maxHp);

    // コンボ表示(2連続以上のとき)
    if (this.combo >= 2) {
      drawText(ctx, `${this.combo}コンボ! x${comboMultiplier(this.combo)}`, VIEW_W - 76, 64, '#f7d51d', 7);
    }

    // ダメージ数字ポップアップ(ふわっと上がって消える)
    for (const pop of this.popups) {
      const alpha = 1 - pop.age / 900;
      ctx.globalAlpha = Math.max(0, alpha);
      drawText(ctx, pop.text, pop.x, pop.y - pop.age * 0.02, pop.color, 10);
      ctx.globalAlpha = 1;
    }

    switch (this.phase) {
      case 'message':
        this.drawMessageWindow(ctx);
        break;
      case 'command':
        this.drawCommandWindow(ctx);
        break;
      case 'question':
        this.drawQuestionWindow(ctx);
        break;
      case 'explain':
        this.drawExplainWindow(ctx);
        break;
    }
  }

  private drawMessageWindow(ctx: CanvasRenderingContext2D): void {
    drawWindow(ctx, 4, WIN_Y, VIEW_W - 8, VIEW_H - WIN_Y - 4);
    if (this.msgs.length > 0) {
      drawWrappedText(ctx, this.msgs[0].text, 14, WIN_Y + 12, VIEW_W - 32, 11);
    }
    drawBlinkArrow(ctx, VIEW_W - 20, VIEW_H - 16, this.tick);
  }

  private drawCommandWindow(ctx: CanvasRenderingContext2D): void {
    drawWindow(ctx, 4, WIN_Y, 88, VIEW_H - WIN_Y - 4);
    drawText(ctx, 'たたかう', 26, WIN_Y + 18);
    drawText(ctx, 'にげる', 26, WIN_Y + 36);
    drawText(ctx, '▶', 14, WIN_Y + 18 + this.cursor * 18, '#f7d51d');

    drawWindow(ctx, 96, WIN_Y, VIEW_W - 100, VIEW_H - WIN_Y - 4);
    drawWrappedText(
      ctx,
      'クイズに せいかいすると こうげきできる!',
      104,
      WIN_Y + 16,
      VIEW_W - 116,
      11,
      '#c8c8e0'
    );
  }

  private drawQuestionWindow(ctx: CanvasRenderingContext2D): void {
    if (!this.pq) return;
    drawText(ctx, '1-4キー/タップ', 8, Q_TOP - 10, '#8888c0', 7);

    // ヒントボタン(右上)
    drawWindow(ctx, VIEW_W - 66, Q_TOP - 15, 60, 14);
    drawText(
      ctx,
      this.showHint ? 'とじる(H)' : 'ヒント(H)',
      VIEW_W - 60,
      Q_TOP - 11,
      this.hintUsed ? '#f7d51d' : '#4cd44c',
      7
    );

    drawWindow(ctx, 4, Q_TOP, VIEW_W - 8, VIEW_H - Q_TOP - 4);

    drawWrappedText(ctx, this.pq.q.text, 14, Q_TOP + 5, VIEW_W - 32, Q_LINE_H, '#ffffff');

    for (let i = 0; i < this.pq.choices.length; i++) {
      const y = this.choicesY + i * this.choiceSpacing;
      const selected = i === this.cursor;
      if (selected) {
        ctx.fillStyle = 'rgba(247, 213, 29, 0.12)';
        ctx.fillRect(8, y - 1, VIEW_W - 16, this.choiceSpacing - 2);
        drawText(ctx, '▶', 12, y, '#f7d51d');
      }
      drawText(ctx, `${i + 1}:`, 22, y, '#8888c0');
      drawText(ctx, this.pq.choices[i], 38, y, selected ? '#f7d51d' : '#ffffff');
    }

    // ヒント表示(敵エリアに重ねる。ダメージ半減の説明つき)
    if (this.showHint) {
      drawWindow(ctx, 8, 20, VIEW_W - 96, 62);
      drawText(ctx, '▼ヒント (このこうげきは ダメージはんぶん)', 14, 25, '#f7d51d', 7);
      drawWrappedText(ctx, this.pq.q.hint, 14, 36, VIEW_W - 112, 10, '#ffffff', 7);
    }
  }

  private drawExplainWindow(ctx: CanvasRenderingContext2D): void {
    if (!this.pq) return;
    const top = Q_TOP;
    drawWindow(ctx, 4, top, VIEW_W - 8, VIEW_H - top - 4);

    if (this.explainCorrect) {
      const comboText = this.combo >= 2 ? ` ${this.combo}れんぞく せいかい!` : '';
      drawText(ctx, `○ せいかい!${comboText}`, 14, top + 8, '#4cd44c', 10);
      const notes = [
        this.combo >= 2 ? `x${comboMultiplier(this.combo)}` : '',
        this.hintUsed ? 'ヒントで はんぶん' : '',
      ].filter(Boolean);
      drawText(
        ctx,
        `${this.enemy.name}に ${this.lastDamage}の ダメージ!${notes.length ? ` (${notes.join('/')})` : ''}`,
        14,
        top + 22,
        this.combo >= 3 ? '#f7d51d' : '#ffffff'
      );
    } else {
      drawText(ctx, '× ざんねん!', 14, top + 8, '#d43c3c', 10);
      drawText(
        ctx,
        `${this.enemy.name}の はんげき! ${this.enemy.attack}の ダメージ!`,
        14,
        top + 22,
        '#ffffff'
      );
    }
    drawWrappedText(ctx, this.pq.q.explanation, 14, top + 36, VIEW_W - 32, 10, '#c8c8e0');

    if (this.explainLock <= 0) {
      drawBlinkArrow(ctx, VIEW_W - 20, VIEW_H - 16, this.tick);
    }
  }
}
