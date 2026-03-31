import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import Job1StundeneintragPage from '@/pages/Job1StundeneintragPage';
import GesamtuebersichtPage from '@/pages/GesamtuebersichtPage';
import Job2StundeneintragPage from '@/pages/Job2StundeneintragPage';

const ArbeitstageErfassenPage = lazy(() => import('@/pages/intents/ArbeitstageErfassenPage'));
const MonatsberichtErstellenPage = lazy(() => import('@/pages/intents/MonatsberichtErstellenPage'));

export default function App() {
  return (
    <HashRouter>
      <ActionsProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="job-1-stundeneintrag" element={<Job1StundeneintragPage />} />
            <Route path="gesamtuebersicht" element={<GesamtuebersichtPage />} />
            <Route path="job-2-stundeneintrag" element={<Job2StundeneintragPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="intents/arbeitstage-erfassen" element={<Suspense fallback={null}><ArbeitstageErfassenPage /></Suspense>} />
            <Route path="intents/monatsbericht-erstellen" element={<Suspense fallback={null}><MonatsberichtErstellenPage /></Suspense>} />
          </Route>
        </Routes>
      </ActionsProvider>
    </HashRouter>
  );
}
