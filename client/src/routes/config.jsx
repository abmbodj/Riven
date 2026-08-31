import { lazy } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute.jsx';
import { GroupErrorBoundary } from '../components/ui/GroupErrorBoundary';

// Lazy load pages
const LandingPage = lazy(() => import('../pages/LandingPage.jsx'));
const Home = lazy(() => import('../pages/Home.jsx'));
const StudyDashboard = lazy(() => import('../pages/StudyDashboard.jsx'));
const DeckLibrary = lazy(() => import('../pages/DeckLibrary.jsx'));
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
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy.jsx'));
const TermsOfService = lazy(() => import('../pages/TermsOfService.jsx'));

// Study Dashboard modules
const NotesLibrary = lazy(() => import('../pages/NotesLibrary.jsx'));
const NoteEditor = lazy(() => import('../pages/NoteEditor.jsx'));
const GuidesLibrary = lazy(() => import('../pages/GuidesLibrary.jsx'));
const GuideView = lazy(() => import('../pages/GuideView.jsx'));
const ExamsLibrary = lazy(() => import('../pages/ExamsLibrary.jsx'));
const ExamView = lazy(() => import('../pages/ExamView.jsx'));
const YouTubeImport = lazy(() => import('../pages/YouTubeImport.jsx'));
const Onboarding = lazy(() => import('../pages/Onboarding.jsx'));
const Calendar = lazy(() => import('../pages/Calendar.jsx'));
const GardenRouteProvider = lazy(() => import('../context/GardenRouteProvider.jsx'));
const StreakRouteProvider = lazy(() => import('../context/StreakRouteProvider.jsx'));

const withGardenProvider = (element) => (
  <GardenRouteProvider>
    {element}
  </GardenRouteProvider>
);

const withStreakProvider = (element) => (
  <StreakRouteProvider>
    {element}
  </StreakRouteProvider>
);

// Route prefetch map — call prefetchRoute(path) on hover/touchstart for instant navigation
const routeImportMap = {
  '/dashboard': () => import('../pages/Home.jsx'),
  '/decks/library': () => import('../pages/DeckLibrary.jsx'),
  '/notes': () => import('../pages/NotesLibrary.jsx'),
  '/guides': () => import('../pages/GuidesLibrary.jsx'),
  '/exams': () => import('../pages/ExamsLibrary.jsx'),
  '/classes': () => import('../pages/Classes.jsx'),
  '/calendar': () => import('../pages/Calendar.jsx'),
  '/create': () => import('../pages/CreateDeck.jsx'),
  '/themes': () => import('../pages/ThemeSettings.jsx'),
  '/garden': () => import('../pages/GardenSettings.jsx'),
  '/settings': () => import('../pages/Settings.jsx'),
  '/friends': () => import('../pages/Friends.jsx'),
  '/messages': () => import('../pages/Messages.jsx'),
  '/groups': () => import('../pages/StudyGroups.jsx'),
};

// Optional data warm-up alongside the code prefetch, so hovering a nav item also
// primes its data into the cache. Dynamic import avoids eagerly coupling routes->api.
const routeDataPrefetch = {
  '/groups': () => import('../api').then(m => m.api.getGroups()).catch(() => {}),
};

const prefetched = new Set();

export function prefetchRoute(path) {
  // Normalize dynamic routes to their base
  const basePath = Object.keys(routeImportMap).find(p => path === p || path.startsWith(p + '/'));
  if (!basePath || prefetched.has(basePath)) return;
  prefetched.add(basePath);
  routeImportMap[basePath]?.();
  routeDataPrefetch[basePath]?.();
}

export const routesConfig = [
  // Public Routes
  { path: '/', element: <LandingPage /> },
  { path: '/decks', element: <StudyDashboard /> },
  { path: '/account', element: <Account /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/privacy', element: <PrivacyPolicy /> },
  { path: '/terms', element: <TermsOfService /> },
  // Onboarding doubles as the logged-out mobile signup funnel, so it stays public.
  { path: '/onboarding', element: <Onboarding /> },

  // Protected Routes
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <Home /> },
      { path: '/decks/library', element: <DeckLibrary /> },
      { path: '/notes', element: <NotesLibrary /> },
      { path: '/note/:id', element: <NoteEditor /> },
      { path: '/guides', element: <GuidesLibrary /> },
      { path: '/guide/:id', element: <GuideView /> },
      { path: '/exams', element: <ExamsLibrary /> },
      { path: '/exam/:id', element: <ExamView /> },
      { path: '/classes', element: <Classes /> },
      { path: '/calendar', element: <Calendar /> },
      { path: '/class/:id', element: <ClassView /> },
      { path: '/create', element: <CreateDeck /> },
      { path: '/deck/:id', element: <DeckView /> },
      { path: '/deck/:id/study', element: withStreakProvider(<StudyMode />) },
      { path: '/deck/:id/test', element: withStreakProvider(<TestMode />) },
      { path: '/themes', element: <ThemeSettings /> },
      { path: '/garden', element: withGardenProvider(<GardenSettings />) },
      { path: '/edit-profile', element: <EditProfile /> },
      { path: '/settings', element: <Settings /> },
      { path: '/admin', element: <AdminPanel /> },
      { path: '/friends', element: <Friends /> },
      { path: '/messages', element: <Messages /> },
      { path: '/messages/:userId', element: <Messages /> },
      { path: '/profile/:userId', element: <UserProfile /> },
      { path: '/groups', element: <GroupErrorBoundary><StudyGroups /></GroupErrorBoundary> },
      { path: '/groups/:id', element: <GroupErrorBoundary><GroupDetails /></GroupErrorBoundary> },
      { path: '/groups/:groupId/cram/:sessionId', element: <GroupCram /> },
      { path: '/youtube', element: <YouTubeImport /> },
    ],
  },

  // Catch-all
  { path: '*', element: <NotFound /> },
];
