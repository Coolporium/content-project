const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const port = 3000;

const allowedOrigins = [
    'https://zesty-entremet-052696.netlify.app',
    'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUR_CLIENT_ID,
  process.env.YOUR_CLIENT_SECRET,
  `https://content-project.onrender.com/oauth2callback`
);

const scopes = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
];

let userTokens = null;

function getDates(period) {
    const endDate = new Date();
    const startDate = new Date();
    // Set time to 00:00:00 to avoid timezone issues
    endDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

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
    console.log(`Received request for period: ${period} (${startDate} to ${endDate})`);
    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: startDate,
      endDate: endDate,
      metrics: 'views',
    });
    console.log("Successfully fetched data from YouTube Analytics API.");

    // --- IMPROVED DATA HANDLING ---
    // Check if the response has rows and is an array
    if (response.data && Array.isArray(response.data.rows) && response.data.rows.length > 0) {
        // The view count is the second item (index 1) in each row. Sum them up.
        const totalViews = response.data.rows.reduce((sum, row) => sum + (row[1] || 0), 0);
        res.json({ ...response.data, totalViews: totalViews }); // Send back the total
    } else {
        // If there are no rows, it means 0 views for that period.
        res.json({ ...response.data, rows: [], totalViews: 0 });
    }
    // --- END OF IMPROVEMENT ---

  } catch (error) {
    console.error('Error fetching analytics data:', error.message);
    res.status(500).json({ error: 'Failed to fetch analytics data.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running and listening on port ${PORT}`);
});