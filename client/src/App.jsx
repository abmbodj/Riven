import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CreateDeck from './pages/CreateDeck';
import DeckView from './pages/DeckView';
import StudyMode from './pages/StudyMode';
import TestMode from './pages/TestMode';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateDeck />} />
          <Route path="/deck/:id" element={<DeckView />} />
          <Route path="/deck/:id/study" element={<StudyMode />} />
          <Route path="/deck/:id/test" element={<TestMode />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
