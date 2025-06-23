require("dotenv").config()
const fs = require("fs");
const axios = require("axios");
const patientDb = require("../dbConnection");
const Transcription = require("../models/Transcription"); // adjust path as needed

// Add your DeepSeek function directly here
async function summarizeWithDeepSeek(text) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-r1-0528:free",
      messages: [
        {
          role: "system",
          content: "你是一个医学记录帮手，请从对话中提取以下信息并用以下格式返回（不要添加其他内容）：\n\n### 病人主诉 (Patient Complaints)\n...\n### 医生用药 (Doctor's Medication)\n...\n### 转诊安排 (Referral Follow-up)\n...\n#### 医生安排 (Doctor's Plan)\n...\n##### 总结 (Summary)\n..."
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
}

async function handleTranscribeData(filePath, res) {
  try {
    // ✅ Add the missing Deepgram API call
    const deepgramResponse = await axios.post(
      "https://api.deepgram.com/v1/listen",
      fs.createReadStream(filePath),
      {
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "audio/wav", // adjust based on your audio format
        },
        params: {
          model: "nova-2",
          language: "en-US", // adjust as needed
          smart_format: true,
        },
      }
    );

    const transcribedText =
      deepgramResponse.data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    let summary = null;
    try {
      summary = await summarizeWithDeepSeek(transcribedText);
      console.log("Summary generated successfully");
    } catch (summaryError) {
      console.error("Summary generation failed:", summaryError);
    }

    // ✅ Save to MongoDB
    try {
      const entry = new Transcription({
        transcription: transcribedText,
        summary: summary,
      });
      await entry.save();
      console.log("Saved to MongoDB");
    } catch (mongoErr) {
      console.error("MongoDB insert error:", mongoErr);
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      success: true,
      transcription: transcribedText,
      summary: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    console.error("Transcription error:", error);
    throw error;
  }
}

module.exports = handleTranscribeData;