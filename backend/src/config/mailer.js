const nodemailer = require('nodemailer');

const createTransporter = () => {
  const user = (process.env.SMTP_EMAIL || 'shreejiitsolution120@gmail.com').trim();
  const pass = (process.env.SMTP_PASSWORD || 'idzetsgooccvapsn').trim();

  // If host is smtp.gmail.com or user ends with @gmail.com, use service: 'gmail' for best reliability
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  if (host.includes('gmail') || user.endsWith('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass
      }
    });
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: {
      user: user,
      pass: pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

module.exports = { createTransporter };
