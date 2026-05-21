import { GardenProvider } from './GardenContext.jsx';

export default function GardenRouteProvider({ children }) {
    return <GardenProvider>{children}</GardenProvider>;
}
