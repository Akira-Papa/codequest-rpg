import type { SaveData } from '../types';
import { maxHpForLevel } from './logic';
import { AREAS } from '../data/areas';
import { isWalkable } from '../render/sprites';

const KEY = 'codequest-save-v1';

export function newSave(): SaveData {
  const spawn = AREAS.area1.spawn;
  return {
    version: 1,
    player: {
      level: 1,
      exp: 0,
      maxHp: maxHpForLevel(1),
      hp: maxHpForLevel(1),
      x: spawn.x,
      y: spawn.y,
    },
    unlockedAreas: ['area1'],
    currentArea: 'area1',
    defeatedBosses: [],
    stats: {},
    cleared: false,
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data?.version !== 1) return null;
    const p = data.player;
    if (!p || !num(p.level) || !num(p.exp) || !num(p.hp) || !num(p.maxHp) || !num(p.x) || !num(p.y)) {
      return null;
    }
    if (!Array.isArray(data.unlockedAreas) || typeof data.currentArea !== 'string') return null;
    if (!AREAS[data.currentArea]) data.currentArea = 'area1';
    if (!data.stats || typeof data.stats !== 'object') data.stats = {};
    if (!Array.isArray(data.defeatedBosses)) data.defeatedBosses = [];
    if (typeof data.cleared !== 'boolean') data.cleared = false;
    // 破損・改変データによる進行不能を防ぐ: 数値を正常域にクランプ
    const area = AREAS[data.currentArea];
    p.level = Math.max(1, Math.floor(p.level));
    p.maxHp = maxHpForLevel(p.level);
    p.hp = Math.min(Math.max(1, Math.floor(p.hp)), p.maxHp);
    p.exp = Math.max(0, Math.floor(p.exp));
    p.x = Math.min(Math.max(0, Math.floor(p.x)), area.map[0].length - 1);
    p.y = Math.min(Math.max(0, Math.floor(p.y)), area.map.length - 1);
    // 通行不能タイルに埋まっていたらスポーン地点へ退避(軟禁詰み防止)
    if (!isWalkable(area.map[p.y][p.x])) {
      p.x = area.spawn.x;
      p.y = area.spawn.y;
    }
    return data;
  } catch {
    return null;
  }
}

export function storeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ストレージ不可(プライベートモード等)でもゲームは続行可能
  }
}

export function hasSave(): boolean {
  return loadSave() !== null;
}
