const path = require("path");
const fs = require("fs");
const { PythonShell } = require("python-shell");
const summarizeWithDeepSeek = require("../services/deepseek");
const sendTwilioAlert = require("../services/twilio");
const assessSeverityWithDeepSeek = require("../services/assessSeverityWithDeepSeek");

// 引入数据库连接
const { connections } = require("../server"); // 你 server.js 最后导出的 connections
const faxDb = connections.faxDb;

const TranscriptionFax = require("../models/TranscriptionFax")(faxDb);



console.log("🚀 Script started");

    const safeClose = () => {
  return faxDb?.close?.().catch((e) => {
    console.warn("⚠️ 关闭数据库时出错：", e.message);
  });
};

function ocrFile(filePath) {
  return new Promise((resolve, reject) => {
    const { PythonShell } = require("python-shell");
    const path = require("path");

    const pyshell = new PythonShell("ocr_plain.py", {
      pythonPath: "python", // 改成你的 Python 路径（如果系统没有配置）
      scriptPath: path.join(__dirname, "../python"),
      args: [filePath],
    });

    let output = "";

    // ✅ 每次 Python 执行 print()，都会触发一次 message
    pyshell.on("message", (message) => {
      console.log("📤 Python message:", message);
      output += message + "\n";
    });

    // ⚠️ 捕获 Python stderr 错误
    pyshell.on("stderr", (stderr) => {
      console.error("🐍 Python stderr:", stderr);
    });

    // ✅ Python 脚本执行结束
    pyshell.end((err, code) => {
      if (err) {
        console.error("❌ PythonShell error:", err);
        return reject(err);
      }
      console.log("✅ Python finished with code", code);
      resolve(output.trim());
    });
  });
}

function isCheckReport(text) {
  const keywords = ["findings", "impression", "CT", "MRI", "lab", "result", 'summary', 'complaint'];
  
  return keywords.some((word) => text.toLowerCase().includes(word));
}

function extractSeverity(severityText) {  
  const scoreMatch = severityText.match(/严重程度评分[:：]?\s*[(\[]?(\d+)[)\]]?/);
  const levelMatch = severityText.match(/严重等级[:：]?\s*(轻度|中度|重度|危急)/);
  const severityMatch = severityText.match(/判定原因[:：]?\s*([^\n\r]+)/);
  return {
    severityScore: scoreMatch ? parseInt(scoreMatch[1]) : null,
    severityLevel: levelMatch ? levelMatch[1] : "Unknown",
    severityReason: severityMatch ? severityMatch[1].trim() : "Unknown",

  };
}

async function handleNewFax(filePath) {
  try {
    const ocrText = await ocrFile(filePath);

    if (!isCheckReport(ocrText)) {
      console.log("⚠️ 文件不包含检查关键词，跳过：", path.basename(filePath));
      return;
    }

    const summaryText = await summarizeWithDeepSeek(ocrText);
    console.log("摘要内容：", summaryText);
    const severityText = await assessSeverityWithDeepSeek(summaryText);
    console.log("摘要内容：", severityText);

    const { severityScore, severityLevel, severityReason} = extractSeverity(severityText);

    console.log(`📊 严重评分：${severityScore} / 等级：${severityLevel}/ 原因：${severityReason}`);

    if (severityScore >= 7) {
      await sendTwilioAlert(
        `🚨 高严重度检查报告（${severityScore}/10）\n文件名: ${path.basename(filePath)}`
      );
    }
    
    const transcriptionRecord = await TranscriptionFax.create({
      transcription: ocrText,
      summary: summaryText,
      severityScore,
      severityLevel,
      severityReason,
      fileName: path.basename(filePath),

    });



    console.log("✅ 已存入fax数据库：", path.basename(filePath));
    console.log("📄 Record ID:", transcriptionRecord._id);
    return transcriptionRecord;

  } catch (err) {
    console.error("❌ 处理文件失败：", filePath, err);
  }
}

if (require.main === module) {
  const testFile = "C:/Users/rache/catbook-react/test.pdf";
handleNewFax(testFile)
  .then((result) => {
    console.log("✅ Test completed successfully!");
    return safeClose();
  })
  .then(() => {
    console.log("🔒 数据库连接已关闭");
    console.log("🎯 程序执行完毕");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ handleNewFax 出错:", err.message || err);
    return safeClose().then(() => process.exit(1));
  });
}
  module.exports = handleNewFax