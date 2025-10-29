import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { showSuccess, showError } from '../services/notificationService';
import Navigation from '../components/Navigation';

export default function Profile() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError(t('profile.imageError'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError(t('profile.sizeError'));
      return;
    }

    try {
      setUploading(true);

      // Upload to Firebase Storage
      const storageRef = ref(storage, `profilePictures/${currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        photoURL: downloadURL
      });

      setPhotoURL(downloadURL);
      showSuccess(t('profile.pictureSuccess'));
    } catch (error) {
      console.error('Error uploading photo:', error);
      showError(t('profile.pictureError'));
    } finally {
      setUploading(false);
    }
  }

  function getInitials(name: string | null | undefined, email: string | null | undefined): string {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUser || !userProfile) return;

    try {
      setLoading(true);
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        displayName,
        photoURL
      });
      showSuccess(t('profile.updateSuccess'));
    } catch (error) {
      console.error('Error updating profile:', error);
      showError(t('profile.updateError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Navigation variant="authenticated" />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl">
          <h2 className="text-base/7 font-semibold text-slate-900 dark:text-white transition-colors">
            {t('profile.title')}
          </h2>
          <p className="mt-1 text-sm/6 text-slate-600 dark:text-slate-300 transition-colors">
            {t('profile.subtitle')}
          </p>

          <form onSubmit={handleUpdateProfile} className="mt-10 space-y-8">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white transition-colors mb-4">
                {t('profile.profilePicture')}
              </label>
              <div className="flex items-center gap-6">
                {/* Avatar Display */}
                <div className="relative">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold border-2 border-slate-200 dark:border-slate-700">
                      {getInitials(displayName || userProfile?.displayName, currentUser?.email)}
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading ? t('profile.uploading') : t('profile.changePicture')}
                  </button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t('profile.pictureHint')}
                  </p>
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-slate-900 dark:text-white transition-colors">
                {t('profile.displayName')}
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2 block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-900 dark:text-white transition-colors">
                {t('profile.email')}
              </label>
              <input
                type="email"
                id="email"
                value={currentUser?.email || ''}
                disabled
                className="mt-2 block w-full rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 cursor-not-allowed transition-colors"
              />
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white transition-colors">
                {t('profile.accountType')}
              </label>
              <div className="mt-2 flex gap-2">
                {userProfile?.isAdmin && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 transition-colors">
                    {t('profile.admin')}
                  </span>
                )}
                {userProfile?.isTeamMember && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 transition-colors">
                    {t('profile.teamMember')}
                  </span>
                )}
                {!userProfile?.isAdmin && !userProfile?.isTeamMember && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors">
                    {t('profile.customer')}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-x-6">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {t('profile.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center rounded-md bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? t('profile.saving') : t('profile.save')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
