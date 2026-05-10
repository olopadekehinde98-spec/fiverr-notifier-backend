const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '../data/tokens.json');

async function loadTokens() {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function storeTokens(email, tokens) {
  await fs.mkdir(path.dirname(TOKENS_FILE), { recursive: true });
  const all = await loadTokens();
  all[email] = tokens;
  await fs.writeFile(TOKENS_FILE, JSON.stringify(all, null, 2));
}

async function removeAccount(email) {
  const all = await loadTokens();
  delete all[email];
  await fs.writeFile(TOKENS_FILE, JSON.stringify(all, null, 2));
}

async function getAuthClient(email) {
  const tokens = await loadTokens();
  if (!tokens[email]) throw new Error(`No tokens stored for ${email}`);

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials(tokens[email]);

  // Persist refreshed tokens automatically
  client.on('tokens', async (newTokens) => {
    if (newTokens.refresh_token) {
      await storeTokens(email, { ...tokens[email], ...newTokens });
    }
  });

  return client;
}

async function setupGmailWatch(email, authClient) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const topicName = `projects/${process.env.GOOGLE_PROJECT_ID}/topics/${process.env.PUBSUB_TOPIC}`;

  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: { labelIds: ['INBOX'], topicName },
  });

  console.log(`Gmail watch active for ${email}, historyId: ${res.data.historyId}`);
}

async function fetchEmailById(authClient, messageId) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return msg.data;
}

async function getNewMessages(email, historyId) {
  const authClient = await getAuthClient(email);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  try {
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    });

    const messages = [];
    if (history.data.history) {
      for (const record of history.data.history) {
        if (record.messagesAdded) {
          for (const { message } of record.messagesAdded) {
            const full = await fetchEmailById(authClient, message.id);
            messages.push(full);
          }
        }
      }
    }
    return messages;
  } catch (err) {
    console.error(`History fetch error for ${email}:`, err.message);
    return [];
  }
}

module.exports = { loadTokens, storeTokens, removeAccount, setupGmailWatch, getNewMessages };
