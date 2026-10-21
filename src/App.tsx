import { useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { getIds } from './data/repo';
import { BoardScreen } from './screens/BoardScreen';
import { NewReelScreen } from './screens/NewReelScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { ReelScreen } from './screens/ReelScreen';
import { SetupScreen } from './screens/SetupScreen';
import { SignInScreen } from './screens/SignInScreen';
import { AuthProvider, useAuth } from './state/auth';
import { DataProvider } from './state/data';
import { ToastProvider } from './state/toast';

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  );
}

function Gate() {
  const { session } = useAuth();
  const [ids, setIds] = useState(getIds);

  if (!session) return <SignInScreen />;
  if (!ids) return <SetupScreen onReady={setIds} />;

  return (
    <HashRouter>
      <DataProvider ids={ids}>
        <AppShell>
          <Routes>
            <Route path="/" element={<BoardScreen />} />
            <Route path="/new" element={<NewReelScreen />} />
            <Route path="/reel/:id" element={<ReelScreen />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </AppShell>
      </DataProvider>
    </HashRouter>
  );
}
