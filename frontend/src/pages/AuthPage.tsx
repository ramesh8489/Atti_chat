import React from 'react';
import { useAuthStore } from '../store/authStore';
import { PhoneLoginCard } from '../components/auth/PhoneLoginCard';
import { PinAuthCard } from '../components/auth/PinAuthCard';
import { OtpVerificationCard } from '../components/auth/OtpVerificationCard';
import { ProfileOnboardingCard } from '../components/auth/ProfileOnboardingCard';
import { MessageSquare } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { step } = useAuthStore();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#F4F5FF] via-white to-[#ECEEFE] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors relative overflow-hidden">
      {/* Subtle Ambient Glows */}
      <div className="absolute top-1/4 -left-32 w-80 sm:w-96 h-80 sm:h-96 bg-brand-500/15 dark:bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 sm:w-96 h-80 sm:h-96 bg-purple-400/15 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-6 sm:mb-8 z-10">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/25">
          <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            PingUp
          </h1>
          <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">
            Fast, simple messaging
          </p>
        </div>
      </div>

      {/* Auth Card by Step */}
      <div className="w-full max-w-md z-10">
        {step === 'PHONE_ENTRY' && <PhoneLoginCard />}
        {step === 'PIN_AUTH' && <PinAuthCard />}
        {step === 'OTP_VERIFICATION' && <OtpVerificationCard />}
        {step === 'PROFILE_ONBOARDING' && <ProfileOnboardingCard />}
      </div>
    </div>
  );
};
