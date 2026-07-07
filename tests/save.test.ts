import { describe, it, expect, beforeEach } from 'vitest';
import { newSave, loadSave, storeSave } from '../src/core/save';

// Node環境用のlocalStorageスタブ
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).localStorage = new MemoryStorage();
});

describe('save', () => {
  it('セーブなしのときloadSaveはnull', () => {
    expect(loadSave()).toBeNull();
  });
  it('保存→読み込みで往復できる', () => {
    const data = newSave();
    data.player.level = 3;
    data.defeatedBosses.push('nullghost');
    storeSave(data);
    const loaded = loadSave();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.level).toBe(3);
    expect(loaded!.defeatedBosses).toContain('nullghost');
  });
  it('壊れたJSONはnullを返す(クラッシュしない)', () => {
    localStorage.setItem('codequest-save-v1', '{broken json');
    expect(loadSave()).toBeNull();
  });
  it('バージョン不一致はnullを返す', () => {
    localStorage.setItem('codequest-save-v1', JSON.stringify({ version: 99 }));
    expect(loadSave()).toBeNull();
  });
  it('v1.0の古いセーブ(新フィールドなし)を読み込むとデフォルトで補完される', () => {
    const old = newSave() as unknown as Record<string, unknown>;
    delete old.battleWins;
    delete old.bestCombo;
    delete old.openedChests;
    localStorage.setItem('codequest-save-v1', JSON.stringify(old));
    const loaded = loadSave();
    expect(loaded).not.toBeNull();
    expect(loaded!.battleWins).toBe(0);
    expect(loaded!.bestCombo).toBe(0);
    expect(loaded!.openedChests).toEqual([]);
  });
  it('newSaveの初期値が正しい', () => {
    const d = newSave();
    expect(d.player.level).toBe(1);
    expect(d.player.hp).toBe(d.player.maxHp);
    expect(d.currentArea).toBe('area1');
    expect(d.unlockedAreas).toEqual(['area1']);
    expect(d.cleared).toBe(false);
  });
});
