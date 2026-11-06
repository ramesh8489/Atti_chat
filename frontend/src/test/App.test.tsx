import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { useAuthStore } from '../store/authStore';

describe('PingUp Application Mounting and Routing', () => {
  beforeEach(() => {
    useAuthStore.setState({
      step: 'PHONE_ENTRY',
      currentUser: null,
      authToken: null,
      phoneNumber: '',
      isInitialized: true,
      isLoading: false,
      errorMessage: null,
    });
  });

  it('renders auth welcome screen when unauthenticated', () => {
    render(<App />);
    expect(screen.getByText(/Welcome to PingUp/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter your verified phone number/i)).toBeInTheDocument();
  });

  it('contains phone number input field defaulting to India (+91)', () => {
    render(<App />);
    const countrySelect = screen.getByLabelText(/Country Code/i) as HTMLSelectElement;
    expect(countrySelect.value).toBe('+91');
    const input = screen.getByPlaceholderText(/98765/i);
    expect(input).toBeInTheDocument();
  });
});
