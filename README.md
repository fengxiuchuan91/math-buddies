# 数学小伙伴

给一年级孩子练 20 以内加减法的 H5 小游戏。照顾小伙伴、间隔复习、答错讲解。规格见 [docs/design.md](./docs/design.md)。

第一版只用一台手机，数据都在手机浏览器里，没有后端。

## 本地运行

需要 Node 22。

```bash
npm install
npm run dev        # 手机和电脑连同一个 Wi-Fi，用手机打开终端里显示的局域网地址
npm test           # 单元测试
npm run e2e        # Playwright 端到端测试：手机尺寸走一遍全部页面，截图在 tmp-screenshots/
npm run check      # 类型检查 + 单元测试 + 端到端测试
npm run build
node scripts/serve-dist.mjs   # 用和线上一样的响应头预览 dist/
```

## 给孩子用

1. 用手机自带的 Safari 或 Chrome 打开网址，加到主屏幕，以后都从主屏幕打开。微信里打开也能玩，但微信和 Safari 的数据不互通
2. 家长先进录音页录几句（首页提示里的“去录音”，或右上角 🔒 进家长区）
3. 孩子点“先玩一玩”做摸底，之后每天点“开始今天的练习”，约 10 分钟
4. 换手机或清缓存前，在家长区“导出备份”

## 画

小伙伴的画由 `scripts/art.mjs` 调 OpenAI 兼容的生图接口生成。配置写在 `.env.local`（不提交，参考 `.env.example`）：

```bash
npm run art models     # 列出可用模型
npm run art batch      # 画全部小伙伴、蛋、装饰、背景，可中断续跑
npm run art finalize   # 压成 WebP 放进 src/assets/art/
```

## 部署

```bash
cp deploy/release.env.example deploy/release.env   # 填 ECS 的 ssh 地址和子域名
./deploy/release.sh install    # 首次：装 Caddy 站点并发布
./deploy/release.sh            # 之后每次发布
./deploy/release.sh rollback   # 切回上一个版本
```
