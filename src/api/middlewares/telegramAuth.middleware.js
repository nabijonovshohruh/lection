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

  console.log(
    `[auth] initData'dan ajratilgan foydalanuvchi: id=${telegramUser.id} (${typeof telegramUser.id}), ` +
      `path=${req.path}`
  );

  try {
    const user = await usersService.findByTelegramId(telegramUser.id);
    if (!user) {
      console.log(`[auth] telegram_id=${telegramUser.id} bo'yicha foydalanuvchi bazada topilmadi`);
      return res.status(404).json({ message: "Foydalanuvchi topilmadi. Avval botda /start bosing." });
    }
    console.log(`[auth] bazadan topildi: user#${user.id} role='${user.role}'`);

    // ADMIN_TELEGRAM_ID bazadagi eski roldan ustun turadi — har so'rovda tekshiriladi,
    // shunda /start qayta bosilmasa ham admin holati to'g'ri ko'rsatiladi.
    req.user = await usersService.ensureAdminRole(user);
    console.log(`[auth] req.user yakuniy: user#${req.user.id} role='${req.user.role}'`);

    next();
  } catch (err) {
    next(err);
  }
};
