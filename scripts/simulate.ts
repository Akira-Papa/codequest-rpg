/**
 * 学習効果シミュレーション
 *
 * 実際のゲームロジック(出題選択・重み付き間隔反復・コンボダメージ・
 * 経験値/レベル・敵ステータス)をそのまま使い、学習者モデルを載せて
 * 「0からの初心者がこのゲームで学べているか」を定量評価する。
 *
 * シナリオ:
 *   S1: 完全初心者 × v1.0相当(レッスンなし・ヒントなし)
 *   S2: 完全初心者 × v1.2(まなびの石碑 + ヒント)
 *   S3: 経験者(腕試し勢)= 参照基準
 *
 * 実行: npm run simulate
 */
import { QUESTIONS } from '../src/data/questions';
import { ENEMIES } from '../src/data/enemies';
import { AREAS } from '../src/data/areas';
import { LESSON_FOR_AREA } from '../src/data/lessons';
import {
  selectQuestion,
  recordAnswer,
  comboDamage,
  resolveVictory,
  resolveDefeat,
  pickWeighted,
} from '../src/core/logic';
import { newSave } from '../src/core/save';
import type { Question, SaveData, Enemy } from '../src/types';

// ---- 再現可能な乱数(mulberry32) -----------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 学習者モデル ----------------------------------------------------------
//
// 各問題qに習得度 m_q ∈ [0.25, 0.95] を持つ(=正答確率)。
//   ・完全初心者: 全問 0.25(4択の当てずっぽう)
//   ・経験者:     0.80
// 学習イベント(認知科学の一般的な知見に基づく仮定値):
//   ・レッスン読了: その分野の問題の習得度が上がる
//       難易度1: +40% * (上限まで), 難易度2: +20%, 難易度3: +10%
//   ・解説を読む(このゲームは正誤どちらでも解説表示):
//       不正解時 +45%(1.5秒の強制読了で精読) / 正解時 +20%(確認)
//   ・ヒント閲覧: 出題中の正答確率を +55%*(1-m) 底上げ + 習得度 +10%
// 忘却は「再出題までが短いセッション内」を想定し省略(限界として明記)。

interface LearnerParams {
  initialMastery: number;
  useLessons: boolean;
  useHints: boolean;
  /** 習得度がこれ未満なら「自信がない」としてヒントを使う */
  hintThreshold: number;
}

const SCENARIOS: Record<string, LearnerParams> = {
  'S1: 初心者 × v1.0(石碑・ヒントなし)': {
    initialMastery: 0.25,
    useLessons: false,
    useHints: false,
    hintThreshold: 0,
  },
  'S2: 初心者 × v1.2(石碑+ヒント)': {
    initialMastery: 0.25,
    useLessons: true,
    useHints: true,
    hintThreshold: 0.55,
  },
  'S3: 経験者(腕試し・補助なし)': {
    initialMastery: 0.8,
    useLessons: false,
    useHints: false,
    hintThreshold: 0,
  },
};

const MASTERY_CAP = 0.95;
const LESSON_GAIN: Record<number, number> = { 1: 0.4, 2: 0.2, 3: 0.1 };
const EXPLAIN_GAIN_WRONG = 0.45;
const EXPLAIN_GAIN_CORRECT = 0.2;
const HINT_ANSWER_BOOST = 0.55;
const HINT_LEARN_GAIN = 0.1;

const UNLOCKS: Record<string, string> = {
  nullghost: 'じょうけんぶんきの森',
  nesthydra: 'ループのどうくつ',
  loopdragon: 'かんすうの塔',
  recursion: 'はいれつの海',
};
const AREA_SEQ = ['area1', 'area2', 'area3', 'area4', 'area5'];
const MAX_BATTLES = 400;

interface AskLog {
  qid: string;
  exposure: number; // この問題を見るのは何回目か(1=初見)
  correct: boolean;
  hintUsed: boolean;
  battleIndex: number;
  prevWrong: boolean; // 直前の出題で間違えていたか
}

