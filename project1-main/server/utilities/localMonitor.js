const chokidar = require("chokidar");
const path = require("path");

// 引入你写好的处理函数
const handleNewFax = require("../controllers/handleNewFax");

const watchFolder = "C:/incoming_faxes"; // ⚠️ 改成你自己的传真接收文件夹路径

// 初始化 watcher
const watcher = chokidar.watch(watchFolder, {
  ignored: /^\./,              // 忽略隐藏文件
  persistent: true,            // 保持监听状态
  ignoreInitial: true,         // 不处理现有文件，仅监听新增文件
  awaitWriteFinish: {
    stabilityThreshold: 2000,  // 等待写入稳定后再处理，防止半写文件
    pollInterval: 100
  }
});

watcher
  .on("add", (filePath) => {
    console.log("📂 新文件已加入:", path.basename(filePath));
    handleNewFax(filePath); // 🔁 执行你写的处理逻辑
  })
  .on("error", (error) => {
    console.error("❌ 监听文件夹出错:", error);
  });

console.log("📡 正在监听文件夹：", watchFolder);
