import React, { useState } from 'react';
import { Phone, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'US/CA' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' },
  { code: '+65', flag: '🇸🇬', label: 'Singapore' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+49', flag: '🇩🇪', label: 'Germany' },
  { code: '+33', flag: '🇫🇷', label: 'France' },
  { code: '+81', flag: '🇯🇵', label: 'Japan' },
];

export const PhoneLoginCard: React.FC = () => {
  const { continueWithPhone, isLoading, errorMessage, setError } = useAuthStore();
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      setError('Please enter a valid phone number (7-15 digits).');
      return;
    }
    const fullPhone = `${countryCode}${cleanNumber}`;
    await continueWithPhone(fullPhone);
  };

  const getPlaceholder = () => {
    if (countryCode === '+91') return '98765 43210';
    if (countryCode === '+1') return '(555) 000-0000';
    if (countryCode === '+44') return '7911 123456';
    return '1234567890';
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 transition-colors">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Welcome to PingUp
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Enter your phone number to log in or create an account
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
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Phone Number
          </label>
          <div className="flex rounded-xl border border-gray-300 dark:border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 bg-white dark:bg-gray-800/80 transition">
            <select
              aria-label="Country Code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="bg-transparent px-3 py-3 text-sm text-gray-700 dark:text-gray-200 border-r border-gray-300 dark:border-gray-700 outline-none cursor-pointer"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code} className="dark:bg-gray-800">
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <div className="flex-1 flex items-center px-3">
              <Phone className="w-4 h-4 text-gray-400 mr-2" />
              <input
                type="tel"
                placeholder={getPlaceholder()}
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (errorMessage) setError(null);
                }}
                className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
                autoFocus
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !phoneNumber.trim()}
          className="w-full mt-2 py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 transition"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Continue <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Security notice */}
      <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 flex items-start gap-2.5 text-[11px] text-gray-400 dark:text-gray-500">
        <Shield className="w-4 h-4 flex-shrink-0 text-brand-500 mt-0.5" />
        <p>
          Sign in or register instantly with any mobile number and a private PIN — zero SMS cost or test number limits.
        </p>
      </div>
    </div>
  );
};