interface RunResult {
  cleared: boolean;
  battles: number;
  defeats: number;
  asks: AskLog[];
  finalMastery: number;
  masteryByCat: Record<string, number>;
}

function simulateRun(params: LearnerParams, seed: number): RunResult {
  const rand = mulberry32(seed);
  const data: SaveData = newSave();
  const mastery = new Map<string, number>(QUESTIONS.map((q) => [q.id, params.initialMastery]));
  const lastResult = new Map<string, boolean>();
  const exposures = new Map<string, number>();
  const asks: AskLog[] = [];

  const bump = (qid: string, gain: number) => {
    const m = mastery.get(qid)!;
    mastery.set(qid, Math.min(MASTERY_CAP, m + gain * (1 - m)));
  };

  const readLesson = (areaId: string) => {
    if (!params.useLessons) return;
    const lessonId = LESSON_FOR_AREA[areaId];
    const category = lessonId.replace('lesson-', '');
    for (const q of QUESTIONS) {
      if (q.category !== category) continue;
      bump(q.id, LESSON_GAIN[q.difficulty]);
    }
  };

  let battles = 0;
  let defeats = 0;
  let areaIdx = 0;
  readLesson(AREA_SEQ[0]);

  const doBattle = (enemy: Enemy): 'win' | 'lose' => {
    battles += 1;
    let enemyHp = enemy.maxHp;
    let combo = 0;
    const asked = new Set<string>();

    while (enemyHp > 0 && data.player.hp > 0) {
      const q: Question = selectQuestion(
        QUESTIONS,
        data.stats,
        enemy.categories,
        enemy.difficulty,
        asked,
        rand
      );
      asked.add(q.id);

      const m = mastery.get(q.id)!;
      const hintUsed = params.useHints && m < params.hintThreshold;
      const pCorrect = hintUsed ? m + (1 - m) * HINT_ANSWER_BOOST : m;
      const correct = rand() < pCorrect;

      const exposure = (exposures.get(q.id) ?? 0) + 1;
      exposures.set(q.id, exposure);
      asks.push({
        qid: q.id,
        exposure,
        correct,
        hintUsed,
        battleIndex: battles,
        prevWrong: lastResult.get(q.id) === false,
      });
      lastResult.set(q.id, correct);

      // ゲーム本体と同じ記録(間隔反復の重みの源泉)
      recordAnswer(data.stats, q.id, correct);

      // 学習イベント: 解説を読む(+ヒントの思考の足場)
      if (hintUsed) bump(q.id, HINT_LEARN_GAIN);
      bump(q.id, correct ? EXPLAIN_GAIN_CORRECT : EXPLAIN_GAIN_WRONG);

      if (correct) {
        combo += 1;
        let dmg = comboDamage(data.player.level, combo);
        if (hintUsed) dmg = Math.max(1, Math.floor(dmg / 2));
        enemyHp -= dmg;
      } else {
        combo = 0;
        data.player.hp = Math.max(0, data.player.hp - enemy.attack);
      }
    }

    if (data.player.hp <= 0) {
      defeats += 1;
      resolveDefeat(data, AREAS.area1.spawn);
      return 'lose';
    }
    resolveVictory(data, enemy, UNLOCKS);
    return 'win';
  };

  while (!data.cleared && battles < MAX_BATTLES) {
    const area = AREAS[AREA_SEQ[areaIdx]];
    const boss = ENEMIES[area.boss!.enemyId];
    const rec = boss.recommendLevel ?? 1;

    // 村/回復ポイントで休んでから挑む(無料回復は仕様どおり)
    data.player.hp = data.player.maxHp;

    if (data.player.level >= rec && !data.defeatedBosses.includes(boss.id)) {
      const result = doBattle(boss);
      if (result === 'win') {
        if (areaIdx < AREA_SEQ.length - 1) {
          areaIdx += 1;
          readLesson(AREA_SEQ[areaIdx]);
        }
      }
      continue;
    }
    // レベリング: エリアの雑魚と戦う
    const table = area.encounters;
    const enemyId = pickWeighted(
      table.map((e) => e.enemyId),
      table.map((e) => e.weight),
      rand
    );
    doBattle(ENEMIES[enemyId]);
  }

  const catSum: Record<string, { sum: number; n: number }> = {};
  let total = 0;
  for (const q of QUESTIONS) {
    const m = mastery.get(q.id)!;
    total += m;
    (catSum[q.category] ??= { sum: 0, n: 0 }).sum += m;
    catSum[q.category].n += 1;
  }
  return {
    cleared: data.cleared,
    battles,
    defeats,
    asks,
    finalMastery: total / QUESTIONS.length,
    masteryByCat: Object.fromEntries(
      Object.entries(catSum).map(([c, v]) => [c, v.sum / v.n])
    ),
  };
}

