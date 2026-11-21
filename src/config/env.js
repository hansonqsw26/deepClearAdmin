/**
 * Build-time settings. Create React App only exposes variables that start with
 * REACT_APP_ — set them in .env.local (dev) or .env.production (build).
 */
const trimSlash = (value) => value.replace(/\/+$/, '');

/** Base URL of the DeepClear API, without a trailing slash. */
export const API_BASE_URL = trimSlash(process.env.REACT_APP_API_BASE_URL || 'https://deepclear.ca/api');

/** localStorage key that holds the logged-in user (and their token). */
export const SESSION_STORAGE_KEY = 'adminUser';
