import type { Question, QuestionStat, SaveData, Enemy } from '../types';

/** 次のレベルに必要な経験値 */
export function expForNext(level: number): number {
  return Math.ceil(20 * Math.pow(level, 1.5));
}

/** レベルに応じた最大HP */
export function maxHpForLevel(level: number): number {
  return 30 + (level - 1) * 5;
}

/** 正解1回で敵に与えるダメージ */
export function attackForLevel(level: number): number {
  return 10 + level;
}

/** 間違えた問題ほど出やすくする重み(間隔反復の簡易実装) */
export function questionWeight(stat: QuestionStat | undefined): number {
  return 1 + (stat?.wrongCount ?? 0) * 2;
}

/** 重み付きランダム選択。weightsは正の数を想定 */
export function pickWeighted<T>(items: T[], weights: number[], rand: () => number): T {
  if (items.length === 0) throw new Error('pickWeighted: empty items');
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return items[0];
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * 敵の出題条件(分野・難易度帯)に合う問題を、
 * 間違い回数の重み付きで1問選ぶ。excludeは同一バトル内の出題済み問題。
 */
export function selectQuestion(
  pool: Question[],
  stats: Record<string, QuestionStat>,
  categories: string[],
  difficulty: [number, number],
  exclude: Set<string>,
  rand: () => number
): Question {
  let candidates = pool.filter(
    (q) =>
      categories.includes(q.category) &&
      q.difficulty >= difficulty[0] &&
      q.difficulty <= difficulty[1] &&
      !exclude.has(q.id)
  );
  // 全部出題済みなら除外を解除して再抽選
  if (candidates.length === 0) {
    candidates = pool.filter(
      (q) =>
        categories.includes(q.category) &&
        q.difficulty >= difficulty[0] &&
        q.difficulty <= difficulty[1]
    );
  }
  if (candidates.length === 0) {
    candidates = pool;
  }
  const weights = candidates.map((q) => questionWeight(stats[q.id]));
  return pickWeighted(candidates, weights, rand);
}

/**
 * 選択肢をシャッフルして表示順と正解位置を返す。
 * (問題データは正解を先頭に置く規約なので、出題時に必ず混ぜる)
 */
export function shuffleChoices(
  q: Question,
  rand: () => number
): { choices: string[]; answer: number } {
  const idx = q.choices.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { choices: idx.map((i) => q.choices[i]), answer: idx.indexOf(q.answer) };
}

/**
 * 経験値を加算しレベルアップ処理を行う。上がったレベル数を返す。
 * expは「現在レベル内での蓄積」方式。
 */
export function gainExp(player: { level: number; exp: number; maxHp: number; hp: number }, amount: number): number {
  player.exp += amount;
  let ups = 0;
  while (player.exp >= expForNext(player.level)) {
    player.exp -= expForNext(player.level);
    player.level += 1;
    ups += 1;
  }
  if (ups > 0) {
    player.maxHp = maxHpForLevel(player.level);
    player.hp = player.maxHp; // レベルアップで全回復
  }
  return ups;
}

/** 回答結果を学習統計に記録する(間隔反復の重みの源泉) */
export function recordAnswer(stats: SaveData['stats'], questionId: string, correct: boolean): void {
  const s = (stats[questionId] ??= { asked: 0, correct: 0, wrongCount: 0 });
  s.asked += 1;
  if (correct) {
    s.correct += 1;
    // 正解できたら再出題の重みを減衰させる
    s.wrongCount = Math.max(0, s.wrongCount - 1);
  } else {
    s.wrongCount += 1;
  }
}

export interface VictoryResult {
  levelUps: number;
  unlockedAreaName: string | null;
  cleared: boolean;
}

/**
 * 勝利時の進行処理: 経験値・レベルアップ・ボス撃破によるエリア解放・クリア判定。
 * セーブデータを直接更新し、演出に必要な情報を返す(純ロジック・描画なし)。
 */
export function resolveVictory(
  data: SaveData,
  enemy: Pick<Enemy, 'id' | 'exp' | 'isBoss'>,
  unlockNames: Record<string, string>
): VictoryResult {
  const levelUps = gainExp(data.player, enemy.exp);
  let unlockedAreaName: string | null = null;
  let cleared = false;

  if (enemy.isBoss && !data.defeatedBosses.includes(enemy.id)) {
    data.defeatedBosses.push(enemy.id);
    // ボス撃破のごほうび: HP全回復(遠征後の回復導線)
    data.player.hp = data.player.maxHp;
    if (unlockNames[enemy.id]) {
      unlockedAreaName = unlockNames[enemy.id];
    } else {
      data.cleared = true;
      cleared = true;
    }
  }
  return { levelUps, unlockedAreaName, cleared };
}

/** 敗北時の進行処理: 経験値は保持したまま村へ帰還し全回復する */
export function resolveDefeat(data: SaveData, spawn: { x: number; y: number }): void {
  data.player.hp = data.player.maxHp;
  data.currentArea = 'area1';
  data.player.x = spawn.x;
  data.player.y = spawn.y;
}
