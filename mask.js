/* 가림 처리 — AI에 보내기 전에, 브라우저 안에서.
 *
 * 무료 AI API는 보낸 내용을 서비스 개선에 쓸 수 있다(도구_무료확인.md).
 * 그래서 개인정보는 «내 컴퓨터를 떠나기 전에» 가린다. 서버에서 가리면 이미 늦다.
 *
 * 자동 가림은 완벽하지 않다. 무엇을 잡고 무엇을 놓치는지 채점해서 안다.
 */
(function (root) {
  "use strict";

  // 흔한 성씨 — «장기 고객»의 «장기»처럼 이름이 아닌 두 글자를 잡지 않으려고 세 글자 + 성씨로 좁힌다
  const SURNAMES = "김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주우구민나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모";

  const PATTERNS = [
    { type: "이메일", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
    { type: "전화번호", re: /01[016789][- ]?\d{3,4}[- ]?\d{4}/g },
    { type: "주소", re: /[가-힣]+(?:시|도)\s?[가-힣]+(?:구|군)\s?[가-힣]+(?:동|읍|면)/g },
    { type: "생년월일", re: /(?<!\d)\d{6}(?!\d)/g },
    { type: "이름", re: new RegExp(`(?<![가-힣])[${SURNAMES}][가-힣]{2}(?=\\s?(?:입니다|고객|드림|님))`, "g") },
    { type: "이름", re: new RegExp(`(?<=명의자\\s?)[${SURNAMES}][가-힣]{2}(?![가-힣])`, "g") },
  ];

  function mask(text) {
    let out = String(text || "");
    const found = [];
    for (const p of PATTERNS) {
      out = out.replace(p.re, m => { found.push({ type: p.type, value: m }); return `[${p.type}]`; });
    }
    return { masked: out, found };
  }

  const api = { mask };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Mask = api;
})(this);
