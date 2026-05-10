const FIVERR_DOMAINS = ['fiverr.com'];

function getHeader(headers, name) {
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function isFiverrEmail(message) {
  const headers = message.payload?.headers || [];
  const from = getHeader(headers, 'From').toLowerCase();
  return FIVERR_DOMAINS.some((domain) => from.includes(domain));
}

function extractEmailData(message) {
  const headers = message.payload?.headers || [];
  const subject = getHeader(headers, 'Subject');
  const from = getHeader(headers, 'From');
  const date = getHeader(headers, 'Date');

  let body = '';
  const parts = message.payload?.parts || [];

  if (parts.length > 0) {
    const textPart = parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  } else if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  }

  // Cap body length to keep Claude API calls fast and cheap
  return { subject, from, date, body: body.slice(0, 2000) };
}

module.exports = { isFiverrEmail, extractEmailData };
