import { create } from 'zustand';
import { ConfirmationResult, onAuthStateChanged } from 'firebase/auth';
import { UserProfile } from '../types';
import { auth, isFirebaseConfigured } from '../config/firebase';
import {
  setupRecaptcha,
  sendPhoneOtp,
  confirmPhoneOtp,
  signOutFirebase,
  mapFirebaseError,
  clearRecaptchaVerifier,
} from '../services/firebaseAuthService';
import {
  checkPhoneApi,
  fetchCurrentUser,
  phonePasswordAuthApi,
  syncFirebaseUser,
  updateUserProfile,
} from '../services/apiClient';

export type AuthStep =
  | 'PHONE_ENTRY'
  | 'PIN_AUTH'
  | 'OTP_VERIFICATION'
  | 'PROFILE_ONBOARDING'
  | 'AUTHENTICATED';

interface AuthState {
  step: AuthStep;
  phoneNumber: string;
  phoneExists: boolean;
  confirmationResult: ConfirmationResult | null;
  currentUser: UserProfile | null;
  user: UserProfile | null;
  authToken: string | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  errorMessage: string | null;

  setPhoneNumber: (phone: string) => void;
  setStep: (step: AuthStep) => void;
  setAuthToken: (token: string | null) => void;
  setCurrentUser: (user: UserProfile | null) => void;
  setError: (msg: string | null) => void;
  setLoading: (loading: boolean) => void;

