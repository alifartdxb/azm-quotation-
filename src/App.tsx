import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Quotations from './pages/Quotations';
import QuotationBuilder from './pages/QuotationBuilder';
import Invoices from './pages/Invoices';
import InvoiceBuilder from './pages/InvoiceBuilder';
import Login from './pages/Login';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';
import Customers from './pages/Customers';
import WhatsAppMarketing from './pages/WhatsAppMarketing';
import NotFound from './pages/NotFound';
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
            <Route path="products" element={<Products />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/new" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE']}>
                <InvoiceBuilder />
              </ProtectedRoute>
            } />
            <Route path="invoices/:id" element={<InvoiceBuilder />} />
            <Route path="invoices/edit/:id" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE']}>
                <InvoiceBuilder />
              </ProtectedRoute>
            } />
            <Route path="profile" element={<Profile />} />
            <Route path="customers" element={<Customers />} />
            <Route path="whatsapp-marketing" element={<WhatsAppMarketing />} />
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
            
            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
