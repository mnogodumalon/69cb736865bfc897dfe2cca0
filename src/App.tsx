import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import Job1StundeneintragPage from '@/pages/Job1StundeneintragPage';
import GesamtuebersichtPage from '@/pages/GesamtuebersichtPage';
import Job2StundeneintragPage from '@/pages/Job2StundeneintragPage';
import ArbeitstageErfassenPage from '@/pages/intents/ArbeitstageErfassenPage';
import MonatsauswertungErstellenPage from '@/pages/intents/MonatsauswertungErstellenPage';

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
              <Route path="intents/arbeitstage-erfassen" element={<ArbeitstageErfassenPage />} />
              <Route path="intents/monatsauswertung-erstellen" element={<MonatsauswertungErstellenPage />} />
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
