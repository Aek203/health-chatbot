require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};
const client = new line.Client(config);
const app = express();

app.post('/webhook', line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.sendStatus(200);
});
app.get('/', (req, res) => {
  res.send('🤖 Health Chatbot is running.');
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  const userText = event.message.text;
try {
  const response = await openai.createChatCompletion({ ... });
  // ใช้งาน response.data.choices[0].message.content
} catch (error) {
  console.error('❌ ERROR FROM OPENAI:', error.response?.data || error.message);
  res.status(500).send('เกิดข้อผิดพลาดในการประมวลผลคำถาม');
}

  try {
    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful health assistant." },
          { role: "user", content: userText }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiText = aiRes.data.choices[0].message.content;
    await client.replyMessage(event.replyToken, { type: 'text', text: aiText });
  } catch (err) {
    console.error('Error handling event:', err);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
