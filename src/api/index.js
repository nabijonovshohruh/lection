const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('../config');
const routes = require('./routes');
const { ensureReady } = require('../db/ensureReady');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Telegram Mini App SDK va YouTube IFrame Player API shu domenlardan yuklanadi
        'script-src': ["'self'", 'https://telegram.org', 'https://www.youtube.com'],
        // Video darslar har xil tashqi manbalardan (CDN) bo'lishi mumkin
        'media-src': ["'self'", 'https:'],
        // YouTube/Vimeo videolari <iframe> orqali ko'rsatiladi
        'frame-src': ["'self'", 'https://www.youtube.com', 'https://player.vimeo.com'],
      },
    },
  })
);
app.use(cors());
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
app.use(express.json());

// Mini App (miniapp/) shu serverdan beriladi, shunda API bilan bitta origin'da
// ishlaydi va alohida static hosting kerak bo'lmaydi.
// Telegram'ning ichki WebView'lari (ayniqsa Desktop) ba'zan Cache-Control: max-age=0'ni
// to'g'ri qayta tekshirmasdan eski main.js'ni keshdan beraveradi — shuning uchun
// bu yerda eng qattiq "no-store" ko'rsatmasini qo'yamiz.
app.use(
  express.static(path.join(__dirname, '../../miniapp'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-store');
    },
  })
);

// /api/* javoblari X-Telegram-Init-Data sarlavhasiga qarab har foydalanuvchi
// uchun boshqacha bo'ladi, URL esa bir xil — shared cache (CDN/proksi) buni
// URL bo'yicha keshlab, boshqa foydalanuvchiga eski javobni bermasligi uchun.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: "So'rov tanasi (JSON) yaroqsiz" });
  }

  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

ensureReady()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`API server listening on port ${config.port}`);
    });
  })
  .catch((err) => {
    console.error('Startup failed (migration/admin check):', err);
    process.exit(1);
  });

module.exports = app;
