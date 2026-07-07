import type { Area } from '../types';

/**
 * マップ凡例:
 *  g=草(エンカウント) t=木(通行不可) w=水(通行不可) p=道
 *  V=村(回復) F/C/H=エリア出入口 r=岩壁(通行不可) c=洞窟床(エンカウント)
 * 各行16文字 x 12行。ボスは出口へ続く一本道を塞ぐ位置に置く。
 */
export const AREAS: Record<string, Area> = {
  area1: {
    id: 'area1',
    name: 'へんすうの村',
    skyColor: '#7ec8e0',
    map: [
      'tttttttttttttttt',
      'tggggggtggggggwt',
      'tgVppppppgggggwt',
      'tLgggggpggggwwwt',
      'tggtgggpggggggtt',
      'tggggggppppppppF',
      'tgggtggggggpggtt',
      'tggggggtgggpggwt',
      'tgggggggggppggwt',
      'tggtggggggpgggwt',
      'tggggggggggggggt',
      'tttttttttttttttt',
    ],
    encounters: [
      { enemyId: 'bugslime', weight: 3 },
      { enemyId: 'semibug', weight: 2 },
    ],
    encounterRate: 0.14,
    boss: { enemyId: 'nullghost', x: 13, y: 5 },
    exits: [{ x: 15, y: 5, to: 'area2', spawnX: 1, spawnY: 5 }],
    spawn: { x: 3, y: 2 },
    chests: [{ id: 'chest-a1', x: 13, y: 9, exp: 15 }],
  },
  area2: {
    id: 'area2',
    name: 'じょうけんぶんきの森',
    skyColor: '#3a7d4f',
    map: [
      'tttttttttttttttt',
      'tggtggtggtggtgwt',
      'tggggggggggggwwt',
      'tgtggtggtggtggwt',
      'tLggggggggggggtt',
      'HppppgggggpppppC',
      'tgtggpgggpgtggtt',
      'tggggppppptggggt',
      'tgtggtggtggtgggt',
      'tggggggggggggtgt',
      'tggtggtggtgggggt',
      'tttttttttttttttt',
    ],
    encounters: [
      { enemyId: 'equaltwin', weight: 3 },
      { enemyId: 'elsewolf', weight: 2 },
    ],
    encounterRate: 0.14,
    boss: { enemyId: 'nesthydra', x: 13, y: 5 },
    unlockedBy: 'nullghost',
    exits: [
      { x: 0, y: 5, to: 'area1', spawnX: 14, spawnY: 5 },
      { x: 15, y: 5, to: 'area3', spawnX: 1, spawnY: 5 },
    ],
    spawn: { x: 1, y: 5 },
    chests: [{ id: 'chest-a2', x: 14, y: 9, exp: 30 }],
  },
  area3: {
    id: 'area3',
    name: 'ループのどうくつ',
    skyColor: '#22222e',
    map: [
      'rrrrrrrrrrrrrrrr',
      'rccrccccccccccrr',
      'rccccrrccrrcccrr',
      'rcrccccccccrccrr',
      'rLcccrccrccccccr',
      'Hpppccccccccccrr',
      'rcrccrccrrcccccr',
      'rccccccccccrccrr',
      'rcrrccrccccccccr',
      'rccccccrrccrcccr',
      'rcccrcccccccccrr',
      'rrrrrrrrrrrrrrrr',
    ],
    encounters: [
      { enemyId: 'goblin', weight: 3 },
      { enemyId: 'breakbat', weight: 2 },
    ],
    encounterRate: 0.16,
    boss: { enemyId: 'loopdragon', x: 13, y: 8 },
    unlockedBy: 'nesthydra',
    exits: [{ x: 0, y: 5, to: 'area2', spawnX: 14, spawnY: 5 }],
    spawn: { x: 1, y: 5 },
    chests: [
      { id: 'chest-a3a', x: 13, y: 2, exp: 40 },
      { id: 'chest-a3b', x: 8, y: 10, exp: 60 },
    ],
  },
};
