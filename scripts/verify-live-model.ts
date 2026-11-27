import assert from "node:assert/strict";
import { generatePlan } from "../src/lib/plan/model";
import { generate } from "../src/lib/output/model";

async function verify() {
  assert.notEqual(process.env.TF_TEST_MODEL, "1", "실제 모델 검증에는 테스트 모드를 해제하세요.");
  const plan = await generatePlan({
    id: "demo", name: "운영 TF", goal: "신입생 행사 10시 접수와 11시 발표 시간표 한 개를 제작한다.",
    deadline: "2026-12-15", members: [
      { id: "A", name: "지우", role: "leader", availability: "평일" },
      { id: "B", name: "민수", role: "운영", availability: "평일" },
    ],
  });
  assert.ok(plan.sections.length && plan.tasks.length);
  const source = { id: plan.tasks[0].id, title: "확정 운영표", assigneeId: "B", assignee: "민수",
    text: "10:00 접수 · 학생회관 1층 · 민수\n11:00 발표 · 학생회관 2층 · 지우", url: "" };
  const assembled = await generate({ title: plan.title, sections: plan.sections, sources: [source] });
  assert.equal(assembled.sections.length, plan.sections.length);
  assert.ok(assembled.sections.some(s => s.sourceIds.includes(source.id)));
  console.log("실제 모델 검증 통과 · 계획 업무", plan.tasks.length, "건 · 결과물 구성", assembled.sections.length, "개 · 원본 연결 확인");
}
verify().catch(error => { console.error(error.message); process.exitCode = 1; });
