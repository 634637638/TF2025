// 启动服务器
const { startServer } = require('./src/app');

// 启动应用程序
startServer().catch(error => {
  console.error('❌ 服务器启动失败:', error);
  process.exit(1);
});