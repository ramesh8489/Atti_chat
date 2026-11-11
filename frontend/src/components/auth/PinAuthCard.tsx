import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const PinAuthCard: React.FC = () => {
  const {
    phoneNumber,
    phoneExists,
    submitPhonePinAuth,
    setStep,
    setError,
    isLoading,
    errorMessage,
  } = useAuthStore();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const isRegistering = !phoneExists;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setError('PIN or password must be at least 4 characters.');
      return;
    }

    if (isRegistering && pin !== confirmPin) {
      setError('PINs do not match. Please enter the same PIN twice.');
      return;
    }

    await submitPhonePinAuth(pin, isRegistering ? 'register' : 'login');
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 transition-colors">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setStep('PHONE_ENTRY');
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 mb-5 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Change phone number
      </button>

      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-3">
          {isRegistering ? <KeyRound className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {isRegistering ? 'Create Your Account PIN' : 'Enter Your Account PIN'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          {isRegistering ? 'Protect ' : 'Welcome back '}
          <span className="font-semibold text-gray-800 dark:text-gray-200">{phoneNumber}</span>
        </p>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="auth-pin-input"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
          >
            {isRegistering ? 'Set a PIN or Password (min 4 chars)' : 'PIN or Password'}
          </label>
          <div className="flex items-center rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-3 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 bg-white dark:bg-gray-800/80 transition">
            <Lock className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
            <input
              id="auth-pin-input"
              type={showPin ? 'text' : 'password'}
              placeholder={isRegistering ? 'e.g. 2580 or mypass123' : 'Enter your PIN or password'}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (errorMessage) setError(null);
              }}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
              autoFocus
            />
            <button
              type="button"
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              onClick={() => setShowPin((v) => !v)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isRegistering && (
          <div>
            <label
              htmlFor="auth-confirm-pin-input"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
            >
              Confirm PIN or Password
            </label>
            <div className="flex items-center rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-3 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 bg-white dark:bg-gray-800/80 transition">
              <ShieldCheck className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
              <input
                id="auth-confirm-pin-input"
                type={showPin ? 'text' : 'password'}
                placeholder="Re-enter your PIN or password"
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value);
                  if (errorMessage) setError(null);
                }}
                className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || pin.length < 4 || (isRegistering && confirmPin.length < 4)}
          className="w-full mt-2 py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 transition"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {isRegistering ? 'Create Account & Continue' : 'Log In'}{' '}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 dark:text-gray-500 text-center">
        {isRegistering
          ? 'Remember this PIN — you will use it whenever you log in on any phone or browser.'
          : 'Your PIN is hashed and verified securely on the PingUp server.'}
      </div>
    </div>
  );
};
