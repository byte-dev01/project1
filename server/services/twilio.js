const { Client } = require("twilio");

// 从环境变量读取配置（推荐用 dotenv 管理）
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH;
const fromNumber = process.env.TWILIO_FROM; // 你的 Twilio 号码
const toNumber = process.env.TWILIO_TO;     // 医生或收件人号码

const client = new Client(accountSid, authToken);

/**
 * 向预设号码发送严重警报短信
 * @param {string} message - 要发送的短信内容
 * @returns {Promise}
 */
async function sendTwilioAlert(message) {
  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    });
    console.log("📤 Twilio 短信已发送:", result.sid);
    return result;
  } catch (err) {
    console.error("❌ Twilio 发送失败:", err.message);
    throw err;
  }
}

module.exports = sendTwilioAlert;
