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
import NotFound from './pages/NotFound';
import MobileWarning from './components/MobileWarning';

function App() {
  return (
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
