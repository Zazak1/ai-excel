from __future__ import annotations

import ast


class SandboxValidationError(ValueError):
    pass


_ALLOWED_IMPORTS = {
    "pandas",
    "numpy",
    "openpyxl",
    "matplotlib",
    "math",
    "re",
    "datetime",
    "typing",
    "collections",
}

_BANNED_NAMES = {
    "eval",
    "exec",
    "__import__",
    "compile",
    "open",
    "input",
    "globals",
    "locals",
}


def validate_generated_code(code: str, *, required_function: str = "transform") -> None:
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        raise SandboxValidationError(f"SyntaxError: {exc}") from exc

    has_required = False

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                mod = (alias.name or "").split(".")[0]
                if mod not in _ALLOWED_IMPORTS:
                    raise SandboxValidationError(f"Disallowed import: {alias.name}")
        elif isinstance(node, ast.ImportFrom):
            mod = (node.module or "").split(".")[0]
            if mod and mod not in _ALLOWED_IMPORTS:
                raise SandboxValidationError(f"Disallowed import: {node.module}")
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in _BANNED_NAMES:
                raise SandboxValidationError(f"Disallowed builtin call: {node.func.id}()")
        elif isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            if node.value.id in {"os", "sys", "subprocess", "socket"}:
                raise SandboxValidationError(f"Disallowed module usage: {node.value.id}.{node.attr}")
        elif isinstance(node, ast.FunctionDef) and node.name == required_function:
            has_required = True

    if not has_required:
        raise SandboxValidationError(f"Missing required function: {required_function}()")
