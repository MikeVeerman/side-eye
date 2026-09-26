"""The PII wall. One rule: only source code files leave the machine.

Config, env, data and lock files are never sent, whatever folder they live in.
The rule is by extension only, on purpose. Path rules would be a second thing to reason about.
"""

import os

SOURCE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".rb", ".kt",
    ".cs", ".c", ".cpp", ".h", ".hpp",
}


def is_source(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in SOURCE_EXTENSIONS
