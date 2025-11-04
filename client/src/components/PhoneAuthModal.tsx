import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { showSuccess, showError } from '../services/notificationService';
import PhoneInput from './PhoneInput';

interface PhoneAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PhoneAuthModal({ open, onClose, onSuccess }: PhoneAuthModalProps) {
  const { t } = useTranslation();
  const { loginWithPhone, setupRecaptcha } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'code'>('phone');

  // Setup reCAPTCHA when modal opens
  useEffect(() => {
    if (open) {
      // Reset state when modal opens
      setPhoneNumber('');
      setVerificationCode('');
      setConfirmationResult(null);
      setStep('phone');

      // Cleanup any existing reCAPTCHA
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch (error) {
          console.error('Error clearing reCAPTCHA:', error);
        }
      }

      // Setup reCAPTCHA with a delay to ensure DOM is ready
      setTimeout(() => {
        try {
          setupRecaptcha('recaptcha-container');
        } catch (error) {
          console.error('Error setting up reCAPTCHA:', error);
        }
      }, 100);
    }
  }, [open, setupRecaptcha]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();

    // Validate phone number
    if (!phoneNumber) {
      showError(t('phoneAuth.errorEnterPhone'));
      return;
    }

    // Validate phone number format (E.164 format: +[country code][number])
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    const cleanedPhone = phoneNumber.replace(/\s/g, '');

    if (!phoneRegex.test(cleanedPhone)) {
      showError(t('phoneAuth.errorInvalidFormat'));
      return;
    }

    try {
      setLoading(true);
      // Remove spaces before sending
      const cleanedPhone = phoneNumber.replace(/\s/g, '');

      const result = await loginWithPhone(cleanedPhone);
      setConfirmationResult(result);
      setStep('code');
      showSuccess(t('phoneAuth.successCodeSent'));
    } catch (error: any) {
      console.error('Full error object:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      if (error.code === 'auth/invalid-phone-number') {
        showError(t('phoneAuth.errorInvalidFormat'));
      } else if (error.code === 'auth/too-many-requests') {
        showError(t('phoneAuth.errorTooManyRequests'));
      } else if (error.code === 'auth/operation-not-allowed') {
        // This specific error means Phone Auth is not enabled in Firebase Console
        const helpMessage = `
Phone Authentication Setup Required:

1. Go to Firebase Console (console.firebase.google.com)
2. Select your project: "${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project'}"
3. Navigate to: Authentication > Sign-in method
4. Find "Phone" in the provider list
5. Click on it and toggle to ENABLE
6. Click SAVE

For testing without SMS charges:
- Add test phone number: +40712345678
- Add test code: 123456
- This bypasses SMS and is free

Note: Phone Auth requires Firebase Blaze (pay-as-you-go) plan.
        `.trim();

        showError(t('phoneAuth.errorPhoneNotEnabled'));
        console.warn(helpMessage);
      } else if (error.code === 'auth/captcha-check-failed') {
        showError(t('phoneAuth.errorCaptchaFailed'));
      } else {
        showError(`Error (${error.code}): ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();

    if (!verificationCode) {
      showError(t('phoneAuth.errorInvalidCode'));
      return;
    }

    try {
      setLoading(true);
      await confirmationResult.confirm(verificationCode);

      showSuccess(t('phoneAuth.successPhoneVerified'));
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error verifying code:', error);
      showError(error.message || t('phoneAuth.errorInvalidCode'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-md w-full rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">
              {step === 'phone' ? t('phoneAuth.title') : t('phoneAuth.titleVerification')}
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {step === 'phone' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                  {t('phoneAuth.phoneNumber')} <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  placeholder={t('phoneAuth.phoneNumberPlaceholder')}
                />
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t('phoneAuth.phoneNumberHelper')}
                </p>
              </div>

              {/* reCAPTCHA container */}
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50">
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 text-center font-medium">
                  {t('phoneAuth.securityVerification')}
                </p>
                <div
                  id="recaptcha-container"
                  className="flex justify-center items-center min-h-[78px]"
                  style={{ transform: 'scale(1)', transformOrigin: 'center' }}
                ></div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                  {t('phoneAuth.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  <span>{loading ? t('phoneAuth.sending') : t('phoneAuth.sendCode')}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                  {t('phoneAuth.verificationCode')}
                </label>
                <input
                  type="text"
                  id="code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder={t('phoneAuth.verificationCodePlaceholder')}
                  className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  maxLength={6}
                />
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t('phoneAuth.verificationCodeHelper')} {phoneNumber}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                  {t('phoneAuth.back')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  <span>{loading ? t('phoneAuth.verifying') : t('phoneAuth.verify')}</span>
                </button>
              </div>
            </form>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}