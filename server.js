// เรียก dotenv เพื่อโหลดตัวแปรจาก .env
require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

// ตั้งค่าการเชื่อมต่อกับ LINE Messaging API
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// Endpoint สำหรับรับ webhook จาก LINE
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error handling webhook:', err);
    res.sendStatus(500);
  }
});

// หน้า root (สำหรับเช็กว่าเซิร์ฟเวอร์รันอยู่)
app.get('/', (req, res) => {
  res.send('🤖 Health Chatbot is running.');
});

// ฟังก์ชันรับข้อความและตอบกลับด้วย AI
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userText = event.message.text;

  try {
    // เรียก OpenAI API
 const aiRes = await axios.post(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    model: "openai/gpt-3.5-turbo",  // หรือใช้ claude/gemma/gpt-4 แล้วแต่ที่รองรับ
    messages: [
      { role: "system", content: "You are a helpful health assistant." },
      { role: "user", content: userText }
    ]
  },
  {
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://health-chatbot-9uc4.onrender.com",   // แก้เป็นเว็บของคุณหรือ GitHub
      "X-Title": "LINE Health Chatbot"
    }
  }
);

   

    const aiText = aiRes.data.choices[0].message.content;

    // ส่งคำตอบกลับไปยังผู้ใช้
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiText
    });

  } catch (err) {
    // 🔍 แสดง error ละเอียด
    if (err.response) {
      console.error('📡 OpenAI API Error:', err.response.status, err.response.data);
    } else {
      console.error('❌ Other Error:', err.message);
    }

    // ส่งข้อความ default กลับให้ผู้ใช้เมื่อเกิดปัญหา
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถามของคุณ'
    });
  }
}

// เริ่มรันเซิร์ฟเวอร์
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
