import { StreakProvider } from './StreakContext.jsx';

export default function StreakRouteProvider({ children }) {
    return <StreakProvider>{children}</StreakProvider>;
}
