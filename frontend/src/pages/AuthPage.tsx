import React from 'react';
import { useAuthStore } from '../store/authStore';
import { PhoneLoginCard } from '../components/auth/PhoneLoginCard';
import { OtpVerificationCard } from '../components/auth/OtpVerificationCard';
import { ProfileOnboardingCard } from '../components/auth/ProfileOnboardingCard';
import { MessageSquare, ShieldCheck, Lock } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { step } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col justify-center items-center p-4 transition-colors relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/25">
          <MessageSquare className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            PingUp
          </h1>
          <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold tracking-wide uppercase">
            Phase 2 Phone Authentication
          </p>
        </div>
      </div>

      {/* Auth Card by Step */}
      <div className="w-full max-w-md z-10">
        {step === 'PHONE_ENTRY' && <PhoneLoginCard />}
        {step === 'OTP_VERIFICATION' && <OtpVerificationCard />}
        {step === 'PROFILE_ONBOARDING' && <ProfileOnboardingCard />}
      </div>

      {/* Feature Badges */}
      <div className="mt-10 flex flex-wrap justify-center gap-4 text-xs text-gray-400 dark:text-gray-500 z-10">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Firebase Phone Auth
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-blue-500" /> Server-Verified Tokens
        </span>
        <span>•</span>
        <span>Zero Destructive Operations</span>
      </div>
    </div>
  );
};
