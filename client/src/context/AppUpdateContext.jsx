import { createContext, useContext } from 'react';

const noop = () => {};
const noopAsync = async () => false;

export const AppUpdateContext = createContext({
  isUpdateAvailable: false,
  isRefreshingUpdate: false,
  dismissUpdate: noop,
  refreshToLatestVersion: noopAsync,
});

export function useAppUpdate() {
  return useContext(AppUpdateContext);
}
