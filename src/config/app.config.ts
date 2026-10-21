// Public app configuration. None of these values are secret:
// an OAuth Client ID, Sheet ID and Drive folder IDs only work for people
// the owner has shared the Sheet and folder with.
// Never put API keys or client secrets in this file.

export const APP_VERSION = '0.2.0';

export const appConfig = {
  googleClientId: '56837720110-3j8qfag3t3onqclcbqj0qptld4kcd629.apps.googleusercontent.com',

  // From the first-run setup screen (2026-10-21).
  sheetId: '1Hh8oqqGsLuuFSGRVolth0xKBvciXTE4tanu0dSYjl5o',
  driveFolders: {
    root: '1kbTXU4lRlWMu5WRFI3FjAaSYQ283kCn1', // Reels/
    raw: '19CIrfFY6QBw6bv1iNmmEANVfj2G0dcjo', // Reels/01 Raw Videos/
    working: '1m3pIwe6gd7nw0_W3BVlrQg1mTjTyK01K', // Reels/02 Working Videos/
    completed: '1p7h9CgmRBF_Gjeq4uvbBQ37DvBeI01mR', // Reels/03 Completed Videos/
  },
};

export type AppIds = {
  sheetId: string;
  driveFolders: { root: string; raw: string; working: string; completed: string };
};
