// Public app configuration. None of these values are secret:
// an OAuth Client ID, Sheet ID and Drive folder IDs only work for people
// the owner has shared the Sheet and folder with.
// Never put API keys or client secrets in this file.

export const APP_VERSION = '0.1.0';

export const appConfig = {
  googleClientId: '56837720110-3j8qfag3t3onqclcbqj0qptld4kcd629.apps.googleusercontent.com',

  // Filled in after running the first-run setup screen.
  sheetId: '',
  driveFolders: {
    root: '', // Reels/
    raw: '', // Reels/01 Raw Videos/
    working: '', // Reels/02 Working Videos/
    completed: '', // Reels/03 Completed Videos/
  },
};

export type AppIds = {
  sheetId: string;
  driveFolders: { root: string; raw: string; working: string; completed: string };
};
