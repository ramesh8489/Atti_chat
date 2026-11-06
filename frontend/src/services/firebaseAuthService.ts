import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  UserCredential,
  signOut,
  ApplicationVerifier,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';

let cachedRecaptchaVerifier: RecaptchaVerifier | null = null;

export function setupRecaptcha(containerId: string = 'recaptcha-container'): ApplicationVerifier {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase credentials are not configured in environment variables.');
  }

  // Clear existing if any
  if (cachedRecaptchaVerifier) {
    try {
      cachedRecaptchaVerifier.clear();
    } catch {
      // Ignore cleanup error
    }
    cachedRecaptchaVerifier = null;
  }

  cachedRecaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    },
    'expired-callback': () => {
      // reCAPTCHA expired, will re-prompt on next action
    },
  });

  return cachedRecaptchaVerifier;
}

export function clearRecaptchaVerifier(): void {
  if (cachedRecaptchaVerifier) {
    try {
      cachedRecaptchaVerifier.clear();
    } catch {
      // Ignore
    }
    cachedRecaptchaVerifier = null;
  }
}

export async function sendPhoneOtp(
  phoneNumber: string,
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase configuration missing. Set VITE_FIREBASE_* in frontend/.env');
  }

  return await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
}

export async function confirmPhoneOtp(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<UserCredential> {
  return await confirmationResult.confirm(code);
}

export async function signOutFirebase(): Promise<void> {
  clearRecaptchaVerifier();
  await signOut(auth);
}

export function mapFirebaseError(error: any): string {
  const code = error?.code;
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'The phone number format is invalid. Please check the country code and number.';
    case 'auth/missing-phone-number':
      return 'Please enter a valid phone number.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded for this Firebase project. Please use a configured test phone number.';
    case 'auth/too-many-requests':
      return 'Too many requests. Please wait a few minutes before trying again.';
    case 'auth/invalid-verification-code':
      return 'Invalid verification code. Please check the 6-digit code and try again.';
    case 'auth/code-expired':
      return 'Verification code has expired. Please request a new code.';
    case 'auth/captcha-check-failed':
      return 'reCAPTCHA verification failed. Please try again.';
    case 'auth/app-not-authorized':
      return 'This domain is not authorized in Firebase Console. Add domain under Authentication > Settings > Authorized Domains.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    default:
      return error?.message || 'An error occurred during authentication. Please try again.';
  }
}

