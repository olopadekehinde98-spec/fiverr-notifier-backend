const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateSummary(emailData) {
  const { subject, from, body } = emailData;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [
      {
        role: 'user',
        content: `You read Fiverr emails and write very short notification summaries.

Email:
Subject: ${subject}
From: ${from}
Body: ${body}

Write ONE sentence (max 15 words) summarizing this email. Be specific — include buyer name, amount, or action if visible. Examples:
- "New order from buyer john99 — Logo Design · $75"
- "Message from sarah22 asking about delivery time"
- "Order #FO123456 completed — payment released"
- "Cancellation request from tom_x — Logo Design · $45"
- "New 5-star review from anna_k"

Only the summary sentence, nothing else.`,
      },
    ],
  });

  return response.content[0].text.trim();
}

async function answerQuestion(question, emailContext = '') {
  const context = emailContext
    ? `\n\nRecent Fiverr email:\n${emailContext}`
    : '';

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `You are a helpful assistant for a Fiverr seller. Answer concisely.${context}\n\nQuestion: ${question}`,
      },
    ],
  });

  return response.content[0].text.trim();
}

module.exports = { generateSummary, answerQuestion };
