import { lazy } from 'react';
import Home from '../pages/Home.jsx';
import { ProtectedRoute } from '../components/auth/ProtectedRoute.jsx';

// Lazy load pages
const CreateDeck = lazy(() => import('../pages/CreateDeck.jsx'));
const DeckView = lazy(() => import('../pages/DeckView.jsx'));
const StudyMode = lazy(() => import('../pages/StudyMode.jsx'));
const TestMode = lazy(() => import('../pages/TestMode.jsx'));
const ThemeSettings = lazy(() => import('../pages/ThemeSettings.jsx'));
const GardenSettings = lazy(() => import('../pages/GardenSettings.jsx'));
const Account = lazy(() => import('../pages/Account.jsx'));
const AdminPanel = lazy(() => import('../pages/AdminPanel.jsx'));
const Friends = lazy(() => import('../pages/Friends.jsx'));
const Messages = lazy(() => import('../pages/Messages.jsx'));
const UserProfile = lazy(() => import('../pages/UserProfile.jsx'));
const NotFound = lazy(() => import('../pages/NotFound.jsx'));

// New Pages
const EditProfile = lazy(() => import('../pages/EditProfile.jsx'));
const Settings = lazy(() => import('../pages/Settings.jsx'));

export const routesConfig = [
  // Public Routes
  { path: '/', element: <Home /> },
  { path: '/account', element: <Account /> },

  // Protected Routes
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/create', element: <CreateDeck /> },
      { path: '/deck/:id', element: <DeckView /> },
      { path: '/deck/:id/study', element: <StudyMode /> },
      { path: '/deck/:id/test', element: <TestMode /> },
      { path: '/themes', element: <ThemeSettings /> },
      { path: '/garden', element: <GardenSettings /> },
      { path: '/edit-profile', element: <EditProfile /> },
      { path: '/settings', element: <Settings /> },
      { path: '/admin', element: <AdminPanel /> },
      { path: '/friends', element: <Friends /> },
      { path: '/messages', element: <Messages /> },
      { path: '/messages/:userId', element: <Messages /> },
      { path: '/profile/:userId', element: <UserProfile /> },
    ],
  },

  // Catch-all
  { path: '*', element: <NotFound /> },
];
