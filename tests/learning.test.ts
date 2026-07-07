import { describe, it, expect, beforeEach } from 'vitest';
import { QUESTIONS } from '../src/data/questions';
import { LESSONS, LESSON_FOR_AREA, lessonById } from '../src/data/lessons';
import { AREAS } from '../src/data/areas';
import { newSave, loadSave } from '../src/core/save';

beforeEach(() => {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  };
});

describe('ヒント(初心者の安全網)', () => {
  it('全36問にヒントがある', () => {
    for (const q of QUESTIONS) {
      expect(q.hint, q.id).toBeTruthy();
      expect(q.hint.length, q.id).toBeGreaterThan(5);
    }
  });
  it('ヒントは答えの選択肢テキストそのものを含まない(丸写し防止)', () => {
    for (const q of QUESTIONS) {
      const answerText = q.choices[q.answer];
      // 短い記号的な正解(true/false/数値)は概念説明に登場しうるため除外
      if (answerText.length <= 5) continue;
      expect(q.hint.includes(answerText), `${q.id}: "${answerText}"`).toBe(false);
    }
  });
});

describe('レッスン(まなびの石碑)', () => {
  it('3分野すべてにレッスンがある', () => {
    const cats = new Set(LESSONS.map((l) => l.category));
    expect(cats).toEqual(new Set(['variable', 'condition', 'loop']));
  });
  it('各レッスンは4ページ以上で、空ページがない', () => {
    for (const l of LESSONS) {
      expect(l.pages.length, l.id).toBeGreaterThanOrEqual(4);
      for (const p of l.pages) expect(p.trim().length).toBeGreaterThan(10);
    }
  });
  it('全エリアに対応レッスンが定義され、実在する', () => {
    for (const areaId of Object.keys(AREAS)) {
      const lessonId = LESSON_FOR_AREA[areaId];
      expect(lessonId, areaId).toBeTruthy();
      expect(lessonById(lessonId), lessonId).toBeDefined();
    }
  });
  it('全エリアのマップに石碑(L)がちょうど1つある', () => {
    for (const area of Object.values(AREAS)) {
      const count = area.map.join('').split('L').length - 1;
      expect(count, area.id).toBe(1);
    }
  });
});

describe('セーブ後方互換(v1.1 → v1.2)', () => {
  it('readLessons/tutorialSeenが無い旧セーブはデフォルト補完される', () => {
    const old = newSave() as unknown as Record<string, unknown>;
    delete old.readLessons;
    delete old.tutorialSeen;
    localStorage.setItem('codequest-save-v1', JSON.stringify(old));
    const loaded = loadSave();
    expect(loaded).not.toBeNull();
    expect(loaded!.readLessons).toEqual([]);
    expect(loaded!.tutorialSeen).toBe(false);
  });
});
