import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import Job1StundeneintragPage from '@/pages/Job1StundeneintragPage';
import GesamtuebersichtPage from '@/pages/GesamtuebersichtPage';
import Job2StundeneintragPage from '@/pages/Job2StundeneintragPage';

const StundenErfassenPage = lazy(() => import('@/pages/intents/StundenErfassenPage'));
const AuswertungErstellenPage = lazy(() => import('@/pages/intents/AuswertungErstellenPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardOverview />} />
              <Route path="job-1-stundeneintrag" element={<Job1StundeneintragPage />} />
              <Route path="gesamtuebersicht" element={<GesamtuebersichtPage />} />
              <Route path="job-2-stundeneintrag" element={<Job2StundeneintragPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="intents/stunden-erfassen" element={<Suspense fallback={null}><StundenErfassenPage /></Suspense>} />
              <Route path="intents/auswertung-erstellen" element={<Suspense fallback={null}><AuswertungErstellenPage /></Suspense>} />
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
