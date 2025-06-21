const axios = require("axios");
const fs = require("fs");
const Transcription = require("./models/Transcription");

// Add your DeepSeek function directly in this file
async function summarizeWithDeepSeek(text) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-r1-0528:free",
      messages: [
        {
          role: "system",
          content: "这里是一些医学报告的文件，把它们根据紧急程度分类（恶性、良性异常、正常），回归患者名字，生日，紧急程度，疾病名字，不需要多余的话，只用这四条",
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
    // Your existing transcription logic here
    // ... (speech-to-text processing)
    
    // Let's say you get the transcribed text like this:
    const transcribedText = "your transcribed text from audio processing";
    
    // Generate medical summary using DeepSeek
    let summary = null;
    try {
      summary = await summarizeWithDeepSeek(transcribedText);
      console.log("Summary generated successfully");
    } catch (summaryError) {
      console.error("Summary generation failed:", summaryError);
      // Continue without summary rather than failing the whole request
    }
    
    // Clean up the uploaded file
   
    try {
  const newEntry = new Transcription({
    transcription: transcribedText,
    summary: summary,
  });
  await newEntry.save();
  console.log("Saved transcription to MongoDB");
} catch (dbError) {
  console.error("Failed to save transcription:", dbError);
}
 if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // Return both transcription and summary
    res.json({
      success: true,
      transcription: transcribedText,
      summary: summary,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // Clean up file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.error("Transcription error:", error);
    throw error; // Re-throw to be handled by the calling code
  }
}

module.exports = handleTranscribeData;
