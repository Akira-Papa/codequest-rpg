import { describe, it, expect } from 'vitest';
import { QUESTIONS } from '../src/data/questions';
import { ENEMIES } from '../src/data/enemies';
import { AREAS } from '../src/data/areas';
import { isWalkable } from '../src/render/sprites';

describe('QUESTIONS データ整合性', () => {
  it('60問以上ある', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(60);
  });
  it('idが重複していない', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('全問が4択で正解インデックスが範囲内', () => {
    for (const q of QUESTIONS) {
      expect(q.choices.length).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(q.explanation.length).toBeGreaterThan(0);
    }
  });
  it('各分野×難易度に問題が存在する(カリキュラムの穴がない)', () => {
    for (const cat of ['variable', 'condition', 'loop', 'function', 'array'] as const) {
      for (const diff of [1, 2, 3] as const) {
        const n = QUESTIONS.filter((q) => q.category === cat && q.difficulty === diff).length;
        expect(n, `${cat} 難易度${diff}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('ENEMIES データ整合性', () => {
  it('スプライトは16x16', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(e.sprite.length, e.id).toBe(16);
      for (const row of e.sprite) {
        expect(row.length, `${e.id}: "${row}"`).toBe(16);
      }
    }
  });
  it('スプライトの色はすべてパレットに定義済み', () => {
    for (const e of Object.values(ENEMIES)) {
      for (const row of e.sprite) {
        for (const ch of row) {
          if (ch === '.') continue;
          expect(e.palette[ch], `${e.id} の色 "${ch}"`).toBeDefined();
        }
      }
    }
  });
  it('敵の出題条件を満たす問題が必ず存在する', () => {
    for (const e of Object.values(ENEMIES)) {
      const n = QUESTIONS.filter(
        (q) =>
          e.categories.includes(q.category) &&
          q.difficulty >= e.difficulty[0] &&
          q.difficulty <= e.difficulty[1]
      ).length;
      expect(n, e.id).toBeGreaterThan(0);
    }
  });
});

describe('AREAS データ整合性', () => {
  it('マップは16x12', () => {
    for (const a of Object.values(AREAS)) {
      expect(a.map.length, a.id).toBe(12);
      for (const row of a.map) {
        expect(row.length, `${a.id}: "${row}"`).toBe(16);
      }
    }
  });
  it('スポーン位置・出口・ボス位置は通行可能タイル上にある', () => {
    for (const a of Object.values(AREAS)) {
      expect(isWalkable(a.map[a.spawn.y][a.spawn.x]), `${a.id} spawn`).toBe(true);
      for (const ex of a.exits) {
        expect(isWalkable(a.map[ex.y][ex.x]), `${a.id} exit`).toBe(true);
        const dest = AREAS[ex.to];
        expect(dest, `${a.id} -> ${ex.to}`).toBeDefined();
        expect(isWalkable(dest.map[ex.spawnY][ex.spawnX]), `${a.id} -> ${ex.to} spawn`).toBe(true);
      }
      if (a.boss) {
        expect(isWalkable(a.map[a.boss.y][a.boss.x]), `${a.id} boss`).toBe(true);
      }
    }
  });
  it('宝箱は通行可能タイル上にありidが重複しない', () => {
    const ids: string[] = [];
    for (const a of Object.values(AREAS)) {
      for (const c of a.chests ?? []) {
        expect(isWalkable(a.map[c.y][c.x]), `${a.id}: ${c.id}`).toBe(true);
        expect(c.exp).toBeGreaterThan(0);
        ids.push(c.id);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('エンカウントテーブルの敵はすべて定義済み', () => {
    for (const a of Object.values(AREAS)) {
      for (const e of a.encounters) {
        expect(ENEMIES[e.enemyId], `${a.id}: ${e.enemyId}`).toBeDefined();
      }
      if (a.boss) expect(ENEMIES[a.boss.enemyId]).toBeDefined();
    }
  });
});
