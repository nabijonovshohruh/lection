const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('../config');
const routes = require('./routes');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Telegram Mini App SDK shu domendan yuklanadi
        'script-src': ["'self'", 'https://telegram.org'],
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
app.use(express.static(path.join(__dirname, '../../miniapp')));

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

app.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
});

module.exports = app;
