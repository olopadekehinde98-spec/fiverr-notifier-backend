const express = require('express');
const { answerQuestion } = require('../services/claude');

const router = express.Router();

router.post('/', async (req, res) => {
  const { question, emailContext } = req.body;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Missing question' });
  }

  try {
    const answer = await answerQuestion(question.slice(0, 1000), emailContext);
    res.json({ answer });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
