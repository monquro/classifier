/* 규칙 분류기 — AI 없이 criteria.json 의 기준만으로 분류한다.
 *
 * 이게 «기준선»이다. AI를 붙이기 전에, 사람이 정한 기준을 그대로 적용하면
 * 몇 점이 나오는지부터 잰다. AI가 이것보다 못하면 AI를 쓸 이유가 없다.
 *
 * 브라우저에서도(window.Rules), node 에서도(require) 쓸 수 있다.
 */
(function (root) {
  "use strict";

  function hit(text, words) {
    for (const w of words || []) if (text.includes(w)) return w;
    return null;
  }

  // «앱»이 / «해지»가 — 받침에 맞는 조사
  function iga(word) {
    const c = String(word).trim().slice(-1).charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? "이" : "가";
    return "이(가)";
  }

  function classify(text, criteria) {
    const t = String(text || "");
    const why = {};

    // 분류 — 우선순위대로 훑어서 처음 걸리는 것
    let category = "기타";
    why.category = "어느 분류의 신호도 없어서 «기타»";
    for (const name of criteria.priority) {
      const cat = criteria.categories.find(c => c.name === name);
      const w = cat && hit(t, cat.keywords);
      if (w) { category = name; why.category = `«${w}»${iga(w)} 있어서 «${name}»`; break; }
    }

    // 감정 — 부정 신호가 먼저
    const neg = hit(t, criteria.sentiment["부정"]);
    const pos = hit(t, criteria.sentiment["긍정"]);
    const sentiment = neg ? "부정" : pos ? "긍정" : "중립";
    why.sentiment = neg ? `«${neg}»` : pos ? `«${pos}»` : "신호 없음";

    // 긴급도 — 높음 신호가 먼저
    const hi = hit(t, criteria.urgency["높음"]);
    const lo = hit(t, criteria.urgency["낮음"]);
    const urgency = hi ? "높음" : lo ? "낮음" : "보통";
    why.urgency = hi ? `«${hi}»` : lo ? `«${lo}»` : "신호 없음";

    return { category, sentiment, urgency, why, by: "규칙" };
  }

  /* 정답과 비교해 채점한다. rows = [{text, category, sentiment, urgency}] */
  function score(rows, predict) {
    const keys = ["category", "sentiment", "urgency"];
    const right = { category: 0, sentiment: 0, urgency: 0 };
    const wrong = [];
    const confusion = {};
    rows.forEach((r, i) => {
      const p = predict(r, i);
      let allOk = true;
      for (const k of keys) {
        if (p[k] === r[k]) right[k] += 1; else allOk = false;
      }
      const key = r.category + "→" + p.category;
      confusion[key] = (confusion[key] || 0) + 1;
      if (!allOk) wrong.push({ id: r.id, text: r.text, want: r, got: p, note: r.note });
    });
    const n = rows.length;
    const pct = k => Math.round((right[k] / n) * 1000) / 10;
    return {
      n,
      right,
      accuracy: { category: pct("category"), sentiment: pct("sentiment"), urgency: pct("urgency") },
      wrong,
      confusion,
    };
  }

  const api = { classify, score };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Rules = api;
})(this);
