// 所有固定说法放在这里。家长录音清单要覆盖它们（见 tests/speech.test.ts）。
// 新增要读出来的话，先加到这里，不要在组件里直接写字符串。

export const PRAISE = ['对了！', '真棒！', '答对了！', '想得好！'] as const

export const PHRASES = {
  warmup: '看到几就按几，按得越快越好',
  teachIntro: '我们来学新的。',
  explainIntro: '我们一起看看。',
  fixPrompt: '你来写出答案',
  fixOk: '对了，记住它',
  placementWrong: '没关系，下一题',
  pickOp: '先选加号还是减号',
  doneDaily: '今天的练习做完了！',
  donePlacement: '看完啦，小伙伴们出来了！',
  doneFree: '玩得真开心',
  doneStopped: '下次接着玩',
  hatched: '孵出来了',
  grew: '长大了',
  egg: '还是一颗蛋',
  challengeStart: '口算挑战，开始！',
  challengeDone: '做完了！看看你用了多久',
  challengeFaster: '比上次快了！',
  challengeSlower: '没关系，下次再快一点',
} as const
