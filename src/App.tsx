import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Quotations from './pages/Quotations';
import QuotationBuilder from './pages/QuotationBuilder';
import Login from './pages/Login';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="audit-logs" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <AuditLogs />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SALES_MANAGER']}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="quotations/new" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE']}>
                <QuotationBuilder />
              </ProtectedRoute>
            } />
            <Route path="quotations/:id" element={<QuotationBuilder />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
