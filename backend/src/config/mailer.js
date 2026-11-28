
const nodemailer = require('nodemailer');

let transporter = null;

const createTransporter = () => {
    // Reuse existing transporter
    if (transporter) {
        return transporter;
    }

    const user = process.env.SMTP_EMAIL?.trim();
    const pass = process.env.SMTP_PASSWORD?.replace(/\s/g, '');
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';

    if (!user || !pass) {
        throw new Error(
            'SMTP_EMAIL or SMTP_PASSWORD is missing in environment variables.'
        );
    }

    // Gmail SMTP configuration
    if (
        host.includes('gmail.com') ||
        user.endsWith('@gmail.com')
    ) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass
            }
        });

        return transporter;
    }

    // Other SMTP providers
    const port = Number(process.env.SMTP_PORT || 587);

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass
        }
    });

    return transporter;
};

module.exports = { createTransporter };
