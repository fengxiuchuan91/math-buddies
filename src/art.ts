// 已到位的画，放在 src/assets/art/，按文件名取：
//   小伙伴「编号-阶段.webp」（dino-8-1.webp），蛋「egg-世界.webp」，
//   装饰「decor-1~8.webp」，世界背景「bg-世界.webp」。
// 没有图的用代码画的占位图。

const files = import.meta.glob('./assets/art/*.webp', { eager: true, import: 'default' }) as Record<string, string>

export const ART: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.webp$/, ''), url]),
)
