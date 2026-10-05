from __future__ import annotations

import hashlib
from functools import lru_cache
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1]


@lru_cache(maxsize=1)
def source_tree_hash() -> str:
    digest = hashlib.sha256()
    for path in sorted(SOURCE_ROOT.rglob("*")):
        if path.is_file() and path.suffix in {".py", ".md"} and "__pycache__" not in path.parts:
            digest.update(path.relative_to(SOURCE_ROOT).as_posix().encode())
            digest.update(path.read_bytes())
    return f"src-{digest.hexdigest()[:12]}"
