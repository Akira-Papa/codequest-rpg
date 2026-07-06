import { describe, it, expect, beforeEach } from 'vitest';
import { recordAnswer, resolveVictory, resolveDefeat, questionWeight, expForNext } from '../src/core/logic';
import { newSave } from '../src/core/save';
import { ENEMIES } from '../src/data/enemies';
import type { SaveData } from '../src/types';

// save.ts が localStorage に触れるためのスタブ(newSave自体は触れないが安全のため)
beforeEach(() => {
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
});

const UNLOCKS = { nullghost: 'じょうけんぶんきの森', nesthydra: 'ループのどうくつ' };

describe('recordAnswer(間隔反復の結線)', () => {
  it('不正解でwrongCountが増え、出題重みが上がる', () => {
    const stats: SaveData['stats'] = {};
    recordAnswer(stats, 'q1', false);
    recordAnswer(stats, 'q1', false);
    expect(stats.q1.wrongCount).toBe(2);
    expect(stats.q1.asked).toBe(2);
    expect(questionWeight(stats.q1)).toBe(5); // 1 + 2*2
  });
  it('正解でwrongCountが減衰する(0未満にはならない)', () => {
    const stats: SaveData['stats'] = {};
    recordAnswer(stats, 'q1', false);
    recordAnswer(stats, 'q1', true);
    expect(stats.q1.wrongCount).toBe(0);
    expect(stats.q1.correct).toBe(1);
    recordAnswer(stats, 'q1', true);
    expect(stats.q1.wrongCount).toBe(0);
  });
});

describe('resolveVictory(勝利の進行処理)', () => {
  it('雑魚撃破: 経験値が入りボス関連は変化しない', () => {
    const data = newSave();
    const r = resolveVictory(data, ENEMIES.bugslime, UNLOCKS);
    expect(data.player.exp).toBe(ENEMIES.bugslime.exp);
    expect(data.defeatedBosses).toEqual([]);
    expect(r.unlockedAreaName).toBeNull();
    expect(r.cleared).toBe(false);
  });
  it('経験値が足りればレベルアップして全回復する', () => {
    const data = newSave();
    data.player.hp = 5;
    data.player.exp = expForNext(1) - 1;
    const r = resolveVictory(data, ENEMIES.bugslime, UNLOCKS);
    expect(r.levelUps).toBeGreaterThanOrEqual(1);
    expect(data.player.level).toBeGreaterThanOrEqual(2);
    expect(data.player.hp).toBe(data.player.maxHp);
  });
  it('ボス撃破: 撃破記録+エリア解放+HP全回復', () => {
    const data = newSave();
    data.player.hp = 3;
    const r = resolveVictory(data, ENEMIES.nullghost, UNLOCKS);
    expect(data.defeatedBosses).toContain('nullghost');
    expect(r.unlockedAreaName).toBe('じょうけんぶんきの森');
    expect(data.player.hp).toBe(data.player.maxHp);
    expect(data.cleared).toBe(false);
  });
  it('最終ボス撃破でクリアフラグが立つ', () => {
    const data = newSave();
    const r = resolveVictory(data, ENEMIES.loopdragon, UNLOCKS);
    expect(r.cleared).toBe(true);
    expect(data.cleared).toBe(true);
  });
  it('同じボスを二度倒しても撃破記録は重複しない', () => {
    const data = newSave();
    resolveVictory(data, ENEMIES.nullghost, UNLOCKS);
    resolveVictory(data, ENEMIES.nullghost, UNLOCKS);
    expect(data.defeatedBosses.filter((b) => b === 'nullghost')).toHaveLength(1);
  });
});

describe('resolveDefeat(敗北の進行処理)', () => {
  it('経験値・レベルは保持したまま村へ帰還し全回復する', () => {
    const data = newSave();
    data.player.exp = 15;
    data.player.hp = 0;
    data.currentArea = 'area3';
    data.player.x = 10;
    data.player.y = 8;
    resolveDefeat(data, { x: 3, y: 2 });
    expect(data.player.exp).toBe(15);
    expect(data.player.hp).toBe(data.player.maxHp);
    expect(data.currentArea).toBe('area1');
    expect(data.player.x).toBe(3);
    expect(data.player.y).toBe(2);
  });
});
