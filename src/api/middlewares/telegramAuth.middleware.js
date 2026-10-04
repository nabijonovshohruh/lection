const crypto = require('crypto');
const config = require('../../config');
const usersService = require('../../services/users.service');

// Telegram Mini App initData tekshiruvi:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return computedHash === hash;
}

module.exports = async function telegramAuthMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];

  if (!initData) {
    return res.status(401).json({ message: 'initData required' });
  }

  if (!verifyInitData(initData)) {
    return res.status(401).json({ message: 'Invalid initData' });
  }

  const params = new URLSearchParams(initData);
  const telegramUser = JSON.parse(params.get('user'));
  req.telegramUser = telegramUser;

  try {
    const user = await usersService.findByTelegramId(telegramUser.id);
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi. Avval botda /start bosing." });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
