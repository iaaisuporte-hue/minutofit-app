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
  return (
    <div className={`appShell${bottomNav ? " appShell--withBottomNav" : ""}`}>
      <aside className="sidebar">{sidebar}</aside>
      <main className="main">
        {mobileHeader && <div className="mobileTopBar">{mobileHeader}</div>}
        <div className="container">{children}</div>
      </main>
      {bottomNav}
    </div>
  );
}
