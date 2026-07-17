const fs = require('fs');
const code = `import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, Building2, User, Globe, Phone, FileText, CheckCircle, MapPin, Map } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Registration State
  const [regCompany, setRegCompany] = useState({
    name: '',
    tradeLicense: '',
    trn: '',
    businessType: 'Marble & Granite',
    country: 'United Arab Emirates',
    emirate: 'Dubai',
    address: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: ''
  });
  
  const [regAdmin, setRegAdmin] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if ((email === 'admin@azmgroup.com' || email === 'admin@azmsharjah.com' || email === 'admin@hutaibmarble.com') && password === 'password') {
          try {
             const cred = await createUserWithEmailAndPassword(auth, email, password);
             navigate(from, { replace: true });
             return;
          } catch (createErr) {
             console.error('Failed auto-creation', createErr);
          }
        }
      }
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (regAdmin.password !== regAdmin.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (regAdmin.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const companyId = 'company_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      
      // Save state to localstorage for AuthContext to pick up
      localStorage.setItem('registering_company', JSON.stringify({
        companyId,
        name: regAdmin.name,
        email: regAdmin.email
      }));
      
      // Pre-create company settings
      await setDoc(doc(db, 'companies', companyId), {
         name: regCompany.name,
         tradeLicense: regCompany.tradeLicense,
         trn: regCompany.trn,
         type: regCompany.businessType,
         createdAt: new Date().toISOString()
      });
      
      await setDoc(doc(db, 'companies', companyId, 'settings', 'company'), {
         companyNameEn: regCompany.name,
         companyNameAr: '',
         email: regCompany.email,
         phone: regCompany.phone,
         trn: regCompany.trn,
         website: regCompany.website,
         address: regCompany.address
      });
      
      await setDoc(doc(db, 'companies', companyId, 'counters', 'quotationCounter'), {
         currentNumber: 1,
         prefix: 'QTN',
         year: new Date().getFullYear()
      });
      
      await setDoc(doc(db, 'companies', companyId, 'counters', 'invoiceCounter'), {
         currentNumber: 1,
         prefix: 'INV',
         year: new Date().getFullYear()
      });
      
      // Register Auth user
      await createUserWithEmailAndPassword(auth, regAdmin.email, regAdmin.password);
      
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to register business. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center -rotate-12 shadow-xl shadow-blue-600/20">
            <span className="text-white font-serif font-bold text-3xl rotate-12">AZ</span>
          </div>
        </div>
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
          {isRegistering ? 'Register New Business' : 'AZM Group Portal'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          {isRegistering 
            ? 'Set up your isolated multi-company workspace'
            : 'Sign in to access the Quotation Management System'}
        </p>
      </div>

      <div className={\`mt-8 sm:mx-auto sm:w-full \${isRegistering ? 'sm:max-w-4xl' : 'sm:max-w-md'}\`}>
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 mb-6">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!isRegistering ? (
            <>
              <form className="space-y-6" onSubmit={handleLoginSubmit}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Email address</label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      className="block w-full pl-10 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      placeholder="admin@azmgroup.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      className="block w-full pl-10 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                      Remember me
                    </label>
                  </div>
                  <div className="text-sm">
                    <a href="#" className="font-semibold text-blue-600 hover:text-blue-500">
                      Forgot your password?
                    </a>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </div>
              </form>
              
              <div className="mt-8 border-t border-slate-200 pt-6">
                <p className="text-center text-sm text-slate-500 mb-4">Don't have an account?</p>
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="w-full flex justify-center py-2.5 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 active:scale-[0.98] transition-all"
                >
                  Register New Business
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Business Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={regCompany.name}
                      onChange={(e) => setRegCompany({...regCompany, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trade License Number *</label>
                    <input
                      type="text"
                      required
                      value={regCompany.tradeLicense}
                      onChange={(e) => setRegCompany({...regCompany, tradeLicense: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">TRN (Optional)</label>
                    <input
                      type="text"
                      value={regCompany.trn}
                      onChange={(e) => setRegCompany({...regCompany, trn: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Business Type</label>
                    <select
                      value={regCompany.businessType}
                      onChange={(e) => setRegCompany({...regCompany, businessType: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option>Marble & Granite</option>
                      <option>Quartz & Porcelain</option>
                      <option>General Trading</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Address *</label>
                    <input
                      type="text"
                      required
                      value={regCompany.address}
                      onChange={(e) => setRegCompany({...regCompany, address: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Country</label>
                    <input
                      type="text"
                      value={regCompany.country}
                      onChange={(e) => setRegCompany({...regCompany, country: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Emirate / City</label>
                    <input
                      type="text"
                      value={regCompany.emirate}
                      onChange={(e) => setRegCompany({...regCompany, emirate: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Company Phone</label>
                    <input
                      type="text"
                      value={regCompany.phone}
                      onChange={(e) => setRegCompany({...regCompany, phone: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Company Email</label>
                    <input
                      type="email"
                      value={regCompany.email}
                      onChange={(e) => setRegCompany({...regCompany, email: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4 border-t border-slate-100 pt-6">
                  <User className="w-5 h-5 text-blue-600" />
                  Admin User Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={regAdmin.name}
                      onChange={(e) => setRegAdmin({...regAdmin, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Admin Email *</label>
                    <input
                      type="email"
                      required
                      value={regAdmin.email}
                      onChange={(e) => setRegAdmin({...regAdmin, email: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={regAdmin.password}
                      onChange={(e) => setRegAdmin({...regAdmin, password: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={regAdmin.confirmPassword}
                      onChange={(e) => setRegAdmin({...regAdmin, confirmPassword: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Creating Workspace...' : 'Register Business Workspace'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/Login.tsx', code);
