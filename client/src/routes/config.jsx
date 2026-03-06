import { lazy } from 'react';
import Home from '../pages/Home.jsx';
import Decks from '../pages/Decks.jsx';
import { ProtectedRoute } from '../components/auth/ProtectedRoute.jsx';

// Lazy load pages
const Classes = lazy(() => import('../pages/Classes.jsx'));
const ClassView = lazy(() => import('../pages/ClassView.jsx'));
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
const StudyGroups = lazy(() => import('../pages/StudyGroups.jsx'));
const GroupDetails = lazy(() => import('../pages/GroupDetails.jsx'));

const GroupCram = lazy(() => import('../pages/GroupCram.jsx'));
const ResetPassword = lazy(() => import('../pages/ResetPassword.jsx'));
const VerifyEmail = lazy(() => import('../pages/VerifyEmail.jsx'));
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy.jsx'));
const TermsOfService = lazy(() => import('../pages/TermsOfService.jsx'));

export const routesConfig = [
  // Public Routes
  { path: '/', element: <Home mode="landing" /> },
  { path: '/decks', element: <Decks /> },
  { path: '/account', element: <Account /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/verify-email', element: <VerifyEmail /> },
  { path: '/privacy', element: <PrivacyPolicy /> },
  { path: '/terms', element: <TermsOfService /> },

  // Protected Routes
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <Home mode="dashboard" /> },
      { path: '/classes', element: <Classes /> },
      { path: '/class/:id', element: <ClassView /> },
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
      { path: '/groups', element: <StudyGroups /> },
      { path: '/groups/:id', element: <GroupDetails /> },
      { path: '/groups/:groupId/cram/:sessionId', element: <GroupCram /> },
    ],
  },

  // Catch-all
  { path: '*', element: <NotFound /> },
];
