import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhoneLoginCard } from '../components/auth/PhoneLoginCard';
import { useAuthStore } from '../store/authStore';

describe('PhoneLoginCard Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      step: 'PHONE_ENTRY',
      phoneNumber: '',
      isLoading: false,
      errorMessage: null,
    });
  });

  it('defaults to India (+91) country code', () => {
    render(<PhoneLoginCard />);
    const select = screen.getByLabelText(/Country Code/i) as HTMLSelectElement;
    expect(select.value).toBe('+91');
  });

  it('updates country code and placeholder when user changes selection', () => {
    render(<PhoneLoginCard />);
    const select = screen.getByLabelText(/Country Code/i);
    fireEvent.change(select, { target: { value: '+1' } });
    expect(screen.getByPlaceholderText(/\(555\)/i)).toBeInTheDocument();
  });

  it('validates minimum phone number length and shows error', async () => {
    render(<PhoneLoginCard />);
    const input = screen.getByPlaceholderText(/98765/i);
    fireEvent.change(input, { target: { value: '123' } });

    const submitBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid phone number/i)).toBeInTheDocument();
    });
  });

  it('disables submit button when phone number is empty', () => {
    render(<PhoneLoginCard />);
    const submitBtn = screen.getByRole('button', { name: /Continue/i });
    expect(submitBtn).toBeDisabled();
  });

  it('displays loading spinner when isLoading is true', () => {
    useAuthStore.setState({ isLoading: true });
    render(<PhoneLoginCard />);
    const submitBtn = screen.getByRole('button');
    expect(submitBtn).toBeDisabled();
    expect(submitBtn.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays error message from auth store', () => {
    useAuthStore.setState({ errorMessage: 'SMS quota exceeded for this Firebase project.' });
    render(<PhoneLoginCard />);
    expect(screen.getByText(/SMS quota exceeded/i)).toBeInTheDocument();
  });
});
