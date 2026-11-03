#!/bin/sh
set -e
here=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
python3 "$here/uninstall.py" "$@"
