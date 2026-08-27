import { type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';

// Placeholder landing route. The real router (lazy feature routes) and AppShell
// land in F0.4 (SYSTEM_PROMPT §6: app/router.tsx, layout/).
function Home(): ReactNode {
  return (
    <main className="app-shell">
      <h1>Somwave</h1>
      <p>Portal &amp; internal system — foundation ready (F0.2).</p>
    </main>
  );
}

export function App(): ReactNode {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
