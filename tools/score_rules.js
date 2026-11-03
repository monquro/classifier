/* 규칙 분류기와 가림 처리를 채점한다 — 브라우저와 똑같은 코드(rules.js · mask.js)로.
 *
 *   node tools/score_rules.js          사람이 읽는 표
 *   node tools/score_rules.js --json   숫자만 (실측결과.md 대조용)
 */
const fs = require("fs");
const path = require("path");
const Rules = require("../rules.js");
const Mask = require("../mask.js");

const here = path.join(__dirname, "..");
const criteria = JSON.parse(fs.readFileSync(path.join(here, "criteria.json"), "utf8"));
const test = JSON.parse(fs.readFileSync(path.join(here, "data", "answer100.json"), "utf8"));
const practice = JSON.parse(fs.readFileSync(path.join(here, "data", "practice200.json"), "utf8"));
const all = test.concat(practice);

// 화면과 똑같이 — 먼저 가리고, 가린 문장을 분류한다
const byRule = r => Rules.classify(Mask.mask(r.text).masked, criteria);
const s100 = Rules.score(test, byRule);
const s300 = Rules.score(all, byRule);

// 가림 — 개인정보가 «들어 있는» 문장(note 에 «개인정보 포함» · «개인정보(»)은 전부 가려져야 하고,
// 나머지는 하나도 가려지면 안 된다. «개인정보 삭제 요청»처럼 주제로만 말하는 문장은 들어 있는 게 아니다
const hasPII = r => /개인정보 포함|개인정보\(/.test(r.note || "");
const pii = all.filter(hasPII);
const clean = all.filter(r => !hasPII(r));
const masked = pii.filter(r => Mask.mask(r.text).found.length > 0);
const leftover = pii.filter(r => /\d{3}-\d{4}-\d{4}|\d{6}/.test(Mask.mask(r.text).masked));
const falsePos = clean.filter(r => Mask.mask(r.text).found.length > 0);

const out = {
  rules_100: s100.accuracy,
  rules_300: s300.accuracy,
  mask: { pii: pii.length, caught: masked.length, digits_left: leftover.length, false_positive: falsePos.length },
  wrong_100: s100.wrong.length,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(out));
} else {
  console.log("규칙 분류기 — 채점용 100건");
  console.log(`  분류 ${out.rules_100.category}% · 감정 ${out.rules_100.sentiment}% · 긴급도 ${out.rules_100.urgency}%`);
  console.log(`  셋 다 맞은 문장 ${100 - out.wrong_100}건`);
  console.log("규칙 분류기 — 전체 300건");
  console.log(`  분류 ${out.rules_300.category}% · 감정 ${out.rules_300.sentiment}% · 긴급도 ${out.rules_300.urgency}%`);
  console.log("가림 처리 — 전체 300건");
  console.log(`  개인정보 문장 ${out.mask.pii}건 중 가림 ${out.mask.caught}건 · 숫자가 남은 문장 ${out.mask.digits_left}건`);
  console.log(`  개인정보 없는 문장을 잘못 가린 것 ${out.mask.false_positive}건`);
  falsePos.forEach(r => console.log(`    잘못 가림  ${r.id}  ${Mask.mask(r.text).found.map(f => f.type + ":" + f.value).join(", ")}`));
  pii.forEach(r => console.log(`    ${r.id}  ${Mask.mask(r.text).masked}`));
  console.log("분류 오답 (채점용)");
  s100.wrong.filter(w => w.got.category !== w.want.category)
    .forEach(w => console.log(`    ${w.id} 정답 ${w.want.category} / 규칙 ${w.got.category}  ${w.got.why.category}`));
}
