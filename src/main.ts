import { Game } from './game';
import { TitleScene } from './scenes/title';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('canvas#game が見つかりません');

const game = new Game(canvas);

// 開発時のみ: デバッグ用にゲーム状態を公開
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = game;
}

// ドットフォントの読み込みを待ってから開始(初回描画のフォント崩れ防止)
const boot = () => {
  game.changeScene(new TitleScene(game));
  game.start();
};

if (document.fonts?.ready) {
  // フォントが遅くてもゲームを止めない(最大1.5秒待ち)
  Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]).then(boot);
} else {
  boot();
}
