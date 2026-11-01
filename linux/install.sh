#!/bin/sh
set -e
here=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
src=$(CDPATH= cd -- "$here/.." && pwd)/public/sp-lite
rel=$1
if [ -z "$rel" ] || [ ! -f "$rel/public/index.html" ] || [ ! -f "$rel/public/js/boot.js" ]; then
  echo "用法: sh linux/install.sh 游戏目录" >&2
  echo "游戏目录是含有 public/index.html 的那一层。" >&2
  exit 1
fi
if [ ! -d "$src" ]; then
  echo "找不到模块目录: $src" >&2
  exit 1
fi
dest="$rel/public/sp-lite"
rm -rf "$dest"
mkdir -p "$dest"
cp -a "$src/." "$dest/"
seed="$dest/fab-seed.js"
if command -v sha256sum >/dev/null 2>&1; then
  ver=$(sha256sum "$seed" | cut -c1-8)
elif command -v sha256 >/dev/null 2>&1; then
  ver=$(sha256 -q "$seed" | cut -c1-8)
else
  ver=$(cksum "$seed" | awk '{print $1}')
fi
tag="<script src=\"/sp-lite/fab-seed.js?v=${ver}\"></script>"
tmp=$(mktemp)
if ! awk -v tag="$tag" '
  /<script[^>]*src=["'\'']\/sp-lite\// { next }
  /<script src="\/js\/boot\.js"><\/script>/ && !done { print tag; done=1 }
  { print }
  END { if (!done) exit 2 }
' "$rel/public/index.html" > "$tmp"; then
  rm -f "$tmp"
  echo "找不到 boot.js" >&2
  exit 1
fi
mv "$tmp" "$rel/public/index.html"
echo "已安装 $rel"
