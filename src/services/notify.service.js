const config = require('../config');

async function sendTelegramMessage(telegramId, text) {
  if (!config.botToken) return;

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text }),
    });
  } catch (err) {
    console.error('Telegram notify failed:', err.message);
  }
}

module.exports = { sendTelegramMessage };
