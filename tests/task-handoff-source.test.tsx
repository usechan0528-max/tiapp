import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Source } from "../src/components/tasks/Source";

it("원본 카드에서 본문과 표, 링크를 함께 연다", () => {
  const html = renderToStaticMarkup(<Source submission={{
    text: "운영 시간\n|시간|담당|\n|---|---|\n|10시|민수|\n행사 종료",
    url: "https://example.org/file",
  }} />);
  for (const content of ["운영 시간", "<table>", "<th", "시간", "<td>민수</td>", "행사 종료", 'href="https://example.org/file"'])
    expect(html).toContain(content);
});

it("스프레드시트에서 붙여넣은 셀을 표로 표시한다", () => {
  const html = renderToStaticMarkup(<Source submission={{ text: "시간\t담당\n10시\t민수" }} />);
  expect(html).toContain("<td>민수</td>");
});
