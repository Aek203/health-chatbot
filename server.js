require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();
app.use(express.json());

// ===== LINE CONFIG =====
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(config);

// ===== WEBHOOK =====
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

app.get('/', (req, res) => {
  res.send('🤖 Health Chatbot is running.');
});

// ===== ฟังก์ชันหลัก =====
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userText = event.message.text;
  const replyToken = event.replyToken;

  try {
    // 👉 ส่งคำถามไปเก็บที่ Google Sheet ก่อน
    await axios.post(process.env.APPS_SCRIPT_URL, {
      question: userText,
      timestamp: new Date().toISOString()
    });

    // 👉 เรียก AI ผ่าน OpenRouter
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
          'HTTP-Referer': 'https://yourusername.github.io',
          'X-Title': 'LINE Health Chatbot'
        }
      }
    );

    const aiText = aiRes.data.choices[0].message.content;

    await client.replyMessage(replyToken, {
      type: 'text',
      text: aiText
    });

  } catch (err) {
    if (err.response) {
      console.error('📡 OpenRouter API Error:', err.response.status, err.response.data);
    } else {
      console.error('❌ Other Error:', err.message);
    }

    await client.replyMessage(replyToken, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถามของคุณ'
    });
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