// ---- 集計 ------------------------------------------------------------------

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function aggregate(name: string, params: LearnerParams, runs: number): void {
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) {
    results.push(simulateRun(params, 1000 + i * 7919));
  }

  const allAsks = results.flatMap((r) => r.asks);
  const rate = (asks: AskLog[]) =>
    asks.length ? asks.filter((a) => a.correct).length / asks.length : NaN;

  const first20 = results.map((r) => rate(r.asks.slice(0, 20)));
  const last20 = results.map((r) => rate(r.asks.slice(-20)));
  const firstExposure = rate(allAsks.filter((a) => a.exposure === 1));
  const thirdPlus = rate(allAsks.filter((a) => a.exposure >= 3));
  const afterWrong = rate(allAsks.filter((a) => a.prevWrong));
  const hintFirstHalf = allAsks.filter((a) => a.exposure === 1);
  const hintRateEarly = hintFirstHalf.length
    ? hintFirstHalf.filter((a) => a.hintUsed).length / hintFirstHalf.length
    : 0;
  const lateAsks = allAsks.filter((a) => a.exposure >= 3);
  const hintRateLate = lateAsks.length
    ? lateAsks.filter((a) => a.hintUsed).length / lateAsks.length
    : 0;

  console.log(`\n━━━ ${name} (${runs}回試行) ━━━`);
  console.log(`  クリア率(400戦以内)     : ${pct(results.filter((r) => r.cleared).length / runs)}`);
  console.log(`  クリアまでの戦闘数       : 平均 ${avg(results.map((r) => r.battles)).toFixed(1)}`);
  console.log(`  敗北回数                 : 平均 ${avg(results.map((r) => r.defeats)).toFixed(2)}`);
  console.log(`  序盤の正答率(最初の20問): ${pct(avg(first20))}`);
  console.log(`  終盤の正答率(最後の20問): ${pct(avg(last20))}`);
  console.log(`  → 学習ゲイン            : +${((avg(last20) - avg(first20)) * 100).toFixed(1)}pt`);
  console.log(`  初見の正答率             : ${pct(firstExposure)}`);
  console.log(`  3回目以降の正答率        : ${pct(thirdPlus)}`);
  console.log(`  直前に間違えた問題の正答率(間隔反復の効き): ${pct(afterWrong)}`);
  if (params.useHints) {
    console.log(`  ヒント使用率 初見: ${pct(hintRateEarly)} → 3回目以降: ${pct(hintRateLate)}(卒業度)`);
  }
  console.log(`  最終習得度(全${QUESTIONS.length}問平均) : ${pct(avg(results.map((r) => r.finalMastery)))}`);
  const catAvg = (c: string) => pct(avg(results.map((r) => r.masteryByCat[c])));
  console.log(
    `    分野別: へんすう ${catAvg('variable')} / じょうけん ${catAvg('condition')} / ループ ${catAvg('loop')} / かんすう ${catAvg('function')} / はいれつ ${catAvg('array')}`
  );
}

const RUNS = 500;
console.log('CodeQuest 学習効果シミュレーション');
console.log(`(実ゲームロジック使用 / 学習者モデルの仮定はスクリプト冒頭コメント参照)`);
for (const [name, params] of Object.entries(SCENARIOS)) {
  aggregate(name, params, RUNS);
}
