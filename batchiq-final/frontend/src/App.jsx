import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './theme.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import BatchDetail from './pages/BatchDetail.jsx';
import Stores from './pages/Stores.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/batches/:id" element={<BatchDetail />} />
            <Route path="/stores"      element={<Stores />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}
