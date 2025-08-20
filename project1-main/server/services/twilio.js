const twilio = require("twilio");

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH;
const fromNumber = process.env.TWILIO_FROM;

const client = twilio(accountSid, authToken);

/**
 * 向指定号码发送短信
 * @param {string} message - 短信内容
 * @param {string} toNumber - 接收人号码（默认使用环境变量）
 */
async function sendTwilioAlert(message, toNumber = process.env.TWILIO_TO) {
  try {
    const msg = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    });
    console.log("✅ 短信已发送:", msg.sid);
  } catch (err) {
    console.error("❌ Twilio 发送失败:", err.message);
  }
}

module.exports = sendTwilioAlert;
