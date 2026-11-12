import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/chat/Sidebar';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

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

  it('renders auth welcome screen without developer phase labels when unauthenticated', () => {
    render(<App />);
    expect(screen.getByText(/Welcome to PingUp/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter your phone number to log in or create an account/i)).toBeInTheDocument();
    expect(screen.queryByText(/Phase 2|Server-Verified Tokens|Zero Destructive/i)).not.toBeInTheDocument();
  });

  it('contains phone number input field defaulting to India (+91)', () => {
    render(<App />);
    const countrySelect = screen.getByLabelText(/Country Code/i) as HTMLSelectElement;
    expect(countrySelect.value).toBe('+91');
    const input = screen.getByPlaceholderText(/98765/i);
    expect(input).toBeInTheDocument();
  });

  it('keeps header and sidebar clean without phase, preview mode, or database clutter', () => {
    useChatStore.setState({ conversations: [], activeConversationId: null });
    render(
      <>
        <Header />
        <Sidebar />
      </>
    );

    expect(screen.getByText('PingUp')).toBeInTheDocument();
    expect(screen.getByText('Chats')).toBeInTheDocument();
    expect(screen.queryByText(/Phase 1|PostgreSQL|Redis|Preview Mode|v0\.3\.0/i)).not.toBeInTheDocument();
  });
});
