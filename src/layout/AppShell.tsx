import { useLayoutEffect, useRef } from "react";
import { useLayoutVar } from "../hooks/useLayoutVar";

export default function AppShell({
  sidebar,
  children,
  bottomNav,
  mobileHeader,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  bottomNav?: React.ReactNode;
  mobileHeader?: React.ReactNode;
}) {
  const hasBottomNav = !!bottomNav;
  const topBarRef = useRef<HTMLDivElement | null>(null);
  // Altura real da top bar (0 fora do shell mobile): base para toasts e banners.
  useLayoutVar(topBarRef, "--top-bar-h", !!mobileHeader);
  // Par JS de `appShell--withBottomNav`: o banner de cookies vive fora do shell
  // (App.tsx) e precisa saber se há nav para subir acima dela, sem depender de :has.
  useLayoutEffect(() => {
    if (!hasBottomNav) return;
    const root = document.documentElement;
    root.classList.add("has-bottom-nav");
    return () => root.classList.remove("has-bottom-nav");
  }, [hasBottomNav]);
  return (
    <div
      className={`appShell${bottomNav ? " appShell--withBottomNav" : ""}${
        mobileHeader ? " appShell--withMobileHeader" : ""
      }`}
    >
      <aside className="sidebar">{sidebar}</aside>
      <main className="main">
        {mobileHeader && <div className="mobileTopBar" ref={topBarRef}>{mobileHeader}</div>}
        <div className="container">{children}</div>
      </main>
      {bottomNav}
    </div>
  );
}
