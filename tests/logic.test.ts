import { describe, it, expect } from 'vitest';
import {
  expForNext,
  maxHpForLevel,
  attackForLevel,
  questionWeight,
  pickWeighted,
  selectQuestion,
  shuffleChoices,
  gainExp,
} from '../src/core/logic';
import { QUESTIONS } from '../src/data/questions';
import type { Question } from '../src/types';

describe('expForNext / maxHpForLevel / attackForLevel', () => {
  it('レベル1の必要経験値は20', () => {
    expect(expForNext(1)).toBe(20);
  });
  it('必要経験値はレベルに対して単調増加する', () => {
    for (let lv = 1; lv < 20; lv++) {
      expect(expForNext(lv + 1)).toBeGreaterThan(expForNext(lv));
    }
  });
  it('HPと攻撃力はレベルとともに上がる', () => {
    expect(maxHpForLevel(1)).toBe(30);
    expect(maxHpForLevel(2)).toBe(35);
    expect(attackForLevel(1)).toBe(11);
    expect(attackForLevel(5)).toBe(15);
  });
});

describe('questionWeight', () => {
  it('未回答の問題の重みは1', () => {
    expect(questionWeight(undefined)).toBe(1);
  });
  it('間違えるほど重みが増える(間隔反復)', () => {
    expect(questionWeight({ asked: 3, correct: 1, wrongCount: 2 })).toBe(5);
  });
});

describe('pickWeighted', () => {
  it('rand=0で最初の要素を選ぶ', () => {
    expect(pickWeighted(['a', 'b', 'c'], [1, 1, 1], () => 0)).toBe('a');
  });
  it('rand→1に近いとき最後の要素を選ぶ', () => {
    expect(pickWeighted(['a', 'b', 'c'], [1, 1, 1], () => 0.999)).toBe('c');
  });
  it('重み0の要素は選ばれない', () => {
    for (let i = 0; i < 50; i++) {
      const r = pickWeighted(['a', 'b'], [0, 1], Math.random);
      expect(r).toBe('b');
    }
  });
  it('空配列はエラー', () => {
    expect(() => pickWeighted([], [], () => 0)).toThrow();
  });
});

describe('selectQuestion', () => {
  it('分野と難易度帯でフィルタされる', () => {
    for (let i = 0; i < 30; i++) {
      const q = selectQuestion(QUESTIONS, {}, ['variable'], [1, 1], new Set(), Math.random);
      expect(q.category).toBe('variable');
      expect(q.difficulty).toBe(1);
    }
  });
  it('出題済みの問題は避けられる', () => {
    const pool = QUESTIONS.filter((q) => q.category === 'variable' && q.difficulty === 1);
    const exclude = new Set(pool.slice(0, pool.length - 1).map((q) => q.id));
    const q = selectQuestion(QUESTIONS, {}, ['variable'], [1, 1], exclude, Math.random);
    expect(q.id).toBe(pool[pool.length - 1].id);
  });
  it('全問出題済みなら除外を解除して再抽選する', () => {
    const exclude = new Set(QUESTIONS.map((q) => q.id));
    const q = selectQuestion(QUESTIONS, {}, ['loop'], [1, 3], exclude, Math.random);
    expect(q.category).toBe('loop');
  });
});

describe('shuffleChoices', () => {
  const sample: Question = QUESTIONS[0];
  it('シャッフル後も正解の中身が一致する', () => {
    for (let i = 0; i < 30; i++) {
      const { choices, answer } = shuffleChoices(sample, Math.random);
      expect(choices[answer]).toBe(sample.choices[sample.answer]);
      expect([...choices].sort()).toEqual([...sample.choices].sort());
    }
  });
  it('シャッフルで正解位置が動くことがある(常に先頭ではない)', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 100; i++) {
      positions.add(shuffleChoices(sample, Math.random).answer);
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe('gainExp', () => {
  it('レベルアップ時にHPが更新され全回復する', () => {
    const p = { level: 1, exp: 0, maxHp: 30, hp: 10 };
    const ups = gainExp(p, 20); // Lv1→2に必要な経験値は20
    expect(ups).toBe(1);
    expect(p.level).toBe(2);
    expect(p.maxHp).toBe(35);
    expect(p.hp).toBe(35);
  });
  it('足りなければレベルは上がらずHPもそのまま', () => {
    const p = { level: 1, exp: 0, maxHp: 30, hp: 10 };
    const ups = gainExp(p, 19);
    expect(ups).toBe(0);
    expect(p.exp).toBe(19);
    expect(p.hp).toBe(10);
  });
  it('大量の経験値で複数レベル一気に上がる', () => {
    const p = { level: 1, exp: 0, maxHp: 30, hp: 30 };
    const ups = gainExp(p, 20 + expForNext(2));
    expect(ups).toBe(2);
    expect(p.level).toBe(3);
  });
});
