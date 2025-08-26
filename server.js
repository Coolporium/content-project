const express = require('express');
const { google } = require('googleapis');
const cors = require('cors'); // We will configure this now

const app = express();
const port = 3000;

// --- NEW: Specific CORS Configuration ---
const allowedOrigins = [
    'https://zesty-entremet-052696.netlify.app',
    'http://localhost:3000' // Keep for local testing if needed
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));
// --- End of New Section ---

// Your Client ID and Secret should be in Render's Environment Variables
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUR_CLIENT_ID,
  process.env.YOUR_CLIENT_SECRET,
  `https://content-project.onrender.com/oauth2callback` // <-- Corrected URL
);

const scopes = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
];

let userTokens = null;

// (The rest of your server.js code remains exactly the same)
// ... from getDates function down to the app.listen block ...
function getDates(period) {
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
        case '24h':
            startDate.setDate(endDate.getDate() - 1);
            break;
        case '48h':
            startDate.setDate(endDate.getDate() - 2);
            break;
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        default:
            startDate.setDate(endDate.getDate() - 7); 
    }
    const formatDate = (date) => date.toISOString().split('T')[0];
    return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
}

app.get('/login', (req, res) => {
  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true
  });
  res.redirect(authorizationUrl);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    userTokens = tokens;
    oauth2Client.setCredentials(userTokens);
    console.log('Successfully authenticated! You can close this tab.');
    res.send('<h1>Authentication successful!</h1><p>You can now close this browser tab and return to your dashboard.</p>');
  } catch (error) {
    console.error('Error getting tokens', error);
    res.status(500).send('Authentication failed.');
  }
});

app.get('/get-analytics', async (req, res) => {
  if (!userTokens) {
    return res.status(401).json({ error: 'User not authenticated. Please restart the server to log in.' });
  }

  const { period } = req.query;
  if (!period) {
    return res.status(400).json({ error: 'Period parameter is required (e.g., ?period=7d).' });
  }
  const { startDate, endDate } = getDates(period);

  const youtubeAnalytics = google.youtubeAnalytics({
    version: 'v2',
    auth: oauth2Client,
  });

  try {
    console.log(`Received request for period: ${period}`); // Added for debugging
    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: startDate,
      endDate: endDate,
      metrics: 'views', 
    });
    console.log("Successfully fetched data from YouTube Analytics API."); // Added for debugging
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching analytics data:', error.message);
    res.status(500).json({ error: 'Failed to fetch analytics data.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => { 
  console.log(`Server running and listening on port ${PORT}`);
});