export default function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="appShell">
      <aside className="sidebar">{sidebar}</aside>
      <main className="main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}