/**
 * Garden — public entry for the streak garden art.
 *
 * This is the single import boundary every consumer (GardenSettings, gallery)
 * depends on. It switches between the rebuilt "luminous depth" scene and the
 * legacy art on the VITE_NEW_GARDEN flag, so rollout/rollback is one env var and
 * the prop API ({ streak, status, size, showInfo, svgClassName }) never changes.
 */

import GardenLegacy from './garden/GardenLegacy';
import GardenScene from './garden/GardenScene';
import { isNewGardenEnabled } from './garden/model/flags';

export default function Garden(props) {
    return isNewGardenEnabled() ? <GardenScene {...props} /> : <GardenLegacy {...props} />;
}
