import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OtpVerificationCard } from '../components/auth/OtpVerificationCard';
import { useAuthStore } from '../store/authStore';

describe('OtpVerificationCard Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAuthStore.setState({
      step: 'OTP_VERIFICATION',
      phoneNumber: '+919876543210',
      confirmationResult: { confirm: vi.fn() } as any,
      isLoading: false,
      errorMessage: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays the phone number to which code was sent', () => {
    render(<OtpVerificationCard />);
    expect(screen.getByText(/\+919876543210/i)).toBeInTheDocument();
  });

  it('renders all 6 numeric PIN inputs', () => {
    render(<OtpVerificationCard />);
    for (let i = 0; i < 6; i++) {
      expect(document.getElementById(`otp-input-${i}`)).toBeInTheDocument();
    }
  });

  it('navigates back to PHONE_ENTRY when Change phone number is clicked', () => {
    render(<OtpVerificationCard />);
    const backBtn = screen.getByText(/Change phone number/i);
    fireEvent.click(backBtn);
    expect(useAuthStore.getState().step).toBe('PHONE_ENTRY');
  });

  it('enforces 60-second cooldown before enabling resend button', () => {
    render(<OtpVerificationCard />);
    expect(screen.getByText(/Resend code in/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resend Code/i })).not.toBeInTheDocument();

    // Advance 60 seconds wrapped in act
    act(() => {
      vi.advanceTimersByTime(61000);
    });

    expect(screen.getByRole('button', { name: /Resend Code/i })).toBeInTheDocument();
  });

  it('shows error message when provided in store', () => {
    useAuthStore.setState({ errorMessage: 'Invalid verification code.' });
    render(<OtpVerificationCard />);
    expect(screen.getByText(/Invalid verification code/i)).toBeInTheDocument();
  });

  it('calls verifyOtp when all 6 digits are entered and submitted', async () => {
    const verifyOtpMock = vi.fn().mockResolvedValue(true);
    useAuthStore.setState({ verifyOtp: verifyOtpMock });

    render(<OtpVerificationCard />);
    for (let i = 0; i < 6; i++) {
      const input = document.getElementById(`otp-input-${i}`) as HTMLInputElement;
      fireEvent.change(input, { target: { value: `${i + 1}` } });
    }

    const submitBtn = screen.getByRole('button', { name: /Verify & Proceed/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(verifyOtpMock).toHaveBeenCalledWith('123456');
  });
});
