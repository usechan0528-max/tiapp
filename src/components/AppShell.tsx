"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export const destinations = [
  { href: "/", label: "TF 팀", icon: "◉" },
  { href: "/plan", label: "계획", icon: "▤" },
  { href: "/board", label: "업무판", icon: "▦" },
  { href: "/output", label: "결과물", icon: "◈" },
] as const;

export function Navigation({ path }: { path: string }) {
  return <nav className="app-nav" aria-label="프로젝트 탐색">
    {destinations.map(({ href, label, icon }) => (
      <Link key={href} href={href} aria-current={(path === href || (href === "/" && path.startsWith("/join"))) ? "page" : undefined}>
        <span className="nav-icon" aria-hidden="true">{icon}</span>{label}
      </Link>
    ))}
  </nav>;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = shell.current;
    if (!root) return;
    let frame = 0;
    function keepFieldVisible() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const field = document.activeElement;
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)
            || !window.matchMedia("(max-width: 820px)").matches) {
          root?.style.removeProperty("--keyboard-inset");
          return;
        }
        const top = viewport?.offsetTop ?? 0;
        const bottom = top + (viewport?.height ?? window.innerHeight);
        root?.style.setProperty("--keyboard-inset", Math.max(0, window.innerHeight - bottom) + "px");
        const navTop = root?.querySelector("nav")?.getBoundingClientRect().top ?? bottom;
        const fieldBox = field.getBoundingClientRect();
        const lowerEdge = Math.min(bottom, navTop) - 12;
        if (fieldBox.height > lowerEdge - top - 12) return;
        if (fieldBox.bottom > lowerEdge) window.scrollBy(0, fieldBox.bottom - lowerEdge);
        else if (fieldBox.top < top + 12) window.scrollBy(0, fieldBox.top - top - 12);
      });
    }
    document.addEventListener("focusin", keepFieldVisible);
    document.addEventListener("focusout", keepFieldVisible);
    window.addEventListener("resize", keepFieldVisible);
    viewport?.addEventListener("resize", keepFieldVisible);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", keepFieldVisible);
      document.removeEventListener("focusout", keepFieldVisible);
      window.removeEventListener("resize", keepFieldVisible);
      viewport?.removeEventListener("resize", keepFieldVisible);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
  return <div ref={shell} className="app-shell">
    <a className="skip" href="#workspace">본문으로 이동</a>
    <header className="app-header"><Link className="brand" href="/" aria-label="티앱 홈"><span aria-hidden="true" className="brand-sign"><i/><i/></span>티앱</Link><a className="app-label" href="/me" aria-current={path === "/me" ? "page" : undefined}>내 팀 관리</a></header>
    <div id="workspace" className="app-content">{children}</div>
    <Navigation path={path || "/"} />
  </div>;
}
