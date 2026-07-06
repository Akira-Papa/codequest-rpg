/**
 * ドット絵は文字の2次元マップ+パレットで定義する(画像アセット不使用)。
 * '.' は透明。
 */

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  palette: Record<string, string>,
  x: number,
  y: number,
  scale = 1,
  flipX = false
): void {
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const ch = flipX ? line[line.length - 1 - col] : line[col];
      if (ch === '.') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

// ---- 勇者 ----------------------------------------------------------------

export const HERO_PALETTE: Record<string, string> = {
  b: '#2a5cc8', // 服・帽子(青)
  d: '#1a3a8a', // 服の影
  f: '#f0c8a0', // 肌
  k: '#22223a', // 目・ブーツ
  y: '#f7d51d', // 髪・飾り
  w: '#ffffff',
};

export const HERO_DOWN: string[] = [
  '................',
  '.....bbbbbb.....',
  '....bbbbbbbb....',
  '....byyyyyyb....',
  '....yffffffy....',
  '....ffkffkff....',
  '....ffffffff....',
  '.....ffffff.....',
  '....bbbbbbbb....',
  '...fbbdbbdbbf...',
  '...fbbbbbbbbf...',
  '....bbbbbbbb....',
  '....dbb..bbd....',
  '.....bb..bb.....',
  '....kkk..kkk....',
  '................',
];

export const HERO_UP: string[] = [
  '................',
  '.....bbbbbb.....',
  '....bbbbbbbb....',
  '....bbbbbbbb....',
  '....yyyyyyyy....',
  '....yyyyyyyy....',
  '....yyyyyyyy....',
  '.....yyyyyy.....',
  '....bbbbbbbb....',
  '...fbbdbbdbbf...',
  '...fbbbbbbbbf...',
  '....bbbbbbbb....',
  '....dbb..bbd....',
  '.....bb..bb.....',
  '....kkk..kkk....',
  '................',
];

export const HERO_SIDE: string[] = [
  '................',
  '.....bbbbbb.....',
  '....bbbbbbbb....',
  '....byyyyyyb....',
  '....yffffffy....',
  '....fffkffff....',
  '....ffffffff....',
  '.....ffffff.....',
  '....bbbbbbbb....',
  '....bbdbbdbf....',
  '....bbbbbbbf....',
  '....bbbbbbbb....',
  '....dbb.bbd.....',
  '.....bb.bb......',
  '....kkk.kkk.....',
  '................',
];

// ---- 敵キャラ ------------------------------------------------------------
// それぞれ16x16。プログラミング概念の擬人化モンスター。

export const ENEMY_SPRITES: Record<string, { sprite: string[]; palette: Record<string, string> }> = {
  // バグスライム: 触角の生えたスライム
  bugslime: {
    palette: { g: '#4cd44c', d: '#2a8a2a', k: '#16213e', w: '#ffffff', a: '#2a8a2a' },
    sprite: [
      '...a........a...',
      '....a......a....',
      '....a......a....',
      '.....gggggg.....',
      '....gggggggg....',
      '...gggggggggg...',
      '..gggwkggwkggg..',
      '..gggkkggkkggg..',
      '.gggggggggggggg.',
      '.ggggggkkgggggg.',
      '.ggdggggggggdgg.',
      '.gddgggggggggdg.',
      '.gdddddddddddgg.',
      '..dddddddddddd..',
      '...dddddddddd...',
      '................',
    ],
  },
  // セミコロンムシ: 背中に「;」を背負った虫
  semibug: {
    palette: { p: '#b05cd4', d: '#6a2a8a', k: '#16213e', w: '#ffffff', l: '#d49cf0' },
    sprite: [
      '..k..........k..',
      '...k........k...',
      '....pppppppp....',
      '...pppppppppp...',
      '..ppwkpppwkpp...',
      '..ppkkpppkkpp...',
      '..pppppppppppp..',
      '.pdppppppppppd..',
      '.pdppwwppppppd..',
      '.pdppwwppppppd..',
      '.pdpppppppppdp..',
      '.pdppwwpppppdp..',
      '..dppwwppppdd...',
      '..ddpwpppddd....',
      '...dddddddd.....',
      '..k..k..k..k....',
    ],
  },
  // ヌルポインタゴースト(ボス): 目が空洞のゴースト
  nullghost: {
    palette: { w: '#e8e8ff', s: '#9c9cd4', k: '#0a0a18', b: '#5c5cb0' },
    sprite: [
      '.....wwwwww.....',
      '...wwwwwwwwww...',
      '..wwwwwwwwwwww..',
      '..wwkkwwwwkkww..',
      '.wwwkkwwwwkkwww.',
      '.wwwwwwwwwwwwww.',
      '.wwwwwkkkkwwwww.',
      '.wwwwkwwwwkwwww.',
      '.wwwwwwwwwwwwww.',
      '.swwwwwwwwwwwws.',
      '.swwwwwwwwwwwws.',
      '..swwswwswwsww..',
      '..swwswwswwsw...',
      '...sw.ss.sw.s...',
      '....s..s..s.....',
      '................',
    ],
  },
  // イコールツイン: 「==」を掲げるふたご
  equaltwin: {
    palette: { o: '#f0a03c', d: '#b06a1c', k: '#16213e', w: '#ffffff' },
    sprite: [
      '..oooo....oooo..',
      '.oooooo..oooooo.',
      '.owkooo..owkooo.',
      '.okkooo..okkooo.',
      '.oooooo..oooooo.',
      '..oooo....oooo..',
      '..dood....dood..',
      '.odoodo..odoodo.',
      '.odoodo..odoodo.',
      '..dood....dood..',
      '..w..w....w..w..',
      '.www.www.ww.www.',
      '................',
      '.wwwwww..wwwwww.',
      '................',
      '.wwwwww..wwwwww.',
    ],
  },
  // エルスウルフ: 分岐の森のオオカミ
  elsewolf: {
    palette: { g: '#8a8aa0', d: '#5a5a74', k: '#16213e', w: '#ffffff', r: '#d43c3c' },
    sprite: [
      '..k.........k...',
      '..gk.......kg...',
      '..ggg.....ggg...',
      '..ggggggggggg...',
      '.gggggggggggggg.',
      '.gwkgggggggggg..',
      '.gkkggggggggggd.',
      '.ggggggrrggggdd.',
      '..gggggggggggd..',
      '..ggdgggggggdd..',
      '..gdggggggggd...',
      '..gdgggggggdd...',
      '..gd.ggg.ggd....',
      '..kk.kgk.gkk....',
      '..kk..kk..kk....',
      '................',
    ],
  },
  // ネストヒュドラ(ボス): 3つ首のヒュドラ(ネスト地獄)
  nesthydra: {
    palette: { g: '#3ca03c', d: '#1e6a1e', k: '#16213e', w: '#ffffff', y: '#f7d51d' },
    sprite: [
      '.gg....gg....gg.',
      'gykg..gykg..gykg',
      'gggg..gggg..gggg',
      '.gg....gg....gg.',
      '.gg....gg....gg.',
      '.dgg...gg...ggd.',
      '..dgg..gg..ggd..',
      '...dggggggggd...',
      '....gggggggg....',
      '...gggggggggg...',
      '..ggggggggggggd.',
      '..dgggggggggdd..',
      '..ddggggggggd...',
      '...ddggggggdd...',
      '....dddddddd....',
      '................',
    ],
  },
  // ワンオフゴブリン: 「+1」の棍棒を持つゴブリン(off-by-oneエラー)
  goblin: {
    palette: { g: '#6ab04c', d: '#3a701c', k: '#16213e', w: '#ffffff', b: '#8a5a2a', y: '#f7d51d' },
    sprite: [
      '..k..........b..',
      '.kgk........bbb.',
      '..ggggggg...byb.',
      '..ggggggg...byb.',
      '..gwkggwk...bbb.',
      '..gkkggkk....b..',
      '..ggggggg....b..',
      '...ggkkg.....b..',
      '..ggggggg....b..',
      '.gdgggggdgggbb..',
      '.gdgggggdg......',
      '..ggggggg.......',
      '..dgg.ggd.......',
      '..dg...gd.......',
      '..kk...kk.......',
      '................',
    ],
  },
  // ブレークバット: 洞窟のコウモリ
  breakbat: {
    palette: { p: '#6a4a9c', d: '#3a2a5c', k: '#16213e', w: '#ffffff', r: '#d43c3c' },
    sprite: [
      '................',
      '.d....dddd....d.',
      'dd...dddddd...dd',
      'ddd.dddddddd.ddd',
      'dddddppppppddddd',
      '.dddppppppppddd.',
      '..ddpwkppwkpdd..',
      '..dppkkppkkppd..',
      '...ppppppppppp..',
      '...pppprrppppp..',
      '....pprpprppp...',
      '.....pppppp.....',
      '......pppp......',
      '.....k.pp.k.....',
      '.....k....k.....',
      '................',
    ],
  },
  // 無限ループドラゴン(ボス): ∞マークを胸に宿す紅蓮のドラゴン
  loopdragon: {
    palette: { r: '#d43c3c', d: '#8a1c1c', k: '#16213e', w: '#ffffff', y: '#f7d51d', o: '#f0a03c' },
    sprite: [
      '..y..........y..',
      '..ry........yr..',
      '..rrr......rrr..',
      '..rrrrrrrrrrrr..',
      '.rrrwkrrrrwkrrr.',
      '.rrrkkrrrrkkrrr.',
      '.rrrrrrrrrrrrrr.',
      '..rrrrkkkkrrrr..',
      '..rrooroorooor..',
      '.drrowworowwor..',
      '.ddrrooroooorr..',
      '.ddrrrrrrrrrrdd.',
      '..drrrrrrrrrrd..',
      '..ddrr.rr.rrdd..',
      '..kkk..kk..kkk..',
      '................',
    ],
  },
};

// ---- フィールドタイル(手続き描画) --------------------------------------

export const TILE = 16;

const TILE_COLORS = {
  grassBase: '#2f7d4f',
  grassLight: '#3e9860',
  tree: '#1e5a34',
  treeDark: '#123a20',
  trunk: '#6a4a2a',
  water: '#2a5cc8',
  waterLight: '#4c7ce0',
  path: '#c8a05c',
  pathDark: '#a8803c',
  cave: '#3a3a4a',
  caveDark: '#22222e',
  rock: '#6a6a80',
};

/** タイルを1枚描く。x,yはピクセル座標。装飾は座標から決定的に配置 */
export function drawTile(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, tick: number): void {
  const c = TILE_COLORS;
  switch (ch) {
    case 'g': {
      ctx.fillStyle = c.grassBase;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = c.grassLight;
      const seed = ((x / TILE) * 7 + (y / TILE) * 13) % 4;
      ctx.fillRect(x + 3 + seed, y + 4, 2, 1);
      ctx.fillRect(x + 10 - seed, y + 11, 2, 1);
      ctx.fillRect(x + 6, y + 8 + (seed % 2), 1, 2);
      break;
    }
    case 't': {
      ctx.fillStyle = c.grassBase;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = c.trunk;
      ctx.fillRect(x + 6, y + 11, 4, 4);
      ctx.fillStyle = c.tree;
      ctx.fillRect(x + 2, y + 4, 12, 8);
      ctx.fillRect(x + 4, y + 1, 8, 4);
      ctx.fillStyle = c.treeDark;
      ctx.fillRect(x + 3, y + 9, 10, 3);
      ctx.fillStyle = c.grassLight;
      ctx.fillRect(x + 5, y + 3, 2, 2);
      break;
    }
    case 'w': {
      ctx.fillStyle = c.water;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = c.waterLight;
      const phase = Math.floor(tick / 500) % 2;
      ctx.fillRect(x + 2 + phase * 2, y + 4, 5, 1);
      ctx.fillRect(x + 8 - phase * 2, y + 11, 5, 1);
      break;
    }
    case 'p':
    case 'V':
    case 'F':
    case 'C':
    case 'H': {
      ctx.fillStyle = c.path;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = c.pathDark;
      const seed = ((x / TILE) * 11 + (y / TILE) * 5) % 5;
      ctx.fillRect(x + 2 + seed, y + 5, 2, 2);
      ctx.fillRect(x + 11 - seed, y + 11, 2, 2);
      if (ch === 'V') {
        // 村: 赤屋根の家
        ctx.fillStyle = '#d43c3c';
        ctx.fillRect(x + 2, y + 2, 12, 5);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(x + 3, y + 7, 10, 7);
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(x + 6, y + 9, 4, 5);
      }
      if (ch === 'F' || ch === 'H') {
        // 出入口: 木のアーチ
        ctx.fillStyle = c.trunk;
        ctx.fillRect(x + 1, y + 2, 3, 12);
        ctx.fillRect(x + 12, y + 2, 3, 12);
        ctx.fillRect(x + 1, y + 1, 14, 3);
      }
      if (ch === 'C') {
        // 洞窟の入口
        ctx.fillStyle = c.rock;
        ctx.fillRect(x + 1, y + 1, 14, 14);
        ctx.fillStyle = c.caveDark;
        ctx.fillRect(x + 4, y + 5, 8, 10);
      }
      break;
    }
    case 'r': {
      // 岩(洞窟の壁)
      ctx.fillStyle = c.cave;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = c.rock;
      ctx.fillRect(x + 2, y + 2, 12, 10);
      ctx.fillStyle = c.caveDark;
      ctx.fillRect(x + 4, y + 8, 8, 4);
      break;
    }
    case 'c': {
      // 洞窟の床(エンカウントあり)
      ctx.fillStyle = c.caveDark;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = c.cave;
      const seed = ((x / TILE) * 3 + (y / TILE) * 7) % 6;
      ctx.fillRect(x + 2 + seed, y + 3, 2, 2);
      ctx.fillRect(x + 9 - seed, y + 10, 3, 2);
      break;
    }
    default: {
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
}

/** 通行可能か */
export function isWalkable(ch: string): boolean {
  return ch === 'g' || ch === 'p' || ch === 'V' || ch === 'F' || ch === 'C' || ch === 'H' || ch === 'c';
}

/** エンカウント対象タイルか */
export function isEncounterTile(ch: string): boolean {
  return ch === 'g' || ch === 'c';
}
