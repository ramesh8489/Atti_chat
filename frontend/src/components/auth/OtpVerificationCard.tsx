import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const OtpVerificationCard: React.FC = () => {
  const { phoneNumber, setStep, verifyOtp, startOtpVerification, isLoading, errorMessage, setError } = useAuthStore();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (canResend) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [canResend]);

  const handleDigitChange = async (index: number, val: string) => {
    if (!/^[0-9]?$/.test(val)) return;

    const newCode = [...code];
    newCode[index] = val;
    setCode(newCode);

    if (errorMessage) setError(null);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit if all 6 digits entered
    if (val && index === 5 && newCode.every((d) => d !== '')) {
      await verifyOtp(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;

    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setCode(newCode);

    if (pasted.length === 6) {
      await verifyOtp(pasted);
    }
  };

  const handleResend = async () => {
    if (!canResend || isLoading) return;
    setCountdown(60);
    setCanResend(false);
    setCode(['', '', '', '', '', '']);
    await startOtpVerification(phoneNumber, 'recaptcha-container-resend');
  };

  const handleSubmit = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }
    await verifyOtp(fullCode);
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 shadow-xl shadow-indigo-500/10 border border-indigo-100/80 dark:border-gray-800 transition-colors">
      <button
        onClick={() => setStep('PHONE_ENTRY')}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Change phone number
      </button>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Enter Verification Code
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {phoneNumber || 'your phone number'}
          </span>
        </p>
      </div>

      <div className="mb-5 p-3.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 flex items-start gap-2.5 text-xs text-brand-800 dark:text-brand-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">SMS Verification</p>
          <p className="text-[11px] mt-0.5 text-brand-700 dark:text-brand-400">
            Enter the 6-digit verification code sent to your mobile number.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 6-Digit PIN Inputs */}
      <div className="flex justify-between gap-1.5 sm:gap-2 my-6" onPaste={handlePaste}>
        {code.map((digit, idx) => (
          <input
            key={idx}
            id={`otp-input-${idx}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
            autoFocus={idx === 0}
          />
        ))}
      </div>

      <div id="recaptcha-container-resend" className="flex justify-center my-1" />

      <button
        onClick={handleSubmit}
        disabled={isLoading || code.some((d) => d === '')}
        className="w-full py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 transition"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            Verify & Proceed <CheckCircle2 className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Resend Action with Cooldown */}
      <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
        {canResend ? (
          <button
            onClick={handleResend}
            disabled={isLoading}
            className="font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Resend Code
          </button>
        ) : (
          <p>
            Resend code in <span className="font-semibold text-gray-700 dark:text-gray-300">{countdown}s</span>
          </p>
        )}
      </div>
    </div>
  );
};
