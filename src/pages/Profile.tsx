import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { User, Shield, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { logActivity } from '../lib/firebase';

export default function Profile() {
  const { user } = useAuth();
  
  // Profile Info States
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [role] = useState(user?.role || '');
  
  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status/Activity States
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      setProfileError('Display Name cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      // Update in Firestore
      const userRef = (user.companyId && user.companyId !== 'company_001') ? doc(db, 'companies', user.companyId, 'users', user.uid) : doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: name.trim()
      });

      // Log this action
      await logActivity('Profile Updated', 'System', user.uid, `Updated user profile name to: ${name.trim()}`);
      
      setProfileSuccess('Profile details successfully updated! Please refresh or rejoin to see all changes.');
      
      // Also try to update local state if cached, or remind them
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setProfileError(err.message || 'Failed to update profile details.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUserObj = auth.currentUser;
    if (!currentUserObj) return;

    if (!currentPassword) {
      setPasswordError('Please enter your current password to authenticate.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      // Reauthenticate user before password change
      const credential = EmailAuthProvider.credential(currentUserObj.email || '', currentPassword);
      await reauthenticateWithCredential(currentUserObj, credential);
      
      // Update password
      await updatePassword(currentUserObj, newPassword);
      
      // Log the security event
      await logActivity('Password Changed', 'System', user?.uid, 'User successfully updated security credentials.');

      setPasswordSuccess('Password successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error raising password reset credentials:', err);
      setPasswordError(err.message || 'Re-authentication failed. Please check your current password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">User Account Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Manage physical profile details, credentials, and log-in credentials securely</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Info Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
            <User className="w-5 h-5 text-[#509AA3]" />
            <h2 className="font-bold text-slate-800">Profile Details</h2>
          </div>
          
          <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
            {profileSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}
            
            {profileError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
              <input
                type="text"
                disabled
                value={email}
                className="w-full border border-slate-200 bg-slate-100 cursor-not-allowed rounded-lg p-2 text-sm text-slate-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Account login email cannot be changed.</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Current User Role</label>
              <input
                type="text"
                disabled
                value={role.replace('_', ' ')}
                className="w-full border border-slate-200 bg-slate-100 cursor-not-allowed rounded-lg p-2 text-sm text-slate-500 font-semibold uppercase tracking-wider outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Full Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your display name"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#509AA3] outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full py-2.5 px-4 bg-[#509AA3] hover:bg-[#43838b] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingProfile ? 'Saving Details...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
            <Lock className="w-5 h-5 text-[#509AA3]" />
            <h2 className="font-bold text-slate-800">Security Credentials</h2>
          </div>

          <form onSubmit={handleChangePassword} className="p-6 space-y-4">
            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}
            
            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#509AA3] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#509AA3] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#509AA3] outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                <span>{isChangingPassword ? 'Updating Password...' : 'Change Login Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
