import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CreateDeck from './pages/CreateDeck';
import DeckView from './pages/DeckView';
import StudyMode from './pages/StudyMode';
import TestMode from './pages/TestMode';
import ThemeSettings from './pages/ThemeSettings';
import PetSettings from './pages/PetSettings';
import Account from './pages/Account';
import SharedDecks from './pages/SharedDecks';
import AdminPanel from './pages/AdminPanel';
import NotFound from './pages/NotFound';
import MobileWarning from './components/MobileWarning';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MobileWarning />
        <Layout>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
