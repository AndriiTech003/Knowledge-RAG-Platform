from __future__ import annotations

import ast
import io
import sys
import tokenize
from pathlib import Path

ROOTS = ["src", "tests", "alembic", "scripts", "loadtest"]


def comment_lines(source: str) -> list[int]:
    lines: list[int] = []
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type == tokenize.COMMENT:
            lines.append(token.start[0])
    return lines


def docstring_lines(source: str) -> list[int]:
    tree = ast.parse(source)
    found: list[int] = []
    nodes: list[ast.AST] = [tree]
    nodes.extend(
        n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef)
    )
    for node in nodes:
        body = getattr(node, "body", [])
        first = body[0] if body else None
        if (
            isinstance(first, ast.Expr)
            and isinstance(first.value, ast.Constant)
            and isinstance(first.value.value, str)
        ):
            found.append(first.lineno)
    return found


def main() -> int:
    base = Path(__file__).resolve().parents[1]
    problems: list[str] = []
    checked = 0
    for root in ROOTS:
        for path in sorted((base / root).rglob("*.py")):
            source = path.read_text(encoding="utf-8")
            checked += 1
            for line in comment_lines(source):
                problems.append(f"{path.relative_to(base)}:{line}: comment")
            for line in docstring_lines(source):
                problems.append(f"{path.relative_to(base)}:{line}: docstring")
    for problem in problems:
        sys.stdout.write(problem + "\n")
    sys.stdout.write(f"no-comments: {checked} files checked, {len(problems)} problems\n")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
