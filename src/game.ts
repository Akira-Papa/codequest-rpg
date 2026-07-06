import type { Scene, SaveData } from './types';
import { Input } from './core/input';
import { newSave, storeSave } from './core/save';
import { SCALE } from './constants';

/** シーン管理とゲームループ(requestAnimationFrame) */
export class Game {
  readonly ctx: CanvasRenderingContext2D;
  readonly input: Input;
  data: SaveData = newSave();
  private scene: Scene | null = null;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D contextを取得できません');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input(canvas);
  }

  changeScene(scene: Scene): void {
    this.scene?.onExit?.();
    this.scene = scene;
    scene.onEnter?.();
  }

  saveNow(): void {
    storeSave(this.data);
  }

  start(): void {
    const loop = (time: number) => {
      const dt = Math.min(50, time - this.lastTime); // タブ復帰時の暴走防止
      this.lastTime = time;
      if (this.scene) {
        this.scene.update(dt);
        this.ctx.save();
        this.ctx.scale(SCALE, SCALE);
        this.scene.draw(this.ctx);
        this.ctx.restore();
      }
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame((t) => {
      this.lastTime = t;
      requestAnimationFrame(loop);
    });
  }
}
