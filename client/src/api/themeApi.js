import {
    activateTheme as activateRemoteTheme,
    createTheme as createRemoteTheme,
    deleteTheme as deleteRemoteTheme,
    getThemes as getRemoteThemes,
    getToken,
    updateTheme as updateRemoteTheme,
} from './authApi.js';
import {
    createTheme as createLocalTheme,
    deleteTheme as deleteLocalTheme,
    getThemes as getLocalThemes,
    setActiveTheme as activateLocalTheme,
    updateTheme as updateLocalTheme,
} from '../db/indexedDB.js';

const isLoggedIn = () => Boolean(getToken());

export const themeApi = {
    getThemes: () => (isLoggedIn() ? getRemoteThemes() : getLocalThemes()),
    activateTheme: (id) => (
        isLoggedIn() ? activateRemoteTheme(id) : activateLocalTheme(id)
    ),
    createTheme: (theme) => (
        isLoggedIn() ? createRemoteTheme(theme) : createLocalTheme(theme)
    ),
    updateTheme: (id, theme) => (
        isLoggedIn() ? updateRemoteTheme(id, theme) : updateLocalTheme(id, theme)
    ),
    deleteTheme: (id) => (
        isLoggedIn() ? deleteRemoteTheme(id) : deleteLocalTheme(id)
    ),
};
