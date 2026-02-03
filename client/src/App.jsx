import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import MobileWarning from './components/MobileWarning';
import { AuthProvider } from './context/AuthContext';
import { PetProvider } from './context/PetContext';
import { UIProvider } from './context/UIContext';

// Lazy load non-critical pages
const CreateDeck = lazy(() => import('./pages/CreateDeck'));
const DeckView = lazy(() => import('./pages/DeckView'));
const StudyMode = lazy(() => import('./pages/StudyMode'));
const TestMode = lazy(() => import('./pages/TestMode'));
const ThemeSettings = lazy(() => import('./pages/ThemeSettings'));
const PetSettings = lazy(() => import('./pages/PetSettings'));
const Account = lazy(() => import('./pages/Account'));
const SharedDecks = lazy(() => import('./pages/SharedDecks'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Friends = lazy(() => import('./pages/Friends'));
const Messages = lazy(() => import('./pages/Messages'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Simple loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <PetProvider>
        <UIProvider>
          <BrowserRouter>
            <MobileWarning />
            <Layout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/create" element={<CreateDeck />} />
                <Route path="/deck/:id" element={<DeckView />} />
                <Route path="/deck/:id/study" element={<StudyMode />} />
                <Route path="/deck/:id/test" element={<TestMode />} />
                <Route path="/themes" element={<ThemeSettings />} />
                <Route path="/pet" element={<PetSettings />} />
                <Route path="/account" element={<Account />} />
                <Route path="/shared" element={<SharedDecks />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:userId" element={<Messages />} />
                <Route path="/profile/:userId" element={<UserProfile />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
        </UIProvider>
      </PetProvider>
    </AuthProvider>
  );
}

export default App;
