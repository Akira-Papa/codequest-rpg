import type { Enemy } from '../types';
import { ENEMY_SPRITES } from '../render/sprites';

/**
 * 敵HPは「正解n回で倒せる」設計(プレイヤー攻撃力はLv1で11)。
 * attack は不正解時にプレイヤーが受けるダメージ。
 */
export const ENEMIES: Record<string, Enemy> = {
  bugslime: {
    id: 'bugslime',
    name: 'バグスライム',
    ...ENEMY_SPRITES.bugslime,
    maxHp: 22, // 正解2回
    attack: 5,
    categories: ['variable'],
    difficulty: [1, 1],
    exp: 8,
  },
  semibug: {
    id: 'semibug',
    name: 'セミコロンムシ',
    ...ENEMY_SPRITES.semibug,
    maxHp: 33, // 正解3回
    attack: 6,
    categories: ['variable'],
    difficulty: [1, 2],
    exp: 12,
  },
  nullghost: {
    id: 'nullghost',
    name: 'ヌルポインタゴースト',
    ...ENEMY_SPRITES.nullghost,
    maxHp: 55, // 正解5回
    attack: 8,
    categories: ['variable'],
    difficulty: [1, 3],
    exp: 40,
    isBoss: true,
    recommendLevel: 2,
  },
  equaltwin: {
    id: 'equaltwin',
    name: 'イコールツイン',
    ...ENEMY_SPRITES.equaltwin,
    maxHp: 33,
    attack: 7,
    categories: ['condition'],
    difficulty: [1, 2],
    exp: 16,
  },
  elsewolf: {
    id: 'elsewolf',
    name: 'エルスウルフ',
    ...ENEMY_SPRITES.elsewolf,
    maxHp: 44,
    attack: 8,
    categories: ['condition'],
    difficulty: [2, 2],
    exp: 20,
  },
  nesthydra: {
    id: 'nesthydra',
    name: 'ネストヒュドラ',
    ...ENEMY_SPRITES.nesthydra,
    maxHp: 70,
    attack: 10,
    categories: ['condition', 'variable'],
    difficulty: [2, 3],
    exp: 60,
    isBoss: true,
    recommendLevel: 4,
  },
  goblin: {
    id: 'goblin',
    name: 'ワンオフゴブリン',
    ...ENEMY_SPRITES.goblin,
    maxHp: 44,
    attack: 9,
    categories: ['loop'],
    difficulty: [1, 2],
    exp: 24,
  },
  breakbat: {
    id: 'breakbat',
    name: 'ブレークバット',
    ...ENEMY_SPRITES.breakbat,
    maxHp: 55,
    attack: 10,
    categories: ['loop'],
    difficulty: [2, 3],
    exp: 28,
  },
  loopdragon: {
    id: 'loopdragon',
    name: 'むげんループドラゴン',
    ...ENEMY_SPRITES.loopdragon,
    maxHp: 90,
    attack: 12,
    categories: ['loop', 'condition', 'variable'],
    difficulty: [2, 3],
    exp: 100,
    isBoss: true,
    recommendLevel: 6,
  },
};
