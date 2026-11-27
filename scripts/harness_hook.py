"""Codex PreToolUse and Stop handlers for the project harness."""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESTRUCTIVE = re.compile(
    r"\brm\s+-(?:rf|fr)\b|\bgit\s+push\s+--force\b|"
    r"\bgit\s+reset\s+--hard\b|\bDROP\s+TABLE\b", re.IGNORECASE
)


def main():
    event = json.load(sys.stdin)
    if event["hook_event_name"] == "PreToolUse":
        command = event.get("tool_input", {}).get("command", "")
        if DESTRUCTIVE.search(command):
            print("하네스에서 파괴적 명령을 차단했습니다.", file=sys.stderr)
            return 2
        return 0

    manifest = ROOT / "package.json"
    if manifest.exists() and not event.get("stop_hook_active"):
        scripts = json.loads(manifest.read_text()).get("scripts", {})
        for task in ("lint", "build", "test"):
            if task in scripts:
                result = subprocess.run(["npm", "run", task], cwd=ROOT, stdout=sys.stderr)
                if result.returncode:
                    print(f"npm run {task} 실패", file=sys.stderr)
                    return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
