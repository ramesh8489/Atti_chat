import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { useCallStore } from './store/callStore';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, step, isInitialized } = useAuthStore();
  const isAuthenticated = currentUser !== null && step === 'AUTHENTICATED';

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { currentUser, step, initAuth, authToken } = useAuthStore();
  const { initRealtime, cleanupRealtime } = useChatStore();
  const { initCallListeners } = useCallStore();
  const isAuthenticated = currentUser !== null && step === 'AUTHENTICATED';

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [initAuth]);

  useEffect(() => {
    let unsubCall: (() => void) | undefined;

    if (isAuthenticated && authToken && currentUser) {
      initRealtime(authToken, currentUser.id);
      unsubCall = initCallListeners();
    } else {
      cleanupRealtime();
    }

    return () => {
      if (unsubCall) unsubCall();
      cleanupRealtime();
    };
  }, [isAuthenticated, authToken, currentUser?.id, initRealtime, cleanupRealtime, initCallListeners]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/chat" replace /> : <Navigate to="/auth" replace />
            }
          />
          <Route
            path="/auth"
            element={
              isAuthenticated ? <Navigate to="/chat" replace /> : <AuthPage />
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
