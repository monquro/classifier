# 고객 한마디 분류기 — 2주차 목업

고객 문의 한 줄을 넣으면 **분류 · 감정 · 긴급도**를 붙입니다.
**기준은 사람이 정했고**(`criteria.json`), AI는 그 기준을 따릅니다.

## 돌려보기

```
python -m http.server 8000      # index.html 을 더블클릭하면 안 됩니다
```

로컬에서는 서버 함수(`api/classify.py`)가 돌지 않으므로 **규칙으로만** 분류합니다. 정상입니다.

## 올리기

```
1. 이 폴더를 내 GitHub 저장소로
2. vercel.com → Add New → Project → Import → Application Preset: Other → Deploy
3. Settings → Environment Variables
     GEMINI_API_KEY = (aistudio.google.com 에서 받은 키)
     GEMINI_MODEL   = (선택. 비우면 api/classify.py 의 기본값)
   → 저장하고 다시 배포
```

**키가 없으면 AI만 빠지고 나머지는 그대로 돕니다.**

## 파일

| 파일 | 하는 일 |
|---|---|
| `criteria.json` | ★ **분류 기준** — 분류 여섯 개의 정의, 여러 분류에 걸칠 때의 순서, 감정·긴급도 판단법. **사람이 정한다** |
| `rules.js` | AI 없이 기준만으로 분류하는 **규칙 분류기**. AI와 비교할 기준선 |
| `mask.js` | AI에 보내기 전 **브라우저 안에서** 전화번호·이름·생년월일·주소를 가린다 |
| `api/classify.py` | Gemini 호출. **키를 숨기기 위해** 서버에 있다 |
| `app.js` · `index.html` · `style.css` | 화면 |
| `data/answer100.json` | 정답을 붙인 **채점용 100건** |
| `data/practice200.json` | 연습용 200건 («예시 문장 넣기») |
| `tools/score_rules.js` | 규칙 분류기·가림 처리를 node 로 채점 (배포 제외) |

문장은 전부 만들어낸 것입니다. 원본과 정답은 `20_데이터/voc_text/voc_300.csv`.

## Claude Code 설정 — 부탁 · 잠금 · 검문 (교재 5-11 · 7-14 · 7-15)

| 파일 | 하는 일 |
|---|---|
| `.claude/settings.json` | 받았을 때는 **수동 모드로 시작**만 들어 있다. 7-14에서 `deny` 를, 7-15에서 훅을 학습자가 더한다 |
| `.claude/hooks/block_secrets.py` | **검문 훅.** git commit · push · add 직전에 그 명령의 글자와 올라갈 파일을 훑어 열쇠 모양이 있으면 막는다. 파일을 고치거나 밖으로 보내지 않는다. **걸기 전에 읽는다** |
| `.env.example` | 열쇠 **이름**의 견본. 값은 적지 않는다. 실제 값은 Vercel 설정에만 |
| `.gitignore` | `.env` 는 저장소에 넣지 않는다 (`.env.example` 은 넣는다) |

7-14 · 7-15를 마친 뒤의 `.claude/settings.json` 은 이렇게 됩니다.

```json
{
  "permissions": {
    "defaultMode": "default",
    "deny": ["Read(.env)", "Read(.env.*)", "Read(!.env.example)"]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          { "type": "command", "command": "python",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/block_secrets.py"] }
        ]
      }
    ]
  }
}
```

맥에서 `python` 이 없으면 `"command": "python3"` 으로 바꿉니다. 확인은 Claude Code 안에서 `/permissions` · `/hooks`.

## 규칙 분류기의 점수 (채점용 100건)

```
node tools/score_rules.js
```

분류 86% · 감정 64% · 긴급도 58% · 셋 다 맞은 문장 32건. AI 점수는 키를 넣고 **채점** 탭에서 잽니다 —
모델과 날마다 달라질 수 있어서 여기에 적지 않습니다.

## 주의

- **무료 Gemini API는 보낸 내용을 서비스 개선에 쓸 수 있습니다.** 그래서 가림은 서버가 아니라 브라우저에서 합니다
- 자동 가림은 완벽하지 않습니다. 이름 뒤에 «입니다·고객·드림·님»이 없으면 놓칩니다
- 키를 저장소에 커밋하지 마십시오. 한 번 올라가면 지워도 기록에 남습니다
- **Vercel Hobby 플랜은 개인·비상업 용도 전용입니다**
