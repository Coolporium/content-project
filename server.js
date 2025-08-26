const express = require('express');
const { google } = require('googleapis');
const cors = require('cors'); 
// Add these two lines for debugging:
console.log("Attempting to read Client ID:", process.env.YOUR_CLIENT_ID);
console.log("Attempting to read Client Secret:", process.env.YOUR_CLIENT_SECRET ? "Secret is loaded" : "Secret is UNDEFINED");

const app = express();
const port = 3000;

app.use(cors());

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUR_CLIENT_ID,       // Use the environment variable
  process.env.YOUR_CLIENT_SECRET,   // Use the environment variable
  `http://localhost:${port}/oauth2callback`
);

const scopes = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
];

let userTokens = null;

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
    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: startDate,
      endDate: endDate,
      metrics: 'views', 
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching analytics data:', error.message);
    res.status(500).json({ error: 'Failed to fetch analytics data.' });
  }
});

// --- START THE SERVER (Corrected Part) ---
// --- START THE SERVER (Corrected for Deployment) ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => { 
  console.log(`Server running and listening on port ${PORT}`);
  // The login process will only auto-open on your local machine, not on the server
  if (process.env.NODE_ENV !== 'production' && !userTokens) {
    try {
        console.log('Starting local authentication process...');
        const open = (await import('open')).default; 
        await open(`http://localhost:${port}/login`);
    } catch (err) {
        console.error("Failed to automatically open browser:", err);
        console.log("Please manually open your browser and go to http://localhost:3000/login");
    }
  }
});