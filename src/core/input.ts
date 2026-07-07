import { initAudio } from './audio';
import { VIEW_W, VIEW_H } from '../constants';

export type VKey =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm' | 'cancel' | 'hint'
  | '1' | '2' | '3' | '4';

const KEY_MAP: Record<string, VKey> = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  Enter: 'confirm', ' ': 'confirm', z: 'confirm', Z: 'confirm',
  Escape: 'cancel', x: 'cancel', X: 'cancel',
  h: 'hint', H: 'hint',
  '1': '1', '2': '2', '3': '3', '4': '4',
};

/** キーボード+タッチ入力を論理キー/論理座標に抽象化する */
export class Input {
  private down = new Set<VKey>();
  private queue: VKey[] = [];
  /** このフレームのクリック/タップ位置(論理256x192座標)。なければnull */
  click: { x: number; y: number } | null = null;
  /** 押しっぱなし中のポインタ位置(長押し移動用)。離すとnull */
  pointer: { x: number; y: number } | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      const vk = KEY_MAP[e.key];
      if (!vk) return;
      e.preventDefault();
      initAudio();
      if (!e.repeat) this.queue.push(vk);
      this.down.add(vk);
    });
    window.addEventListener('keyup', (e) => {
      const vk = KEY_MAP[e.key];
      if (vk) this.down.delete(vk);
    });
    canvas.addEventListener('pointerdown', (e) => {
      initAudio();
      const pos = this.toLogical(e);
      this.click = pos;
      this.pointer = pos;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.pointer) this.pointer = this.toLogical(e);
    });
    const release = () => {
      this.pointer = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  private toLogical(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((e.clientY - rect.top) / rect.height) * VIEW_H,
    };
  }

  isDown(key: VKey): boolean {
    return this.down.has(key);
  }

  /** このフレームで押されたか(押しっぱなしは含まない) */
  wasPressed(...keys: VKey[]): boolean {
    return this.queue.some((k) => keys.includes(k));
  }

  /** フレーム終端で呼ぶ(clickは1フレームのみ有効、pointerは押下中保持) */
  endFrame(): void {
    this.queue.length = 0;
    this.click = null;
  }
}
