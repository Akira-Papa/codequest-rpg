import type { Lesson } from '../types';

/**
 * まなびの石碑のレッスン。0からの初心者向けに
 * 「比喩 → コード例 → ミニ確認」の順で構成する。
 * demo はページ下部で再生されるアニメーション(render/demos.ts)。
 * 1ページはメッセージウィンドウに収まる長さ(目安90文字)に保つこと。
 */
export const LESSONS: Lesson[] = [
  {
    id: 'lesson-variable',
    title: 'へんすう の きほん',
    category: 'variable',
    pages: [
      {
        text: 'ようこそ ぼうけんしゃよ。まずは「へんすう(変数)」から おしえよう。\nへんすうとは… 「なまえつきの はこ」じゃ。',
        demo: 'var-box',
      },
      {
        text: 'let x = 5;\nこれは「x という なまえの はこに 5 を いれる」という いみじゃ。\n= は「ひとしい」ではなく「いれる」!',
        demo: 'var-box',
      },
      {
        text: 'はこの なかみは あとから いれかえられる。\nlet x = 5;\nx = 10;  ← x の なかみは 10 に なる',
        demo: 'var-box',
      },
      {
        text: 'ぜったいに いれかえたくない はこには const を つかう。\nconst name = "ゆうしゃ";\nname = "まおう"; ← エラー! constは さいだいにゅう きんし',
        demo: 'var-const',
      },
      {
        text: 'はこに いれられる ものには「かた(型)」が ある。\n5 は すうじ(number)\n"ゆうしゃ" は もじれつ(string)\n" "が あるか どうかが めじるしじゃ!',
        demo: 'var-types',
      },
      {
        text: 'ミニかくにん!\nlet hp = 30; の hp の なかみは… そう、すうじの 30 じゃ。\nさあ、バグスライムに ためされてこい!',
      },
    ],
  },
  {
    id: 'lesson-condition',
    title: 'じょうけんぶんき の きほん',
    category: 'condition',
    pages: [
      {
        text: 'この森で まなぶのは「じょうけんぶんき(条件分岐)」。\nひとことで いえば…「もしも○○なら △△する」という わかれみちじゃ。',
        demo: 'cond-branch',
      },
      {
        text: 'if (hp < 10) {\n  にげる;\n}\n「もし hpが 10より ちいさいなら にげる」。( )の なかが わかれみちの かんばんじゃ。',
        demo: 'cond-branch',
      },
      {
        text: 'かんばんの こたえは true(ほんとう) か false(うそ) の 2つだけ。\n5 > 3 → true\n1 > 3 → false',
      },
      {
        text: 'それいがいの みちは else じゃ。\nif (hp < 10) { にげる; }\nelse { たたかう; }\nifが false のとき elseの みちを すすむ。',
        demo: 'cond-branch',
      },
      {
        text: 'くらべるときは = を 3つ つかう。\nx === 5 「xは 5と おなじ?」\n= 1つは「いれる」、=== は「くらべる」。まちがえると たいへんじゃ!',
        demo: 'cond-equals',
      },
      {
        text: 'おぼえておけ: 0 や "" (からもじ) は false あつかい(falsy)。\nif (0) { … } は うごかない。\nさあ、イコールツインが まっておるぞ!',
      },
    ],
  },
  {
    id: 'lesson-loop',
    title: 'ループ の きほん',
    category: 'loop',
    pages: [
      {
        text: 'このどうくつで まなぶのは「ループ(くりかえし)」。\nおなじことを なんども やるとき、にんげんは あきる。だから コンピュータに やらせるのじゃ。',
        demo: 'loop-count',
      },
      {
        text: 'for (let i = 0; i < 3; i++) {\n  こうげき;\n}\nこれで こうげきを 3かい くりかえす!',
        demo: 'loop-count',
      },
      {
        text: 'for の ( ) は 3つの ぶひんで できておる。\nlet i = 0 → かぞえはじめ\ni < 3 → つづける じょうけん\ni++ → 1ずつ ふやす',
      },
      {
        text: 'i は 0 → 1 → 2 と すすみ、i が 3 に なると i < 3 が false になって おわる。\nだから 3かい! 0から かぞえるのが コツじゃ。',
        demo: 'loop-count',
      },
      {
        text: 'while (じょうけん) { … } は じょうけんが true の あいだ くりかえす。\nもし じょうけんが ずっと true だと… えいえんに おわらない「むげんループ」じゃ! おそろしい!',
      },
      {
        text: 'とちゅうで やめたいときは break、\n1かいだけ とばしたいときは continue。\nさあ、ゴブリンどもを けちらして ドラゴンを たおすのじゃ!',
      },
    ],
  },
  {
    id: 'lesson-function',
    title: 'かんすう の きほん',
    category: 'function',
    pages: [
      {
        text: 'この塔で まなぶのは「かんすう(関数)」。\nかんすうとは…「ざいりょうを いれると こたえが でてくる きかい」じゃ。',
        demo: 'func-machine',
      },
      {
        text: 'function add(a, b) {\n  return a + b;\n}\nadd という きかいを つくった。a と b が「ひきすう(ざいりょう)」じゃ。',
        demo: 'func-machine',
      },
      {
        text: 'add(2, 3) と かくと きかいが うごく!\na に 2、b に 3 が はいって、return で 5 を もちかえる。',
        demo: 'func-machine',
      },
      {
        text: 'return は「もちかえる あたい」。\nreturn を わすれると… かんすうは undefined を もちかえる。\nゾンビに ならぬよう きをつけよ!',
        demo: 'func-return',
      },
      {
        text: 'みじかく かくなら アロー(=>)かんすう。\nconst f = (x) => x * 2;\n=> の みぎの しきが そのまま return される。f(3) は 6 じゃ。',
      },
      {
        text: 'かんすうの なかで let した へんすうは そとから みえない(スコープ)。\nきかいの なかみは きかいの ひみつ、と おぼえよ。\nさあ、塔の ぬしに いどめ!',
      },
    ],
  },
  {
    id: 'lesson-array',
    title: 'はいれつ の きほん',
    category: 'array',
    pages: [
      {
        text: 'このうみで まなぶのは「はいれつ(配列)」。\nはいれつとは…「はこが 1れつに ならんだ たな」じゃ。',
        demo: 'array-index',
      },
      {
        text: 'const arr = [10, 20, 30];\n[ ] で つくる。はこには 0, 1, 2… と ばんごうが ふられておる。\n0から はじまるのが かんじん!',
        demo: 'array-index',
      },
      {
        text: 'arr[0] は 10、arr[1] は 20。\narr.length は はこの こすう(3)。\nさいごの はこは arr[arr.length - 1] じゃ。',
        demo: 'array-index',
      },
      {
        text: 'たなに はこを たすには push。\narr.push(40); ← さいごに 40 が ならぶ\nさいごの はこを とるのは pop じゃ。',
      },
      {
        text: 'はいれつには まほうが ある。\n.map(x => x * 2) → ぜんいんを へんしんさせた あたらしい れつ\n.filter(...) → じょうけんに あう ものだけ のこす',
        demo: 'array-map',
      },
      {
        text: 'さいごの ちゅうい: はいれつの コピーは「おなじ たなを さす ゆびさき」。\nconst b = a; b.push(3) すると a にも みえるぞ。\nさあ、クラーケンとの さいしゅうけっせんじゃ!',
      },
    ],
  },
];

/** エリアに対応するレッスン */
export const LESSON_FOR_AREA: Record<string, string> = {
  area1: 'lesson-variable',
  area2: 'lesson-condition',
  area3: 'lesson-loop',
  area4: 'lesson-function',
  area5: 'lesson-array',
};

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
