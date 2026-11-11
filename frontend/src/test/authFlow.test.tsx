import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';
import * as firebaseAuthService from '../services/firebaseAuthService';
import * as apiClient from '../services/apiClient';

vi.mock('../services/firebaseAuthService', () => ({
  setupRecaptcha: vi.fn(),
  sendPhoneOtp: vi.fn(),
  confirmPhoneOtp: vi.fn(),
  signOutFirebase: vi.fn().mockResolvedValue(undefined),
  mapFirebaseError: vi.fn((err) => err?.message || 'Authentication error'),
  clearRecaptchaVerifier: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  checkPhoneApi: vi.fn(),
  phonePasswordAuthApi: vi.fn(),
  fetchCurrentUser: vi.fn(),
  syncFirebaseUser: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  auth: {},
  isFirebaseConfigured: vi.fn().mockReturnValue(true),
  firebaseConfig: {},
}));

describe('Authentication Flow and State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      step: 'PHONE_ENTRY',
      phoneNumber: '',
      phoneExists: false,
      confirmationResult: null,
      currentUser: null,
      authToken: null,
      isLoading: false,
      errorMessage: null,
    });
  });

  it('handles new Phone + PIN registration: check-phone -> PIN_AUTH -> PROFILE_ONBOARDING -> AUTHENTICATED', async () => {
    (apiClient.checkPhoneApi as any).mockResolvedValue({
      success: true,
      exists: false,
      hasPassword: false,
    });

    const proceeded = await useAuthStore.getState().continueWithPhone('+916385328489');
    expect(proceeded).toBe(true);
    expect(useAuthStore.getState().step).toBe('PIN_AUTH');
    expect(useAuthStore.getState().phoneExists).toBe(false);

    (apiClient.phonePasswordAuthApi as any).mockResolvedValue({
      success: true,
      token: 'atti_jwt_new_user',
      isNewUser: true,
      user: {
        id: 'usr_pin_1',
        firebaseUid: 'phone_uuid_1',
        phoneNumber: '+916385328489',
        username: null,
        displayName: '+916385328489',
      },
    });

    const authed = await useAuthStore.getState().submitPhonePinAuth('2580', 'register');
    expect(authed).toBe(true);
    expect(useAuthStore.getState().step).toBe('PROFILE_ONBOARDING');
    expect(useAuthStore.getState().authToken).toBe('atti_jwt_new_user');

    (apiClient.updateUserProfile as any).mockResolvedValue({
      success: true,
      user: {
        id: 'usr_pin_1',
        firebaseUid: 'phone_uuid_1',
        phoneNumber: '+916385328489',
        displayName: 'Ramesh',
        username: 'ramesh',
        bio: 'Hey there!',
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
      },
    });

    const completed = await useAuthStore.getState().completeOnboarding('Ramesh', 'ramesh', 'Hey there!');
    expect(completed).toBe(true);
    expect(useAuthStore.getState().step).toBe('AUTHENTICATED');
    expect(useAuthStore.getState().currentUser?.id).toBe('usr_pin_1');
  });

  it('handles returning Phone + PIN login: check-phone -> PIN_AUTH -> AUTHENTICATED', async () => {
    (apiClient.checkPhoneApi as any).mockResolvedValue({
      success: true,
      exists: true,
      hasPassword: true,
    });

    await useAuthStore.getState().continueWithPhone('+919876543210');
    expect(useAuthStore.getState().phoneExists).toBe(true);

    (apiClient.phonePasswordAuthApi as any).mockResolvedValue({
      success: true,
      token: 'atti_jwt_existing',
      isNewUser: false,
      user: {
        id: 'usr_pin_2',
        firebaseUid: 'phone_uuid_2',
        phoneNumber: '+919876543210',
        displayName: 'Friend',
        username: 'friend',
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
      },
    });

    const loggedIn = await useAuthStore.getState().submitPhonePinAuth('2580', 'login');
    expect(loggedIn).toBe(true);
    expect(useAuthStore.getState().step).toBe('AUTHENTICATED');
    expect(useAuthStore.getState().currentUser?.username).toBe('friend');
  });

  it('handles first-time user: sends OTP, confirms, and navigates to PROFILE_ONBOARDING', async () => {
    const mockConfirmationResult: any = {
      confirm: vi.fn(),
    };
    (firebaseAuthService.sendPhoneOtp as any).mockResolvedValue(mockConfirmationResult);

    // 1. Send OTP
    const sent = await useAuthStore.getState().startOtpVerification('+919876543210');
    expect(sent).toBe(true);
    expect(useAuthStore.getState().step).toBe('OTP_VERIFICATION');
    expect(useAuthStore.getState().phoneNumber).toBe('+919876543210');

    // 2. Verify OTP for a brand new user (isNewUser: true, username: null)
    const mockUserCredential: any = {
      user: {
        uid: 'firebase_uid_new',
        getIdToken: vi.fn().mockResolvedValue('test_id_token_123'),
      },
    };
    (firebaseAuthService.confirmPhoneOtp as any).mockResolvedValue(mockUserCredential);
    (apiClient.syncFirebaseUser as any).mockResolvedValue({
      success: true,
      user: {
        id: 'usr_new_1',
        firebaseUid: 'firebase_uid_new',
        phoneNumber: '+919876543210',
        username: null,
        displayName: '+919876543210',
      },
      isNewUser: true,
    });

    const verified = await useAuthStore.getState().verifyOtp('123456');
    expect(verified).toBe(true);
    expect(useAuthStore.getState().step).toBe('PROFILE_ONBOARDING');
    expect(useAuthStore.getState().authToken).toBe('test_id_token_123');

    // 3. Complete onboarding
    (apiClient.updateUserProfile as any).mockResolvedValue({
      success: true,
      user: {
        id: 'usr_new_1',
        firebaseUid: 'firebase_uid_new',
        phoneNumber: '+919876543210',
        displayName: 'Ravi Kumar',
        username: 'ravikumar',
        bio: 'Hello world',
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
      },
    });

    const completed = await useAuthStore.getState().completeOnboarding('Ravi Kumar', 'ravikumar', 'Hello world');
    expect(completed).toBe(true);
    expect(useAuthStore.getState().step).toBe('AUTHENTICATED');
    expect(useAuthStore.getState().currentUser?.username).toBe('ravikumar');
  });

  it('handles returning user: directs straight to AUTHENTICATED screen', async () => {
    useAuthStore.setState({
      step: 'OTP_VERIFICATION',
      phoneNumber: '+919876543210',
      confirmationResult: {} as any,
    });

    const mockUserCredential: any = {
      user: {
        uid: 'firebase_uid_existing',
        getIdToken: vi.fn().mockResolvedValue('test_returning_token'),
      },
    };
    (firebaseAuthService.confirmPhoneOtp as any).mockResolvedValue(mockUserCredential);
    (apiClient.syncFirebaseUser as any).mockResolvedValue({
      success: true,
      user: {
        id: 'usr_returning_2',
        firebaseUid: 'firebase_uid_existing',
        phoneNumber: '+919876543210',
        displayName: 'Aravind',
        username: 'aravind',
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
      },
      isNewUser: false,
    });

    const verified = await useAuthStore.getState().verifyOtp('654321');
    expect(verified).toBe(true);
    expect(useAuthStore.getState().step).toBe('AUTHENTICATED');
    expect(useAuthStore.getState().currentUser?.displayName).toBe('Aravind');
  });

  it('handles OTP verification failure with appropriate error state', async () => {
    useAuthStore.setState({
      step: 'OTP_VERIFICATION',
      phoneNumber: '+919876543210',
      confirmationResult: {} as any,
    });

    (firebaseAuthService.confirmPhoneOtp as any).mockRejectedValue(new Error('Invalid verification code'));
    (firebaseAuthService.mapFirebaseError as any).mockReturnValue('Invalid verification code. Please check the 6-digit code and try again.');

    const result = await useAuthStore.getState().verifyOtp('000000');
    expect(result).toBe(false);
    expect(useAuthStore.getState().step).toBe('OTP_VERIFICATION');
    expect(useAuthStore.getState().errorMessage).toMatch(/Invalid verification code/i);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('logs out and clears session state safely', async () => {
    useAuthStore.setState({
      step: 'AUTHENTICATED',
      phoneNumber: '+919876543210',
      authToken: 'token_to_clear',
      currentUser: {
        id: 'usr_1',
        phoneNumber: '+919876543210',
        displayName: 'Test',
        username: 'test',
        isOnline: true,
      },
    });

    await useAuthStore.getState().logout();

    expect(firebaseAuthService.signOutFirebase).toHaveBeenCalled();
    expect(useAuthStore.getState().step).toBe('PHONE_ENTRY');
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().authToken).toBeNull();
  });
});

