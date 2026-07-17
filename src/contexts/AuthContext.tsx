import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { setTenantCompanyId } from '../lib/tenant';

export type Role = 'SUPER_ADMIN' | 'SALES_MANAGER' | 'SALES_EXECUTIVE' | 'VIEWER';

export interface AppUser {
  uid: string;
  email: string | null;
  role: Role;
  name: string;
  companyId?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        setLoading(true);
        try {
          // Fetch user role from root users collection
          let docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          let companyId: string | undefined = undefined;
          let role: Role = 'VIEWER';
          let name = firebaseUser.email?.split('@')[0] || 'User';

          if (docSnap.exists()) {
            role = docSnap.data().role as Role;
            name = docSnap.data().name || name;
            companyId = docSnap.data().companyId;
          } else {
            const registeringData = localStorage.getItem('registering_company');
            let regData = null;
            try {
              if (registeringData) regData = JSON.parse(registeringData);
            } catch (e) {}

            if (regData && regData.email === firebaseUser.email) {
              role = 'SUPER_ADMIN';
              name = regData.name;
              companyId = regData.companyId;
              localStorage.removeItem('registering_company');
            } else if (firebaseUser.email?.toLowerCase() === 'admin@azmgroup.com' || firebaseUser.email?.toLowerCase() === 'alifartdxb@gmail.com') {
               role = 'SUPER_ADMIN';
               name = 'System Admin';
               companyId = 'company_001';
            } else if (firebaseUser.email?.toLowerCase() === 'admin@azmsharjah.com') {
               role = 'SUPER_ADMIN';
               name = 'Sharjah Admin';
               companyId = 'company_002';
            } else if (firebaseUser.email?.toLowerCase() === 'admin@hutaibmarble.com') {
               role = 'SUPER_ADMIN';
               name = 'Hutaib Admin';
               companyId = 'company_003';
            }
            
            try {
              // Always write to root users for easy rule verification
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                email: firebaseUser.email,
                role: role,
                name: name,
                companyId: companyId || 'company_001',
                createdAt: new Date().toISOString()
              });
              
              // Optionally mirror to tenant users for UI consistency if needed
              if (companyId && companyId !== 'company_001') {
                await setDoc(doc(db, 'companies', companyId, 'users', firebaseUser.uid), {
                  email: firebaseUser.email,
                  role: role,
                  name: name,
                  companyId: companyId,
                  createdAt: new Date().toISOString()
                });
              }

              // Initialize company settings if registering a new company
              if (regData && regData.company) {
                const regCompany = regData.company;
                
                await setDoc(doc(db, 'companies', companyId), {
                   name: regCompany.name,
                   tradeLicense: regCompany.tradeLicense,
                   trn: regCompany.trn,
                   type: regCompany.businessType,
                   country: regCompany.country,
                   emirate: regCompany.emirate,
                   status: 'active',
                   createdAt: new Date().toISOString()
                });
                
                await setDoc(doc(db, 'companies', companyId, 'settings', 'company'), {
                   companyNameEn: regCompany.name,
                   companyNameAr: '',
                   email: regCompany.email,
                   phone: regCompany.phone,
                   whatsapp: regCompany.whatsapp,
                   trn: regCompany.trn,
                   website: regCompany.website,
                   address: regCompany.address
                });
                
                await setDoc(doc(db, 'companies', companyId, 'settings', 'branding'), {
                   headerImage: '',
                   footerImage: '',
                   companyStamp: '',
                   showStampInPdf: true,
                   showStampInPreview: true,
                   showStampOnLastPageOnly: true
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
              }
            } catch (e) {
              console.error("Could not write user doc on init", e);
            }
          }
          
          // Force company_001 if companyId is missing (legacy support)
          companyId = companyId || 'company_001';
          setTenantCompanyId(companyId);

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role,
            name,
            companyId,
          });
        } catch (err) {
          console.error("Error retrieving user profile:", err);
          setTenantCompanyId(null);
          setUser(null);
        }
      } else {
        setTenantCompanyId(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    setTenantCompanyId(null);
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
