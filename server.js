require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();
app.use(express.json()); // ✅ รองรับ JSON POST

// === LINE CONFIG ===
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(config);

// === WEBHOOK ===
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook Error:', err);
    res.sendStatus(500);
  }
});

// === ROOT CHECK ===
app.get('/', (req, res) => {
  res.send('🤖 Health Chatbot is running.');
});

// === MAIN EVENT HANDLER ===
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userText = event.message.text;
  const replyToken = event.replyToken;

  try {
    // 1️⃣ บันทึกคำถามไป Google Sheets
    await axios.post(process.env.APPS_SCRIPT_URL, {
      question: userText,
      timestamp: new Date().toISOString()
    });

    // 2️⃣ ขอคำตอบจาก OpenRouter
    const aiRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3-70b-instruct',
        messages: [
          { role: 'system', content: 'You are a helpful health assistant.' },
          { role: 'user', content: userText }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Aek203', // ใส่ GitHub URL หรือโดเมนคุณ
          'X-Title': 'LINE Health Chatbot'
        }
      }
    );

    const aiText = aiRes.data.choices[0].message.content;

    // 3️⃣ ตอบกลับผู้ใช้ LINE
    await client.replyMessage(replyToken, {
      type: 'text',
      text: aiText
    });

  } catch (err) {
    console.error('📡 Error:', err.response?.data || err.message);

    await client.replyMessage(replyToken, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถามของคุณ'
    });
  }
}

// === START SERVER ===
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
