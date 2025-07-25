// aiPoweredMedicalAnalyzer.js
// 使用多个免费AI API协同分析医疗文档
const { GoogleGenerativeAI } = require("@google/generative-ai");

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // 设置环境变量 GEMINI_API_KEY

const axios = require('axios');


const ai = new GoogleGenAI({});

async function gemini() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Explain how AI works in a few words",
  });
  console.log(response.text);
}

class AIPoweredMedicalAnalyzer {
  constructor(config = {}) {
    // AI API配置
    this.apis = {
      deepseek: {
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: config.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY,
        model: 'deepseek/deepseek-r1-0528:free',
        name: 'DeepSeek'
      },
      gemini: {
        endpoint: '  https://www.google.com/maps/embed/v1/MAP_MODE?key=process.env.GEMINI&parameters', 
        apiKey: config.GROQ_API_KEY || process.env.GEMINI,
        model: 'gemini-2.0-flash-live-001', 
        name: 'Gemini'
      },
      openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: config.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo', // 有免费额度
        name: 'OpenAI'
      },
      // 备用：Hugging Face Inference API（完全免费）
      huggingface: {
        endpoint: 'https://api-inference.huggingface.co/models/microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract',
        apiKey: config.HF_API_KEY || process.env.HF_API_KEY,
        name: 'HuggingFace'
      }
    };

    // 分析提示词模板
    this.promptTemplate = `You are a medical document analyzer. Analyze the following medical document and provide a structured assessment.

Medical Document:
"""
{document}
"""

Please analyze and return a JSON response with:
1. severity_level: "critical", "high", "medium", or "low"
2. urgent_findings: array of critical findings that need immediate attention
3. icd_codes: array of detected ICD-10 codes
4. risk_score: 0-100 (100 being most critical)
5. key_findings: array of important medical findings
6. recommended_actions: array of recommended next steps
7. time_sensitivity: "immediate", "24_hours", "1_week", "routine"

Focus on identifying:
- Cancer/malignancy indicators (恶性肿瘤)
- Infectious diseases (TB, HIV, Hepatitis)
- Critical lab values
- Emergency conditions
- Any findings requiring immediate medical attention

Return ONLY valid JSON, no additional text.`;

