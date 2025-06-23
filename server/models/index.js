const { connections } = require('../server');

const createTranscriptionModel = require('./Transcription');
const createTranscriptionFaxModel = require('./TranscriptionFax');

// 创建模型实例，连接到对应数据库
const Transcription = createTranscriptionModel(connections.faxDb);
const TranscriptionFax = createTranscriptionFaxModel(connections.faxDb);

module.exports = {
  Transcription,
  TranscriptionFax,
  connections,
};
