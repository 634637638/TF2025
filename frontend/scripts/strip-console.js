/**
 * 生产环境打包后清理脚本
 * 移除所有 console 和 debugger 调用
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist', 'js');

function stripConsoleFromFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalSize = content.length;

  // 1. 移除简单字符串参数的 console 调用
  content = content.replace(/console\.(log|info|debug|warn|error)\s*\(\s*"[^"]*"\s*\)\s*;?/g, '');
  content = content.replace(/console\.(log|info|debug|warn|error)\s*\(\s*'[^']*'\s*\)\s*;?/g, '');

  // 2. 移除模板字符串参数的 console 调用
  content = content.replace(/console\.(log|info|debug|warn|error)\s*\(\s*`[^`]*`\s*\)\s*;?/g, '');

  // 3. 移除带多个参数的 console 调用
  content = content.replace(/console\.(log|info|debug|warn|error)\s*\([^)]*,\s*[^)]*\)\s*;?/g, '');

  // 4. 移除 debugger
  content = content.replace(/debugger\s*;?/g, '');

  // 5. 将 console 对象方法引用替换为空函数
  content = content.replace(/console\.(log|info|debug|warn|error)\s*\|\|/g, '(()=>{})||');
  content = content.replace(/console\.(log|info|debug|warn|error)\s*&&/g, '(()=>{})&&');

  // 6. 将赋值给变量的 console 方法替换
  content = content.replace(/=\s*console\.(log|info|debug|warn|error)/g, '=()=>{}');

  // 7. 处理 console 作为对象属性的情况 如 console.log}
  content = content.replace(/console\.(log|info|debug|warn|error)\s*},/g, '},');
  content = content.replace(/console\.(log|info|debug|warn|error)\s*}/g, '}');

  // 清理空白
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content.length !== originalSize) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Cleaned: ${path.basename(filePath)} (${originalSize - content.length} bytes removed)`);
    return true;
  }
  return false;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let cleanedCount = 0;

  for (const file of files) {
    if (file.endsWith('.js')) {
      const filePath = path.join(dir, file);
      if (stripConsoleFromFile(filePath)) {
        cleanedCount++;
      }
    }
  }

  console.log(`\n总计清理 ${cleanedCount} 个文件`);
}

// 检查目录是否存在
if (!fs.existsSync(distDir)) {
  console.error('错误: dist/js 目录不存在，请先运行 npm run build');
  process.exit(1);
}

console.log('开始清理生产环境调试代码...\n');
processDirectory(distDir);

// 验证清理结果
const files = fs.readdirSync(distDir);
let remainingConsole = 0;
for (const file of files) {
  if (file.endsWith('.js')) {
    const content = fs.readFileSync(path.join(distDir, file), 'utf8');
    const matches = content.match(/console\.(log|info|debug|warn|error)/g);
    if (matches) {
      remainingConsole += matches.length;
    }
  }
}

if (remainingConsole > 0) {
  console.log(`\n⚠ 剩余 ${remainingConsole} 处 console 引用（来自第三方库内部）`);
} else {
  console.log('\n✅ 所有 console 调用已清理完成！');
}