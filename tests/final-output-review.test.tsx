import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Review } from "../src/components/output/OutputPanel";
import type { Version } from "../src/lib/output/types";

it("원본을 펼치기 전에도 실행 링크와 검증 결과가 보인다", () => {
  const quote = "안드로이드 기기 3대에서 실행 확인";
  const url = "https://example.org/demo/v2?lang=ko";
  const doc: Version = { title: "시제품", version: 1, issues: [],
    sources: [{ id: "demo", title: "시제품", assignee: "민지", assigneeId: "qa", text: quote, url }],
    sections: [{ title: "실행 링크", criteria: "URL과 검증 결과", kind: "links", sourceIds: ["demo"],
      rows: [], body: "검증 결과 · " + quote }] };
  const visible = renderToStaticMarkup(<Review doc={doc} memberId="qa"/>).split("<details>")[0];
  expect(visible).toContain(quote);
  expect(visible).toContain('href="' + url + '"');
});
