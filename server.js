require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

// ===== LINE CONFIG =====
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

// ✅ ใช้ express.raw() เพื่อรองรับ signature จาก LINE
app.post('/webhook',
  express.raw({ type: 'application/json' }),
  line.middleware(config),
  async (req, res) => {
    try {
      const body = JSON.parse(req.body.toString());
      const events = body.events;

      await Promise.all(events.map(handleEvent));
      res.sendStatus(200);
    } catch (err) {
      console.error('❌ Webhook Error:', err);
      res.sendStatus(500);
    }
  }
);

// ✅ หน้า root เช็กเซิร์ฟเวอร์
app.get('/', (req, res) => {
  res.send('🤖 Health Chatbot is running.');
});

// ===== ฟังก์ชันตอบกลับข้อความด้วย OpenRouter API =====
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userText = event.message.text;

  try {
    const aiRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3-haiku', // คุณสามารถเปลี่ยนเป็น gpt-3.5, mistral ฯลฯ
        messages: [
          { role: 'system', content: 'You are a helpful health assistant.' },
          { role: 'user', content: userText }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://health-chatbot-9uc4.onrender.com', // ✅ ใช้ URL จาก Render
          'X-Title': 'LINE Health Chatbot'
        }
      }
    );

    const aiText = aiRes.data.choices[0].message.content;

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiText
    });
  } catch (err) {
    if (err.response) {
      console.error('📡 OpenRouter API Error:', err.response.status, err.response.data);
    } else {
      console.error('❌ Other Error:', err.message);
    }

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถามของคุณ'
    });
  }
}

// ===== เริ่มเซิร์ฟเวอร์ =====
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
