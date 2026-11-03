#!/usr/bin/env python3
import re, shutil, sys
from pathlib import Path

PLUGIN_ID = "spdj"
if len(sys.argv) > 1:
    rel = Path(sys.argv[1])
else:
    raise SystemExit("用法: python3 linux/uninstall.py 游戏目录")

index = rel / "public" / "index.html"
h = index.read_text(encoding="utf-8")
h = re.sub(r'\s*<script[^>]*src=["\']/sp-lite/[^"\']+["\'][^>]*>\s*</script>', "", h)
h = re.sub(r'\s*<script[^>]*src=["\']/sp-plugins/spdj/[^"\']+["\'][^>]*>\s*</script>', "", h)
index.write_text(h, encoding="utf-8")
targets = [
    rel / "plugins" / PLUGIN_ID,
    rel / "public" / "sp-plugins" / PLUGIN_ID,
    rel / "public" / "sp-lite",
]
alt = rel.parent.parent / "plugins" / PLUGIN_ID
if alt.exists():
    targets.append(alt)
for p in targets:
    if p.exists():
        shutil.rmtree(p)
print("uninstalled", rel)
