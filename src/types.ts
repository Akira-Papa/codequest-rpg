export type Category = 'variable' | 'condition' | 'loop' | 'function' | 'array';

export interface Question {
  id: string;
  category: Category;
  difficulty: 1 | 2 | 3;
  text: string;
  choices: string[];
  answer: number;
  explanation: string;
  /** 答えそのものではなく考え方を示すヒント(ヒント使用時はダメージ半減) */
  hint: string;
}

export interface LessonPage {
  text: string;
  /** ページ下部で再生するアニメーションデモのid(render/demos.ts) */
  demo?: string;
}

export interface Lesson {
  id: string;
  title: string;
  category: Category;
  /** まなびの石碑で表示するページ(1ページ=1メッセージウィンドウ) */
  pages: LessonPage[];
}

export interface Enemy {
  id: string;
  name: string;
  sprite: string[];
  palette: Record<string, string>;
  maxHp: number;
  attack: number;
  categories: Category[];
  difficulty: [number, number];
  exp: number;
  isBoss?: boolean;
  /** ボス戦の推奨レベル(未満で挑むと警告が出る) */
  recommendLevel?: number;
}

export interface AreaExit {
  x: number;
  y: number;
  to: string;       // 行き先エリアid
  spawnX: number;   // 行き先での出現位置
  spawnY: number;
}

export interface Chest {
  id: string;
  x: number;
  y: number;
  exp: number; // 開けたときの経験値ボーナス(+HP全回復)
}

export interface Area {
  id: string;
  name: string;
  map: string[];              // 16文字 x 12行
  encounters: { enemyId: string; weight: number }[];
  encounterRate: number;      // 草タイル1歩あたりの遭遇率
  boss?: { enemyId: string; x: number; y: number };
  unlockedBy?: string;        // このボスを倒すと入れる
  exits: AreaExit[];
  spawn: { x: number; y: number };
  skyColor: string;           // バトル背景色
  chests?: Chest[];           // ちしきのたからばこ
}

export interface QuestionStat {
  asked: number;
  correct: number;
  wrongCount: number;
}

export interface SaveData {
  version: 1;
  player: {
    level: number;
    exp: number;
    maxHp: number;
    hp: number;
    x: number;
    y: number;
  };
  unlockedAreas: string[];
  currentArea: string;
  defeatedBosses: string[];
  stats: Record<string, QuestionStat>;
  cleared: boolean;
  /** 勝利した戦闘の回数 */
  battleWins: number;
  /** 連続正解コンボの最高記録 */
  bestCombo: number;
  /** 開封済みの宝箱id */
  openedChests: string[];
  /** 読んだレッスンid */
  readLessons: string[];
  /** 初回戦闘チュートリアルを見たか */
  tutorialSeen: boolean;
}

export interface Scene {
  onEnter?(): void;
  onExit?(): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
}