  // Phone + PIN / Auth Actions
  initAuth: () => () => void;
  continueWithPhone: (phone: string) => Promise<boolean>;
  submitPhonePinAuth: (password: string, mode?: 'login' | 'register' | 'auto') => Promise<boolean>;
  startOtpVerification: (phone: string, containerId?: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<boolean>;
  completeOnboarding: (displayName: string, username: string, bio?: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Backward compatibility alias
  verifyOtpMock: (code: string) => boolean;
}

const STORAGE_KEY_USER = 'pingup_auth_user';
const STORAGE_KEY_TOKEN = 'pingup_auth_token';

function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialUser = getStoredUser();
const initialToken = localStorage.getItem(STORAGE_KEY_TOKEN);

export const useAuthStore = create<AuthState>((set, get) => ({
  step: initialUser && initialUser.username ? 'AUTHENTICATED' : 'PHONE_ENTRY',
  phoneNumber: initialUser?.phoneNumber || '',
  phoneExists: false,
  confirmationResult: null,
  currentUser: initialUser,
  user: initialUser,
  authToken: initialToken,
  token: initialToken,
  isAuthenticated: !!(initialUser && initialUser.username),
  isLoading: false,
  isInitialized: false,
  errorMessage: null,

  setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
  setStep: (step) =>
    set((state) => ({
      step,
      isAuthenticated: step === 'AUTHENTICATED' && !!state.currentUser,
    })),
  setAuthToken: (authToken) => {
    if (authToken) {
      localStorage.setItem(STORAGE_KEY_TOKEN, authToken);
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
    set({ authToken, token: authToken });
  },
  setCurrentUser: (user) => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
    set((state) => ({
      currentUser: user,
      user,
      isAuthenticated: state.step === 'AUTHENTICATED' && !!user,
    }));
  },
  setError: (errorMessage) => set({ errorMessage }),
  setLoading: (isLoading) => set({ isLoading }),

  initAuth: () => {
    const restoreSessionFromToken = async () => {
      const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (!storedToken) {
        set({
          currentUser: null,
          user: null,
          authToken: null,
          token: null,
          isAuthenticated: false,
          step: 'PHONE_ENTRY',
          isInitialized: true,
        });
        return;
      }

      try {
        const meData = await fetchCurrentUser(storedToken);
        if (meData.user && meData.user.username) {
          const userProfile: UserProfile = {
            id: meData.user.id,
            phoneNumber: meData.user.phoneNumber,
            displayName: meData.user.displayName || meData.user.phoneNumber,
            username: meData.user.username,
            avatarUrl: meData.user.avatarUrl || undefined,
            bio: meData.user.bio || undefined,
            isOnline: meData.user.isOnline,
            lastSeenAt: meData.user.lastSeenAt,
          };
          get().setCurrentUser(userProfile);
          set({
            step: 'AUTHENTICATED',
            phoneNumber: meData.user.phoneNumber,
            isAuthenticated: true,
            isInitialized: true,
          });
        } else if (meData.user) {
          set({
            step: 'PROFILE_ONBOARDING',
            phoneNumber: meData.user.phoneNumber,
            isInitialized: true,
          });
        } else {
          localStorage.removeItem(STORAGE_KEY_USER);
          localStorage.removeItem(STORAGE_KEY_TOKEN);
          set({
            currentUser: null,
            user: null,
            authToken: null,
            token: null,
            isAuthenticated: false,
            step: 'PHONE_ENTRY',
            isInitialized: true,
          });
        }
      } catch (err: any) {
        const msg = err?.message || '';
        const isAuthFailure = /unauthorized|invalid|expired|revoked|bearer/i.test(msg);
        if (isAuthFailure || !get().currentUser) {
          localStorage.removeItem(STORAGE_KEY_USER);
          localStorage.removeItem(STORAGE_KEY_TOKEN);
          set({
            currentUser: null,
            user: null,
            authToken: null,
            token: null,
            isAuthenticated: false,
            step: 'PHONE_ENTRY',
            isInitialized: true,
          });
        } else {
          set({ isInitialized: true });
        }
      }
    };

    if (!isFirebaseConfigured()) {
      void restoreSessionFromToken();
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          get().setAuthToken(token);

          // Fetch user profile from backend
          const meData = await fetchCurrentUser(token);
          if (meData.user && meData.user.username) {
            const userProfile: UserProfile = {
              id: meData.user.id,
              phoneNumber: meData.user.phoneNumber,
              displayName: meData.user.displayName || meData.user.phoneNumber,
              username: meData.user.username,
              avatarUrl: meData.user.avatarUrl || undefined,
              bio: meData.user.bio || undefined,
              isOnline: meData.user.isOnline,
              lastSeenAt: meData.user.lastSeenAt,
            };
            get().setCurrentUser(userProfile);
            set({
              step: 'AUTHENTICATED',
              phoneNumber: meData.user.phoneNumber,
              isInitialized: true,
            });
          } else {
            // First time or incomplete profile
            set({
              step: 'PROFILE_ONBOARDING',
              phoneNumber: firebaseUser.phoneNumber || '',
              isInitialized: true,
            });
          }
        } catch {
          // If backend offline, maintain initial state
          set({ isInitialized: true });
        }
      } else {
        await restoreSessionFromToken();
      }
    });

    return unsubscribe;
  },

  continueWithPhone: async (phone: string) => {
    set({ isLoading: true, errorMessage: null });
    try {
      const result = await checkPhoneApi(phone);
      set({
        phoneNumber: phone,
        phoneExists: Boolean(result.exists && result.hasPassword),
        step: 'PIN_AUTH',
        isLoading: false,
        errorMessage: null,
      });
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        errorMessage: err?.message || 'Unable to verify phone number. Please try again.',
      });
      return false;
    }
  },

  submitPhonePinAuth: async (password: string, mode: 'login' | 'register' | 'auto' = 'auto') => {
    const phone = get().phoneNumber;
    if (!phone) {
      set({ step: 'PHONE_ENTRY', errorMessage: 'Please enter your phone number first.' });
      return false;
    }

    set({ isLoading: true, errorMessage: null });
    try {
      const result = await phonePasswordAuthApi({
        phoneNumber: phone,
        password,
        mode,
      });

      get().setAuthToken(result.token);
      const user = result.user;

      if (result.isNewUser || !user.username) {
        set({
          step: 'PROFILE_ONBOARDING',
          phoneNumber: user.phoneNumber,
          isLoading: false,
          errorMessage: null,
        });
      } else {
        const profile: UserProfile = {
          id: user.id,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName || user.phoneNumber,
          username: user.username,
          avatarUrl: user.avatarUrl || undefined,
          bio: user.bio || undefined,
          isOnline: user.isOnline,
          lastSeenAt: user.lastSeenAt,
        };
        get().setCurrentUser(profile);
        set({
          step: 'AUTHENTICATED',
          phoneNumber: user.phoneNumber,
          isAuthenticated: true,
          isLoading: false,
          errorMessage: null,
        });
      }
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        errorMessage: err?.message || 'Authentication failed. Please check your PIN/password.',
      });
      return false;
    }
  },

  startOtpVerification: async (phone: string, containerId: string = 'recaptcha-container') => {
    set({ isLoading: true, errorMessage: null });

    if (!isFirebaseConfigured()) {
      set({
        isLoading: false,
        errorMessage: 'Firebase is not configured. Please add your credentials in frontend/.env.',
      });
      return false;
    }

    try {
      const verifier = setupRecaptcha(containerId);
      const confirmation = await sendPhoneOtp(phone, verifier);
      set({
        phoneNumber: phone,
        confirmationResult: confirmation,
        step: 'OTP_VERIFICATION',
        isLoading: false,
        errorMessage: null,
      });
      return true;
    } catch (err: any) {
      clearRecaptchaVerifier();
      const message = mapFirebaseError(err);
      set({
        isLoading: false,
        errorMessage: message,
      });
      return false;
    }
  },

  verifyOtp: async (code: string) => {
    const confirmation = get().confirmationResult;
    if (!confirmation) {
      set({ errorMessage: 'No active verification session. Please request a new code.' });
      return false;
    }

    if (!code || code.trim().length !== 6) {
      set({ errorMessage: 'Please enter a valid 6-digit verification code.' });
      return false;
    }

    set({ isLoading: true, errorMessage: null });

    let credential;
    try {
      credential = await confirmPhoneOtp(confirmation, code.trim());
    } catch (err: any) {
      const message = mapFirebaseError(err);
      set({
        isLoading: false,
        errorMessage: message,
      });
      return false;
    }

    let token: string | null = null;
    try {
      token = await credential.user.getIdToken();
      get().setAuthToken(token);
    } catch (tokenErr: any) {
      console.warn('Failed to retrieve Firebase ID token:', tokenErr);
    }

    try {
      if (token) {
        // Synchronize verified user with backend database
        const syncResult = await syncFirebaseUser(token);
        const user = syncResult.user;

        if (syncResult.isNewUser || !user.username) {
          // First-time user: route to profile onboarding
          set({
            step: 'PROFILE_ONBOARDING',
            phoneNumber: user.phoneNumber,
            isLoading: false,
            errorMessage: null,
          });
        } else {
          // Existing user: proceed directly to main chat
          const profile: UserProfile = {
            id: user.id,
            phoneNumber: user.phoneNumber,
            displayName: user.displayName || user.phoneNumber,
            username: user.username,
            avatarUrl: user.avatarUrl || undefined,
            bio: user.bio || undefined,
            isOnline: user.isOnline,
            lastSeenAt: user.lastSeenAt,
          };
          get().setCurrentUser(profile);
          set({
            step: 'AUTHENTICATED',
            isLoading: false,
            errorMessage: null,
          });
        }
        return true;
      }
    } catch (syncErr: any) {
      console.warn('Backend sync warning, proceeding to onboarding:', syncErr);
    }

    // Resilient transition: OTP is verified! Proceed to profile onboarding
    set({
      step: 'PROFILE_ONBOARDING',
      phoneNumber: credential.user.phoneNumber || get().phoneNumber,
      isLoading: false,
      errorMessage: null,
    });
    return true;
  },

  completeOnboarding: async (displayName: string, username: string, bio?: string) => {
    set({ isLoading: true, errorMessage: null });
    const token = get().authToken;

    if (token) {
      try {
        const result = await updateUserProfile(token, {
          displayName: displayName.trim(),
          username: username.trim().toLowerCase(),
          bio: bio?.trim(),
        });
        const updated = result.user;
        const profile: UserProfile = {
          id: updated.id,
          phoneNumber: updated.phoneNumber,
          displayName: updated.displayName || updated.phoneNumber,
          username: updated.username || username,
          avatarUrl: updated.avatarUrl || undefined,
          bio: updated.bio || undefined,
          isOnline: true,
          lastSeenAt: updated.lastSeenAt,
        };
        get().setCurrentUser(profile);
        set({
          currentUser: profile,
          step: 'AUTHENTICATED',
          isLoading: false,
          errorMessage: null,
        });
        return true;
      } catch (err: any) {
        set({
          isLoading: false,
          errorMessage: err?.message || 'Failed to save your profile. Please try again.',
        });
        return false;
      }
    } else {
      // Local fallback if token unavailable
      const phone = get().phoneNumber;
      const newUser: UserProfile = {
        id: `usr_${Date.now()}`,
        phoneNumber: phone,
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio?.trim() || 'Hey there! I am using PingUp.',
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
      };
      get().setCurrentUser(newUser);
      set({
        currentUser: newUser,
        step: 'AUTHENTICATED',
        isLoading: false,
        errorMessage: null,
      });
      return true;
    }
  },

  logout: async () => {
    try {
      await signOutFirebase();
    } catch {
      // Ignore signOut error
    }
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    set({
      step: 'PHONE_ENTRY',
      phoneNumber: '',
      confirmationResult: null,
      currentUser: null,
      authToken: null,
      errorMessage: null,
    });
  },

  // Backward compatibility alias for any existing test
  verifyOtpMock: (code: string) => {
    if (!code || code.length !== 6) {
      set({ errorMessage: 'Please enter a valid 6-digit verification code.' });
      return false;
    }
    set({ step: 'PROFILE_ONBOARDING', errorMessage: null });
    return true;
  },
}));
