import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PinAuthCard } from '../components/auth/PinAuthCard';
import { useAuthStore } from '../store/authStore';

describe('PinAuthCard Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      step: 'PIN_AUTH',
      phoneNumber: '+916385328489',
      phoneExists: false,
      isLoading: false,
      errorMessage: null,
    });
  });

  it('renders registration view with Confirm PIN input when phone is new', () => {
    render(<PinAuthCard />);
    expect(screen.getByText(/Create Your Account PIN/i)).toBeInTheDocument();
    expect(screen.getByText('+916385328489')).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm PIN or Password/i)).toBeInTheDocument();
  });

  it('validates matching PINs before calling submitPhonePinAuth during registration', async () => {
    render(<PinAuthCard />);
    fireEvent.change(screen.getByLabelText(/Set a PIN or Password/i), {
      target: { value: '1234' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm PIN or Password/i), {
      target: { value: '5678' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Account & Continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/PINs do not match/i)).toBeInTheDocument();
    });
  });

  it('renders login view without Confirm PIN when phone is already registered', () => {
    useAuthStore.setState({ phoneExists: true });
    render(<PinAuthCard />);
    expect(screen.getByText(/Enter Your Account PIN/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Confirm PIN or Password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log In/i })).toBeInTheDocument();
  });

  it('returns to PHONE_ENTRY when clicking Change phone number', () => {
    const spy = vi.spyOn(useAuthStore.getState(), 'setStep');
    render(<PinAuthCard />);
    fireEvent.click(screen.getByRole('button', { name: /Change phone number/i }));
    expect(spy).toHaveBeenCalledWith('PHONE_ENTRY');
  });
});
