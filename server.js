require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

// ✅ ต้องใช้ raw body เฉพาะ Webhook เท่านั้น
app.post('/webhook',
  express.raw({ type: '*/*' }),
  line.middleware({
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
  }),
  async (req, res) => {
    try {
      const events = JSON.parse(req.body.toString()).events;
      await Promise.all(events.map(handleEvent));
      res.sendStatus(200);
    } catch (err) {
      console.error('❌ Webhook Error:', err);
      res.sendStatus(500);
    }
  }
);

// ✅ JSON middleware สำหรับ path อื่นๆ
app.use(express.json());

// ✅ เช็กสถานะ
app.get('/', (req, res) => {
  res.send('🤖 Health Chatbot is running.');
});

// ===== ฟังก์ชันหลัก =====
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userText = event.message.text;
  const replyToken = event.replyToken;

  try {
    // 👉 1. บันทึกคำถามลง Google Sheets
    await axios.post(process.env.APPS_SCRIPT_URL, {
      question: userText,
      timestamp: new Date().toISOString()
    });

    // 👉 2. ขอคำตอบจาก AI (OpenRouter)
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
          'HTTP-Referer': 'https://github.com/Aek203', // เปลี่ยนเป็นของคุณเองถ้าใช้ GitHub
          'X-Title': 'LINE Health Chatbot'
        }
      }
    );

    const aiText = aiRes.data.choices[0].message.content;

    // 👉 3. ตอบกลับผู้ใช้ใน LINE
    await new line.Client({
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.CHANNEL_SECRET,
    }).replyMessage(replyToken, {
      type: 'text',
      text: aiText
    });

  } catch (err) {
    console.error('📡 AI or Google Sheets Error:', err.response?.data || err.message);

    await client.replyMessage(replyToken, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถามของคุณ'
    });
  }
}

// ✅ เริ่มเซิร์ฟเวอร์
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
