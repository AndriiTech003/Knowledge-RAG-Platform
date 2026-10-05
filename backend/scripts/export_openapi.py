from __future__ import annotations

import json
import sys
from pathlib import Path

from kb.main import create_app


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "openapi.json"
    spec = create_app().openapi()
    target.write_text(json.dumps(spec, indent=2, sort_keys=False) + "\n")
    sys.stdout.write(f"openapi: {len(spec['paths'])} paths written to {target}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
