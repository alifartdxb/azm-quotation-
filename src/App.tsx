import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Quotations from './pages/Quotations';
import QuotationBuilder from './pages/QuotationBuilder';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="products" element={<Products />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="quotations/new" element={<QuotationBuilder />} />
          <Route path="quotations/:id" element={<QuotationBuilder />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