    // 基础关键词检测（作为后备）
    this.criticalKeywords = {
      cancer: ['malignant', 'cancer', 'carcinoma', 'melanoma', 'lymphoma', '恶性', '癌', '肿瘤'],
      infectious: ['TB positive', 'tuberculosis', 'HIV positive', 'hepatitis', '结核阳性', '艾滋病阳性'],
      emergency: ['critical', 'urgent', 'emergency', 'immediate', '危急', '紧急']
    };
  }

  /**
   * 使用多个AI分析医疗文档
   */
  async analyzeMedicalDocument(documentText, metadata = {}) {
    console.log('🤖 Starting multi-AI analysis...');
    
    const analysisResults = {
      documentId: metadata.documentId || `DOC-${Date.now()}`,
      timestamp: new Date(),
      aiAnalysis: [],
      consensus: null,
      finalDecision: null,
      confidence: 0
    };

    // 1. 并行调用多个AI API
    const aiPromises = [];
    
    // DeepSeek分析
    if (this.apis.deepseek.apiKey) {
      aiPromises.push(this.analyzeWithDeepSeek(documentText));
    }
    
    // Groq分析
    if (this.apis.groq.apiKey) {
      aiPromises.push(this.analyzeWithGroq(documentText));
    }
    
    // OpenAI分析（如果有免费额度）
    if (this.apis.openai.apiKey) {
      aiPromises.push(this.analyzeWithOpenAI(documentText));
    }

    // 等待所有AI分析完成
    const results = await Promise.allSettled(aiPromises);
    
    // 2. 收集成功的分析结果
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        analysisResults.aiAnalysis.push(result.value);
      } else if (result.status === 'rejected') {
        console.error(`❌ AI analysis failed:`, result.reason);
      }
    });

    // 3. 如果AI分析都失败，使用基础关键词检测
    if (analysisResults.aiAnalysis.length === 0) {
      console.log('⚠️ All AI APIs failed, falling back to keyword detection');
      const basicAnalysis = this.performBasicAnalysis(documentText);
      analysisResults.aiAnalysis.push(basicAnalysis);
    }

    // 4. 综合多个AI的分析结果
    analysisResults.consensus = this.buildConsensus(analysisResults.aiAnalysis);
    
    // 5. 做出最终决策
    analysisResults.finalDecision = this.makeFinalDecision(analysisResults.consensus);
    
    // 6. 计算置信度
    analysisResults.confidence = this.calculateConfidence(analysisResults);

    console.log('✅ Analysis complete:', {
      severity: analysisResults.finalDecision.severity,
      confidence: `${analysisResults.confidence}%`,
      aiCount: analysisResults.aiAnalysis.length
    });

    return analysisResults;
  }

  /**
   * DeepSeek API调用
   */
  async analyzeWithDeepSeek(documentText) {
    try {
      const response = await axios.post(
        this.apis.deepseek.endpoint,
        {
          model: this.apis.deepseek.model,
          messages: [
            {
              role: 'system',
              content: 'You are a medical document analyzer. Always respond in valid JSON format.'
            },
            {
              role: 'user',
              content: this.promptTemplate.replace('{document}', documentText)
            }
          ],
          temperature: 0.1, // 低温度提高一致性
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apis.deepseek.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      const analysis = JSON.parse(content);
      
      return {
        source: 'DeepSeek',
        analysis: analysis,
        raw: content
      };
    } catch (error) {
      console.error('DeepSeek API error:', error.message);
      throw error;
    }
  }

  /**
   * Groq API调用（超快速度）
   */
  async analyzeWithGroq(documentText) {
    try {
      const response = await axios.post(
        this.apis.groq.endpoint,
        {
          model: this.apis.groq.model,
          messages: [
            {
              role: 'system',
              content: 'You are a medical document analyzer. Always respond in valid JSON format.'
            },
            {
              role: 'user',
              content: this.promptTemplate.replace('{document}', documentText)
            }
          ],
          temperature: 0.1,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apis.groq.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      const analysis = JSON.parse(content);
      
      return {
        source: 'Groq',
        analysis: analysis,
        raw: content
      };
    } catch (error) {
      console.error('Groq API error:', error.message);
      throw error;
    }
  }

  /**
   * OpenAI API调用
   */
  async analyzeWithOpenAI(documentText) {
    try {
      const response = await axios.post(
        this.apis.openai.endpoint,
        {
          model: this.apis.openai.model,
          messages: [
            {
              role: 'system',
              content: 'You are a medical document analyzer. Always respond in valid JSON format.'
            },
            {
              role: 'user',
              content: this.promptTemplate.replace('{document}', documentText)
            }
          ],
          temperature: 0.1,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apis.openai.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      const analysis = JSON.parse(content);
      
      return {
        source: 'OpenAI',
        analysis: analysis,
        raw: content
      };
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      throw error;
    }
  }

  /**
   * 基础关键词分析（后备方案）
   */
  performBasicAnalysis(documentText) {
    const text = documentText.toLowerCase();
    const findings = [];
    let riskScore = 0;
    
    // 检查关键词
    Object.entries(this.criticalKeywords).forEach(([category, keywords]) => {
      keywords.forEach(keyword => {
        if (text.includes(keyword.toLowerCase())) {
          findings.push(keyword);
          riskScore += category === 'cancer' ? 40 : category === 'infectious' ? 30 : 20;
        }
      });
    });

    // 检查ICD-10代码
    const icdPattern = /[A-Z]\d{2}\.?\d*/g;
    const icdCodes = documentText.match(icdPattern) || [];
    
    // 恶性肿瘤ICD代码 C00-C99
    const cancerCodes = icdCodes.filter(code => code.startsWith('C'));
    if (cancerCodes.length > 0) {
      riskScore += 50;
    }

    const severity = riskScore >= 70 ? 'critical' : 
                    riskScore >= 40 ? 'high' : 
                    riskScore >= 20 ? 'medium' : 'low';

    return {
      source: 'BasicAnalyzer',
      analysis: {
        severity_level: severity,
        urgent_findings: findings,
        icd_codes: icdCodes,
        risk_score: Math.min(riskScore, 100),
        key_findings: findings,
        recommended_actions: severity === 'critical' ? 
          ['Immediate patient contact required', 'Notify attending physician'] : 
          ['Schedule follow-up appointment'],
        time_sensitivity: severity === 'critical' ? 'immediate' : '24_hours'
      }
    };
  }

  /**
   * 构建AI共识
   */
  buildConsensus(aiAnalyses) {
    if (aiAnalyses.length === 0) return null;
    if (aiAnalyses.length === 1) return aiAnalyses[0].analysis;

    const consensus = {
      severity_level: this.getMostCommonSeverity(aiAnalyses),
      urgent_findings: this.mergeFindings(aiAnalyses, 'urgent_findings'),
      icd_codes: this.mergeFindings(aiAnalyses, 'icd_codes'),
      risk_score: this.getAverageRiskScore(aiAnalyses),
      key_findings: this.mergeFindings(aiAnalyses, 'key_findings'),
      recommended_actions: this.mergeFindings(aiAnalyses, 'recommended_actions'),
      time_sensitivity: this.getMostUrgentTimeSensitivity(aiAnalyses)
    };

    return consensus;
  }

  /**
   * 获取最常见的严重程度
   */
  getMostCommonSeverity(analyses) {
    const severityVotes = {};
    analyses.forEach(({ analysis }) => {
      const severity = analysis.severity_level;
      severityVotes[severity] = (severityVotes[severity] || 0) + 1;
    });
    
    // 如果有任何AI判定为critical，直接返回critical
    if (severityVotes['critical'] > 0) return 'critical';
    
    // 否则返回票数最多的
    return Object.entries(severityVotes)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  /**
   * 合并发现
   */
  mergeFindings(analyses, field) {
    const allFindings = new Set();
    analyses.forEach(({ analysis }) => {
      if (Array.isArray(analysis[field])) {
        analysis[field].forEach(finding => allFindings.add(finding));
      }
    });
    return Array.from(allFindings);
  }

  /**
   * 计算平均风险分数
   */
  getAverageRiskScore(analyses) {
    const scores = analyses.map(({ analysis }) => analysis.risk_score || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg);
  }

  /**
   * 获取最紧急的时间敏感度
   */
  getMostUrgentTimeSensitivity(analyses) {
    const priorities = ['immediate', '24_hours', '1_week', 'routine'];
    let mostUrgent = 'routine';
    
    analyses.forEach(({ analysis }) => {
      const current = analysis.time_sensitivity;
      if (priorities.indexOf(current) < priorities.indexOf(mostUrgent)) {
        mostUrgent = current;
      }
    });
    
    return mostUrgent;
  }

  /**
   * 做出最终决策
   */
  makeFinalDecision(consensus) {
    if (!consensus) {
      return {
        severity: 'unknown',
        action: 'manual_review',
        notification: false
      };
    }

    return {
      severity: consensus.severity_level,
      action: this.determineAction(consensus),
      notification: consensus.severity_level === 'critical' || consensus.severity_level === 'high',
      findings: consensus.urgent_findings,
      icdCodes: consensus.icd_codes,
      riskScore: consensus.risk_score,
      timeSensitivity: consensus.time_sensitivity,
      recommendations: consensus.recommended_actions
    };
  }

  /**
   * 确定行动方案
   */
  determineAction(consensus) {
    switch (consensus.severity_level) {
      case 'critical':
        return 'immediate_notification_all_channels';
      case 'high':
        return 'urgent_notification';
      case 'medium':
        return 'schedule_followup';
      default:
        return 'routine_filing';
    }
  }

  /**
   * 计算分析置信度
   */
  calculateConfidence(results) {
    const { aiAnalysis, consensus } = results;
    
    // 基础置信度基于AI数量
    let confidence = aiAnalysis.length * 25;
    
    // 如果所有AI都同意严重程度，增加置信度
    if (aiAnalysis.length > 1) {
      const severities = aiAnalysis.map(a => a.analysis.severity_level);
      const allAgree = severities.every(s => s === severities[0]);
      if (allAgree) confidence += 20;
    }
    
    // 如果风险分数一致，增加置信度
    if (consensus) {
      const scores = aiAnalysis.map(a => a.analysis.risk_score);
      const avgDeviation = this.calculateDeviation(scores);
      if (avgDeviation < 10) confidence += 15;
    }
    
    return Math.min(confidence, 95);
  }

  /**
   * 计算标准差
   */
  calculateDeviation(numbers) {
    const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / numbers.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * 批量分析文档
   */
  async batchAnalyze(documents, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5;
    
    console.log(`📦 Batch analyzing ${documents.length} documents...`);
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      const batchPromises = batch.map(doc => 
        this.analyzeMedicalDocument(doc.text, {
          documentId: doc.id,
          patientId: doc.patientId
        })
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({
            ...batch[index],
            analysis: result.value
          });
        } else {
          console.error(`Failed to analyze document ${batch[index].id}:`, result.reason);
        }
      });
      
      // 避免API限流
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 生成批量分析报告
    const report = this.generateBatchReport(results);
    
    return {
      results,
      report
    };
  }

  /**
   * 生成批量分析报告
   */
  generateBatchReport(results) {
    const report = {
      totalAnalyzed: results.length,
      criticalCount: 0,
      highCount: 0,
      averageConfidence: 0,
      urgentCases: [],
      byAISource: {}
    };
    
    let totalConfidence = 0;
    
    results.forEach(result => {
      const decision = result.analysis.finalDecision;
      
      if (decision.severity === 'critical') {
        report.criticalCount++;
        report.urgentCases.push({
          documentId: result.id,
          patientId: result.patientId,
          severity: decision.severity,
          findings: decision.findings,
          riskScore: decision.riskScore
        });
      } else if (decision.severity === 'high') {
        report.highCount++;
      }
      
      totalConfidence += result.analysis.confidence;
      
      // 统计每个AI的使用情况
      result.analysis.aiAnalysis.forEach(ai => {
        report.byAISource[ai.source] = (report.byAISource[ai.source] || 0) + 1;
      });
    });
    
    report.averageConfidence = Math.round(totalConfidence / results.length);
    
    return report;
  }
}

// 导出模块
module.exports = AIPoweredMedicalAnalyzer;

// 使用示例
if (require.main === module) {
  const analyzer = new AIPoweredMedicalAnalyzer({
    DEEPSEEK_API_KEY: 'your-deepseek-key',
    GROQ_API_KEY: 'your-groq-key'
  });
  
  const testDocument = `
    Patient Name: John Doe
    DOB: 01/01/1980
    
    FINDINGS:
    CT scan reveals a 3cm mass in the right upper lobe of the lung.
    The mass shows irregular borders and enhancement pattern suggestive of malignancy.
    Multiple enlarged mediastinal lymph nodes noted.
    
    IMPRESSION:
    Findings highly suspicious for primary lung malignancy with lymph node involvement.
    Recommend immediate oncology referral and PET scan for staging.
    
    ICD-10: C78.00
  `;
  
  analyzer.analyzeMedicalDocument(testDocument)
    .then(result => {
      console.log('\n📋 Analysis Result:');
      console.log('Severity:', result.finalDecision.severity);
      console.log('Risk Score:', result.finalDecision.riskScore);
      console.log('Confidence:', result.confidence + '%');
      console.log('Action Required:', result.finalDecision.action);
      console.log('AI Sources Used:', result.aiAnalysis.map(a => a.source).join(', '));
    })
    .catch(error => {
      console.error('Analysis failed:', error);
    });
}
