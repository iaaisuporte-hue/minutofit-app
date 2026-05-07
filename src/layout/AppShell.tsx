export default function AppShell({
  sidebar,
  children,
  bottomNav,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  bottomNav?: React.ReactNode;
}) {
  return (
    <div className={`appShell${bottomNav ? " appShell--withBottomNav" : ""}`}>
      <aside className="sidebar">{sidebar}</aside>
      <main className="main">
        <div className="container">{children}</div>
      </main>
      {bottomNav}
    </div>
  );
}
