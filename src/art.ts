// 已到位的小伙伴画。文件名是「小伙伴编号-阶段.webp」，例如 dino-8-1.webp。
// 没有图的用代码画的占位图。

const files = import.meta.glob('./assets/buddies/*.webp', { eager: true, import: 'default' }) as Record<string, string>

export const ART: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.webp$/, ''), url]),
)
