import Layout from '../Layout.jsx';
import { RecordingSessionProvider } from '../../context/RecordingSessionContext.jsx';

export function RootLayout({ children }) {
  return (
    <RecordingSessionProvider>
      <Layout>{children}</Layout>
    </RecordingSessionProvider>
  );
}
