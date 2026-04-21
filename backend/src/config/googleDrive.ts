import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5050'
);

// Set credentials using the refresh token stored in .env
// After running `npx ts-node src/scripts/getGoogleToken.ts`, add GOOGLE_REFRESH_TOKEN to .env
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});

export { oauth2Client as auth };
export default drive;
