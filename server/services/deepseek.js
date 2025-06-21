const axios = require("axios");

/**
 * 调用 DeepSeek 模型生成结构化医学摘要
 * @param {string} text - 输入的医疗记录原文
 * @returns {Promise<string>} - 返回结构化摘要（包含主诉、用药、转诊等）
 */
async function summarizeWithDeepSeek(text) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-r1-0528:free",
        messages: [
          {
            role: "system",
            content:
              "你是一个医学记录帮手，请从对话中提取以下信息并用以下格式返回（不要添加其他内容）：\n\n" +
              "### 病人主诉 (Patient Complaints)\n...\n" +
              "### 医生用药 (Doctor's Medication)\n...\n" +
              "### 转诊安排 (Referral Follow-up)\n...\n" +
              "#### 医生安排 (Doctor's Plan)\n...\n" +
              "##### 总结 (Summary)\n...",
          },
          {
            role: "user",
            content: text,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
      }
    );

    return response.data.choices?.[0]?.message?.content;
  } catch (error) {
    console.error("❌ DeepSeek 调用失败:", error.message);
    throw error;
  }
}

module.exports = summarizeWithDeepSeek;