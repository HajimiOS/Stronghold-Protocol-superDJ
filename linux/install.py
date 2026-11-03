#!/usr/bin/env python3
import hashlib, re, shutil, sys
from pathlib import Path

PLUGIN_ID = "spdj"
RUNTIME = ("fab-seed.js", "boot.js", "music.js", "anim.js")
root = Path(__file__).resolve().parent.parent
if len(sys.argv) > 1:
    rel = Path(sys.argv[1])
else:
    raise SystemExit("用法: python3 linux/install.py 游戏目录")
if not (rel / "public" / "index.html").is_file() or not (rel / "public" / "js" / "boot.js").is_file():
    raise SystemExit("不是卫戍协议游戏目录")

def plugin_dirs(game: Path):
    dirs = [game / "plugins"]
    alt = game.parent.parent / "plugins"
    if alt.is_dir() and alt.resolve() != dirs[0].resolve():
        dirs.append(alt)
    return dirs

for base in plugin_dirs(rel):
    plugin = base / PLUGIN_ID
    if plugin.exists():
        shutil.rmtree(plugin)
    plugin.mkdir(parents=True)
    src = root / "plugin.json"
    if src.is_file():
        shutil.copy2(src, plugin / "plugin.json")
    frame_src = root / "frame"
    if frame_src.is_dir():
        shutil.copytree(frame_src, plugin / "frame")

pub = rel / "public" / "sp-plugins" / PLUGIN_ID
if pub.exists():
    shutil.rmtree(pub)
pub.mkdir(parents=True)
for name in RUNTIME:
    shutil.copy2(root / name, pub / name)
if (root / "assets").is_dir():
    shutil.copytree(root / "assets", pub / "assets")

old = rel / "public" / "sp-lite"
if old.exists():
    shutil.rmtree(old)

index = rel / "public" / "index.html"
h = index.read_text(encoding="utf-8")
h = re.sub(r'\s*<script[^>]*src=["\']/sp-lite/[^"\']+["\'][^>]*>\s*</script>', "", h)
h = re.sub(r'\s*<script[^>]*src=["\']/sp-plugins/spdj/[^"\']+["\'][^>]*>\s*</script>', "", h)
ver = hashlib.sha256((root / "fab-seed.js").read_bytes()).hexdigest()[:8]
tag = f'<script src="/sp-plugins/{PLUGIN_ID}/fab-seed.js?v={ver}"></script>'
needle = '<script src="/js/boot.js"></script>'
if needle not in h:
    raise SystemExit("boot.js not found")
h = h.replace(needle, tag + "\n  " + needle, 1)
index.write_text(h, encoding="utf-8")
print("installed", rel, "-> plugins/" + PLUGIN_ID)
