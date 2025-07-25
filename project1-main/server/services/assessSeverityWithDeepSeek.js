const axios = require("axios");
require("dotenv").config();

async function assessSeverityWithDeepSeek(summaryText) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-r1-0528:free",
        messages: [
          {
            role: "system",
            content:
              "你是一个医生助理，请根据以下病例摘要评估严重程度，返回如下格式：\n" +
              "严重程度评分：(0 - 10). 10 being the most severe" +
              "严重等级：轻度 / 中度 / 重度 / 危急\n" +
              "判定原因：\n" +
              "只输出这三行，不要输出其他内容。判定原因必须用一到两个短句概括",
          },
          {
            role: "user",
            content: summaryText,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY.trim()}`,
        },
      }
    );

    return response.data.choices?.[0]?.message?.content;
  } catch (err) {
    console.error("❌ 严重性评估失败：", err.message);
    return "严重程度评分：null\n严重等级：Unknown";
  }
}

module.exports = assessSeverityWithDeepSeek;
