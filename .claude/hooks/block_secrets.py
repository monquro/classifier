# -*- coding: utf-8 -*-
"""검문 훅 — 열쇠가 섞인 채 저장 지점을 남기거나 올리지 못하게 막는다 (2부 7-15).

언제 도나
    Claude Code가 명령을 실행하기 직전(PreToolUse). 그 명령에 git commit · push · add 가 있을 때만 검사한다.

무엇을 보나
    그 명령의 글자 자체 — 파일에 열쇠를 써 넣으면서 같은 줄에서 바로 저장하는 경우를 잡는다.
    올라갈 수 있는 파일 — 이미 담아 둔 것(staged) · 고친 것 · 새로 생긴 것(제외 목록에 든 것은 빼고).
    push 라면 저장소에 든 파일 전부.

무엇을 하나
    열쇠 모양의 값이 있으면 exit 2 로 그 명령을 막고, 어느 파일 몇째 줄인지 알려 준다.
    찾은 값은 앞 네 글자만 보여 준다 — 검문이 열쇠를 대화에 옮겨 적으면 안 되니까.

무엇을 하지 않나
    파일을 고치거나 지우지 않는다. 밖으로 아무것도 보내지 않는다. 검사 말고는 아무 일도 하지 않는다.

설정 (.claude/settings.json)
    "hooks": { "PreToolUse": [ { "matcher": "Bash|PowerShell",
        "hooks": [ { "type": "command", "command": "python",
                     "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/block_secrets.py"] } ] } ] }
"""
import json
import os
import re
import subprocess
import sys

# 열쇠 모양 — 이름, 무늬
PATTERNS = [
    ("Gemini/Google API 키", re.compile(r"AIza[0-9A-Za-z_\-]{20,}")),
    ("Anthropic 키", re.compile(r"sk-ant-[0-9A-Za-z_\-]{20,}")),
    ("OpenAI 키", re.compile(r"sk-(?:proj-)?[0-9A-Za-z]{20,}")),
    ("GitHub 토큰", re.compile(r"gh[pousr]_[0-9A-Za-z]{30,}")),
    ("디스코드 웹훅 주소", re.compile(r"https://(?:ptb\.|canary\.)?discord(?:app)?\.com/api/webhooks/\d+/[\w\-]+")),
    ("코드에 적힌 비밀 값", re.compile(r"(?i)\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*[\"'][^\"'\s]{16,}[\"']")),
]
GIT_ACTION = re.compile(r"\bgit\b(?:\s+-\S+(?:\s+\S+)?)*\s+(commit|push|add)\b")
MAX_BYTES = 2_000_000          # 이보다 큰 파일은 데이터로 보고 건너뛴다


def git(root, *args):
    r = subprocess.run(["git", "-c", "core.quotepath=false", *args], cwd=root,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.stdout if r.returncode == 0 else ""


def candidates(root, action):
    names = set()
    names.update(git(root, "diff", "--cached", "--name-only", "-z").split("\0"))
    names.update(git(root, "ls-files", "-m", "-o", "--exclude-standard", "-z").split("\0"))
    if action == "push":
        names.update(git(root, "ls-files", "-z").split("\0"))
    return sorted(n for n in names if n)


def scan(root, rel):
    path = os.path.join(root, rel)
    try:
        if not os.path.isfile(path) or os.path.getsize(path) > MAX_BYTES:
            return []
        with open(path, "rb") as f:
            raw = f.read()
    except OSError:
        return []
    if b"\0" in raw[:8000]:            # 그림 · 압축 파일 같은 바이너리
        return []
    found = []
    for no, line in enumerate(raw.decode("utf-8", errors="ignore").splitlines(), 1):
        for label, pat in PATTERNS:
            m = pat.search(line)
            if m:
                found.append((rel, no, label, m.group(0)[:4] + "…"))
                break
    return found


def main():
    # 윈도우의 기본 문자표(cp949)로는 «—» 같은 글자를 못 써서, 알림을 쓰다 죽으면 막지 못하고 통과된다.
    # 들어오는 것도 나가는 것도 UTF-8 로 못 박는다.
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        data = json.loads(sys.stdin.buffer.read().decode("utf-8", errors="replace"))
    except Exception:
        return 0                        # 읽을 수 없는 입력이면 막지 않는다
    command = str((data.get("tool_input") or {}).get("command") or "")
    m = GIT_ACTION.search(command)
    if not m:
        return 0
    # 명령 한 줄 안에서 파일에 열쇠를 써 넣고 곧바로 저장하면(… >> app.js && git commit),
    # 이 훅이 도는 순간에는 열쇠가 아직 파일에 없다. 그래서 명령 글자 자체도 본다 (2026-10-22 실측).
    for label, pat in PATTERNS:
        cm = pat.search(command)
        if cm:
            print("검문 훅이 막았습니다 — 저장하거나 올리는 명령 안에 열쇠로 보이는 값이 함께 적혀 있습니다.\n"
                  f"  명령  {label}  {cm.group(0)[:4]}…\n"
                  "열쇠는 코드에 두지 않고 배포 서비스의 설정에만 둡니다(7-5).", file=sys.stderr)
            return 2
    root = data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    top = git(root, "rev-parse", "--show-toplevel").strip()
    if not top:
        return 0                        # 저장소가 아니면 검사할 것이 없다
    hits = []
    for rel in candidates(top, m.group(1)):
        hits.extend(scan(top, rel))
    if not hits:
        return 0
    lines = ["검문 훅이 막았습니다 — 열쇠로 보이는 값이 올라갈 수 있는 파일에 있습니다."]
    for rel, no, label, head in hits[:10]:
        lines.append(f"  {rel}:{no}  {label}  {head}")
    if len(hits) > 10:
        lines.append(f"  … 외 {len(hits) - 10}곳")
    lines.append("열쇠는 코드에 두지 않고 배포 서비스의 설정에만 둡니다(7-5). 그 줄을 지운 뒤 다시 시키십시오.")
    lines.append("이미 저장 지점에 들어갔거나 올라갔다면, 그 열쇠를 먼저 폐기합니다(7-6).")
    print("\n".join(lines), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
