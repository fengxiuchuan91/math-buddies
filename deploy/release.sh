#!/usr/bin/env bash
# 数学小伙伴：在 Mac 上 测试 → 构建 → 上传 → 切换版本。兼容 macOS 自带的 bash 3.2。
#
# 先复制配置：cp deploy/release.env.example deploy/release.env，填好服务器和域名。
#
#   ./deploy/release.sh install      首次：装 Caddy 站点配置，并发布一版
#   ./deploy/release.sh              发布新版本（先跑测试和构建）
#   ./deploy/release.sh rollback     切回上一个版本
#   ./deploy/release.sh status       看线上版本和首页能否打开
#   ./deploy/release.sh build        只在本地测试、构建，不上传
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/deploy"
CMD="${1:-release}"
APP_DIR=/opt/mathbuddies

die() { echo "错误：$*" >&2; exit 1; }
say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

case "$CMD" in
  install|release|rollback|status|build) ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

build() {
  say "测试与构建"
  cd "$ROOT"
  npm test
  npm run build
  [ -f dist/index.html ] || die "构建产物缺少 dist/index.html"
}

if [ "$CMD" = build ]; then build; exit 0; fi

RELEASE_ENV="${RELEASE_ENV:-$DEPLOY/release.env}"
[ -f "$RELEASE_ENV" ] || die "缺少 deploy/release.env，先 cp deploy/release.env.example deploy/release.env 并填写"
# shellcheck disable=SC1090
. "$RELEASE_ENV"
: "${ECS_HOST:?release.env 里要写 ECS_HOST}"
: "${MB_DOMAIN:?release.env 里要写 MB_DOMAIN，例如 math.example.com}"
SSH_PORT="${SSH_PORT:-22}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
case "$MB_DOMAIN" in *[!A-Za-z0-9.-]*|"") die "MB_DOMAIN 只能是域名：$MB_DOMAIN" ;; esac
case "$KEEP_RELEASES" in *[!0-9]*|"") die "KEEP_RELEASES 要是数字" ;; esac

SSH_OPTS="-p $SSH_PORT -o ServerAliveInterval=20"
[ -n "${SSH_KEY:-}" ] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
# shellcheck disable=SC2086
remote() { ssh $SSH_OPTS "$ECS_HOST" "$@"; }
# 远程用 root 登录就不加 sudo
SUDO='if [ "$(id -u)" -ne 0 ]; then SUDO=sudo; else SUDO=; fi;'

upload() {
  local ver
  ver="$(date +%Y%m%d-%H%M%S)-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
  say "上传版本 $ver"
  # 打包流式上传，再原子切换 current 链接，访问中的孩子不会看到半个版本
  tar -C "$ROOT/dist" -czf - . | remote "$SUDO set -e
    \$SUDO mkdir -p $APP_DIR/releases/$ver
    \$SUDO tar -xzf - -C $APP_DIR/releases/$ver
    \$SUDO chmod -R a+rX $APP_DIR/releases/$ver
    \$SUDO ln -sfn $APP_DIR/releases/$ver $APP_DIR/current
    cd $APP_DIR/releases && ls -1 | sort | head -n -$KEEP_RELEASES | xargs -r \$SUDO rm -rf"
}

install_site() {
  say "安装 Caddy 站点配置"
  sed "s/^MB_DOMAIN {/$MB_DOMAIN {/" "$DEPLOY/mathbuddies.caddy" | remote "$SUDO set -e
    \$SUDO mkdir -p /etc/caddy/sites $APP_DIR/releases
    \$SUDO tee /etc/caddy/sites/mathbuddies.caddy >/dev/null
    grep -q 'import /etc/caddy/sites/\*.caddy' /etc/caddy/Caddyfile || { echo '主配置里缺 import /etc/caddy/sites/*.caddy' >&2; exit 1; }
    \$SUDO caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    \$SUDO systemctl reload caddy"
}

status() {
  say "线上版本"
  remote "readlink $APP_DIR/current; ls -1 $APP_DIR/releases | tail -n $KEEP_RELEASES"
  say "首页"
  curl -s -o /dev/null -w "https://$MB_DOMAIN/ → %{http_code}\n" --max-time 15 "https://$MB_DOMAIN/" || true
}

case "$CMD" in
  install) build; install_site; upload; status ;;
  release) build; upload; status ;;
  rollback)
    say "切回上一个版本"
    remote "$SUDO set -e
      prev=\$(ls -1 $APP_DIR/releases | sort | tail -n 2 | head -n 1)
      cur=\$(basename \"\$(readlink $APP_DIR/current)\")
      [ -n \"\$prev\" ] && [ \"\$prev\" != \"\$cur\" ] || { echo '没有更早的版本' >&2; exit 1; }
      \$SUDO ln -sfn $APP_DIR/releases/\$prev $APP_DIR/current
      echo \"已切到 \$prev\""
    status ;;
  status) status ;;
esac
