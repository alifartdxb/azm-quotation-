import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export type Role = 'SUPER_ADMIN' | 'SALES_MANAGER' | 'SALES_EXECUTIVE' | 'VIEWER';

export interface AppUser {
  uid: string;
  email: string | null;
  role: Role;
  name: string;
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
        // Fetch user role from Firestore
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        let role: Role = 'VIEWER';
        let name = firebaseUser.email?.split('@')[0] || 'User';

        if (docSnap.exists()) {
          role = docSnap.data().role as Role;
          name = docSnap.data().name || name;
        } else {
          // Fallback or setup first admin (for demo purposes)
           if (firebaseUser.email === 'admin@azmgroup.com') {
             role = 'SUPER_ADMIN';
             name = 'System Admin';
           }
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role,
          name,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {!loading && children}
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
