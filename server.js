require('dotenv').config(); // โหลด .env

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();
app.use(express.json()); // ต้องมี เพื่อรับ webhook จาก LINE

// === LINE Config ===
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

// === Root route สำหรับตรวจสอบว่าเว็บรันอยู่ไหม ===
app.get('/', (req, res) => {
  res.send('🤖 Health Chatbot is running.');
});

// === LINE Webhook endpoint ===
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook Error:', err);
    res.sendStatus(500);
  }
});

// === ฟังก์ชันรับข้อความจากผู้ใช้ และส่งไปยัง AI ===
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userText = event.message.text;

  try {
    const aiRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: 'You are a helpful health assistant.' },
          { role: 'user', content: userText },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://health-chatbot-9uc4.onrender.com', // ← เปลี่ยนให้ตรงกับ Render URL
          'X-Title': 'LINE Health Chatbot',
        },
      }
    );

    const aiText = aiRes.data.choices[0].message.content;

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiText,
    });

  } catch (err) {
    if (err.response) {
      console.error('📡 OpenRouter API Error:', err.response.status, err.response.data);
    } else {
      console.error('❌ General Error:', err.message);
    }

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถามของคุณ',
    });
  }
}

// === Start server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
