import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import Job1StundeneintragPage from '@/pages/Job1StundeneintragPage';
import Job2StundeneintragPage from '@/pages/Job2StundeneintragPage';
import GesamtuebersichtPage from '@/pages/GesamtuebersichtPage';
import TageserfassungPage from '@/pages/intents/TageserfassungPage';
import PeriodenabrechnungPage from '@/pages/intents/PeriodenabrechnungPage';

export default function App() {
  return (
    <HashRouter>
      <ActionsProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="job-1-stundeneintrag" element={<Job1StundeneintragPage />} />
            <Route path="job-2-stundeneintrag" element={<Job2StundeneintragPage />} />
            <Route path="gesamtuebersicht" element={<GesamtuebersichtPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="intents/tageserfassung" element={<TageserfassungPage />} />
            <Route path="intents/periodenabrechnung" element={<PeriodenabrechnungPage />} />
          </Route>
        </Routes>
      </ActionsProvider>
    </HashRouter>
  );
}
