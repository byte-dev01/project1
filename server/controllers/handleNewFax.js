const path = require("path");
const fs = require("fs");
const tesseract = require("./python/ocr.py");
const summarizeWithDeepSeek = require("./utils/deepseek");
const sendTwilioAlert = require("./utils/twilio");
const Transcription = require("./models/Transcription");

async function ocrFile(filePath) {
  console.log("📑 OCR 开始：", path.basename(filePath));
  const { data: { text } } = await tesseract.recognize(filePath, "eng");
  return text;
}

function isCheckReport(text) {
  const keywords = ["findings", "impression", "CT", "MRI", "lab test", "result"];
  return keywords.some(word => text.toLowerCase().includes(word));
}

function extractSeverity(summaryText) {
  const scoreMatch = summaryText.match(/严重程度评分[:：]?\s*(\d+)/);
  const levelMatch = summaryText.match(/严重等级[:：]?\s*(\w+)/);

  return {
    severityScore: scoreMatch ? parseInt(scoreMatch[1]) : null,
    severityLevel: levelMatch ? levelMatch[1] : "Unknown",
  };
}

async function handleNewFax(filePath) {
  try {
    // Step 1: OCR
    const ocrText = await ocrFile(filePath);

    // Step 2: 判断是否为检查报告
    if (!isCheckReport(ocrText)) {
      console.log("⚠️ 文件不包含检查关键词，跳过：", path.basename(filePath));
      return;
    }

    // Step 3: 调用 LLM 获取总结与严重程度
    const summaryText = await summarizeWithDeepSeek(ocrText);
    const { severityScore, severityLevel } = extractSeverity(summaryText);

    console.log(`📊 严重评分：${severityScore} / 等级：${severityLevel}`);

    // Step 4: 严重则通知
    if (severityScore >= 7) {
      await sendTwilioAlert(
        `🚨 高严重度检查报告（${severityScore}/10）\n文件名: ${path.basename(filePath)}`
      );
    }

    // Step 5: 存入数据库
    await Transcription.create({
      transcription: ocrText,
      summary: summaryText,
      severityScore,
      severityLevel,
    });

    console.log("✅ 已存入数据库：", path.basename(filePath));
  } catch (err) {
    console.error("❌ 处理文件失败：", filePath, err);
  }
}

module.exports = handleNewFax;
