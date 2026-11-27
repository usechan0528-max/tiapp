import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import AppShell from "../components/AppShell";
import "./globals.css";

export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export const metadata: Metadata = {
  title: "티앱 · TF 프로젝트 에이전트",
  description: "팀의 목표와 일정, 담당 업무와 최종 결과물을 한곳에서 확인하세요.",
  other: { "page-type": "software", "site-kind": "software" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko" data-type="software"><body><AppShell>{children}</AppShell></body></html>;
}
