/**
 * 备份服务
 * 功能：备份数据库、后端代码、上传文件
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const archiver = require('archiver');
const dbConfig = require('../config/database');
const log = require('../utils/log');

// 后端根目录
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

// 备份存储目录
const BACKUP_DIR = path.join(BACKEND_ROOT, 'backups');

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const BACKUP_FILENAME_PATTERN = /^backup_\d{8}_\d{6}\.zip$/;

const ensureBackupConfig = () => {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    throw new Error('数据库备份配置缺失，请检查 DB_HOST、DB_USER、DB_PASSWORD、DB_NAME');
  }

  return {
    host: DB_HOST,
    port: DB_PORT || 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  };
};

class BackupService {
  getBackupDir() {
    return BACKUP_DIR;
  }

  getBackendRoot() {
    return BACKEND_ROOT;
  }

  isValidBackupFilename(filename) {
    return typeof filename === 'string'
      && BACKUP_FILENAME_PATTERN.test(filename)
      && path.basename(filename) === filename;
  }

  /**
   * 清理残留的临时备份目录
   */
  cleanStaleTempBackups() {
    const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('backup_')) {
        continue;
      }

      const tempBackupPath = path.join(BACKUP_DIR, entry.name);
      const zipBackupPath = path.join(BACKUP_DIR, `${entry.name}.zip`);

      if (fs.existsSync(zipBackupPath)) {
        fs.rmSync(tempBackupPath, { recursive: true, force: true });
        log.debug(`[Backup] 已清理残留临时目录: ${entry.name}`);
      }
    }
  }

  /**
   * 获取备份时间戳
   */
  getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hour}${minute}${second}`;
  }

  /**
   * 创建完整备份
   */
  async createBackup() {
    this.cleanStaleTempBackups();

    const timestamp = this.getTimestamp();
    const backupName = `backup_${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`);

    log.debug(`[Backup] 开始创建备份: ${backupName}`);

    try {
      // 1. 创建临时备份目录
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }

      // 2. 备份数据库（优先 mysqldump，更快）
      log.debug(`[Backup] 步骤 1/3: 备份数据库...`);
      await this.backupDatabase(path.join(backupPath, 'cloudsql.sql'));

      // 3. 备份后端代码
      log.debug(`[Backup] 步骤 2/3: 备份后端代码...`);
      await this.backupBackendCode(path.join(backupPath, 'backend'));

      // 4. 备份上传文件
      log.debug(`[Backup] 步骤 3/3: 备份上传文件...`);
      await this.backupUploads(path.join(backupPath, 'uploads'));

      // 5. 创建备份清单
      await this.createManifest(backupPath, backupName);

      // 6. 压缩成 ZIP（使用更快速度）
      log.debug(`[Backup] 正在压缩...`);
      await this.compressBackup(backupPath, zipPath);

      // 7. 计算备份大小
      const stats = fs.statSync(zipPath);
      const size = this.formatFileSize(stats.size);

      // 8. 清理临时目录
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }

      const result = {
        filename: `${backupName}.zip`,
        path: zipPath,
        size: size,
        size_bytes: stats.size,
        created_at: new Date().toISOString()
      };

      log.debug(`[Backup] ✅ 备份完成: ${result.filename}, 大小: ${size}`);

      return result;
    } catch (error) {
      // 清理失败的备份
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
      if (fs.existsSync(zipPath)) {
        fs.rmSync(zipPath, { force: true });
      }
      throw error;
    }
  }

  /**
   * 备份数据库 - 优先使用 mysqldump，失败时使用程序化导出
   */
  async backupDatabase(outputPath) {
    const dbConfig = ensureBackupConfig();

    // 尝试使用 mysqldump
    try {
      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(outputPath);
        const mysqldump = spawn('mysqldump', [
          `-h${dbConfig.host}`,
          `-P${dbConfig.port}`,
          `-u${dbConfig.user}`,
          dbConfig.database,
          '--single-transaction',
          '--quick',
          '--lock-tables=false'
        ], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            MYSQL_PWD: dbConfig.password
          }
        });

        mysqldump.stdout.pipe(writeStream);
        mysqldump.stderr.on('data', (data) => {
          const message = String(data);
          if (!message.includes('Using a password')) {
            log.debug(`[mysqldump] ${message}`);
          }
        });

        mysqldump.on('error', reject);
        writeStream.on('error', reject);

        mysqldump.on('close', (code) => {
          if (code === 0) {
            log.debug('[Backup] mysqldump 数据库备份完成');
            resolve();
            return;
          }

          reject(new Error(`mysqldump 退出码: ${code}`));
        });
      });

      return;
    } catch (error) {
      log.debug(`[Backup] mysqldump 不可用，使用程序化导出: ${error.message}`);
    }

    // 备用方案：程序化导出数据库
    await this.exportDatabaseProgrammatically(outputPath, dbConfig);
  }

  /**
   * 程序化导出数据库（不依赖 mysqldump）
   */
  async exportDatabaseProgrammatically(outputPath, dbConfigData) {
    log.debug(`[Backup] 开始程序化导出数据库...`);

    const pool = dbConfig.getDatabase();
    const connection = await pool.getConnection();

    try {
      // 获取所有表
      const [tables] = await connection.execute(`SHOW TABLES`);
      const tableNames = tables.map(t => Object.values(t)[0]);

      let sqlContent = `-- 数据库备份\n`;
      sqlContent += `-- 数据库: ${dbConfigData.database}\n`;
      sqlContent += `-- 时间: ${new Date().toISOString()}\n`;
      sqlContent += `-- 表数量: ${tableNames.length}\n\n`;
      sqlContent += `SET NAMES utf8mb4;\n`;
      sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

      for (const tableName of tableNames) {
        log.debug(`[Backup] 导出表: ${tableName}`);

        // 获取表结构
        const [createTableResult] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
        const createTableSQL = createTableResult[0]['Create Table'];

        sqlContent += `-- ----------------------------\n`;
        sqlContent += `-- 表结构: ${tableName}\n`;
        sqlContent += `-- ----------------------------\n`;
        sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        sqlContent += `${createTableSQL};\n\n`;

        // 获取表数据
        const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);

        if (rows.length > 0) {
          sqlContent += `-- ----------------------------\n`;
          sqlContent += `-- 表数据: ${tableName} (${rows.length} 条)\n`;
          sqlContent += `-- ----------------------------\n`;

          for (const row of rows) {
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'number') return value;
              if (typeof value === 'boolean') return value ? 1 : 0;
              // 转义字符串中的特殊字符
              const escaped = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              return `'${escaped}'`;
            });

            sqlContent += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
          }
          sqlContent += '\n';
        }
      }

      sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;

      // 写入文件
      fs.writeFileSync(outputPath, sqlContent, 'utf8');
      log.debug(`[Backup] 程序化导出完成，共 ${tableNames.length} 张表`);

    } finally {
      connection.release();
    }
  }

  /**
   * 备份后端代码
   */
  async backupBackendCode(outputPath) {
    const backendDir = BACKEND_ROOT;
    const dirsToBackup = ['src', 'config', 'routes', 'controllers', 'services', 'repositories', 'middleware', 'database', 'scripts'];
    const filesToBackup = ['package.json', 'server.js', 'ecosystem.config.js'];

    log.debug(`[Backup] 开始备份后端代码...`);

    // 复制目录
    for (const dir of dirsToBackup) {
      const srcDir = path.join(backendDir, dir);
      const destDir = path.join(outputPath, dir);
      if (fs.existsSync(srcDir)) {
        this.copyDirectory(srcDir, destDir);
      }
    }

    // 复制文件
    for (const file of filesToBackup) {
      const srcFile = path.join(backendDir, file);
      if (fs.existsSync(srcFile)) {
        const destFile = path.join(outputPath, file);
        fs.copyFileSync(srcFile, destFile);
      }
    }

    log.debug('[Backup] 后端代码备份完成');
  }

  /**
   * 备份上传文件
   */
  async backupUploads(outputPath) {
    const uploadsDir = path.join(BACKEND_ROOT, 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      log.debug('[Backup] 上传目录不存在，跳过');
      return;
    }

    log.debug('[Backup] 开始备份上传文件...');

    // 统计文件数量
    const stats = this.getDirectoryStats(uploadsDir);
    log.debug(`[Backup] 上传文件统计: ${stats.fileCount} 个文件, ${this.formatFileSize(stats.totalSize)}`);

    this.copyDirectory(uploadsDir, outputPath, 0);
    log.debug('[Backup] 上传文件备份完成');
  }

  /**
   * 获取目录统计信息
   */
  getDirectoryStats(dir) {
    let fileCount = 0;
    let totalSize = 0;

    const walk = (dirPath) => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else {
            fileCount++;
            try {
              const stat = fs.statSync(fullPath);
              totalSize += stat.size;
            } catch (e) {
              // 忽略无法访问的文件
            }
          }
        }
      } catch (e) {
        // 忽略无法访问的目录
      }
    };

    walk(dir);
    return { fileCount, totalSize };
  }

  /**
   * 复制目录
   */
  copyDirectory(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
      return;
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(sourcePath, targetPath);
      } else if (entry.isFile()) {
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * 创建备份清单
   */
  async createManifest(backupPath, backupName) {
    const uploadsDir = path.join(BACKEND_ROOT, 'uploads');
    const uploadsStats = fs.existsSync(uploadsDir) ? this.getDirectoryStats(uploadsDir) : { fileCount: 0, totalSize: 0 };

    const manifest = {
      backup_name: backupName,
      created_at: new Date().toISOString(),
      version: '1.0.0',
      includes: {
        database: true,
        backend_code: true,
        uploads: true
      },
      stats: {
        uploads: {
          file_count: uploadsStats.fileCount,
          total_size: this.formatFileSize(uploadsStats.totalSize)
        }
      },
      server: {
        hostname: require('os').hostname(),
        platform: process.platform,
        node_version: process.version
      }
    };

    fs.writeFileSync(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  /**
   * 压缩备份文件（优化速度）
   */
  compressBackup(sourcePath, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      // 使用较低的压缩级别，大幅提升速度
      const archive = archiver('zip', { zlib: { level: 1 } }); // level 1 = 最快速度

      let fileCount = 0;
      const startTime = Date.now();

      output.on('close', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log.debug(`[Backup] 压缩完成: ${fileCount} 个文件, ${archive.pointer()} bytes, 耗时 ${elapsed}秒`);
        resolve();
      });

      archive.on('error', (err) => {
        log.error('[Backup] 压缩错误:', err);
        reject(err);
      });

      // 监听警告（非致命错误）
      archive.on('warning', (err) => {
        log.warn('[Backup] 压缩警告:', err);
      });

      archive.pipe(output);
      archive.directory(sourcePath, false);
      archive.finalize();
    });
  }

  /**
   * 获取备份列表
   */
  getBackupList() {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: this.formatFileSize(stats.size),
          size_bytes: stats.size,
          created_at: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return files;
  }

  /**
   * 获取备份文件路径
   */
  getBackupPath(filename) {
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return filePath;
  }

  /**
   * 删除备份
   */
  deleteBackup(filename) {
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('备份文件不存在');
    }
    fs.unlinkSync(filePath);
    return true;
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 自动清理旧备份（保留最近N份）
   */
  cleanOldBackups(keepCount = 5) {
    const backups = this.getBackupList();
    if (backups.length <= keepCount) {
      return { deleted: 0, message: '备份数量未超过保留数量' };
    }

    const toDelete = backups.slice(keepCount);
    let deleted = 0;

    for (const backup of toDelete) {
      try {
        this.deleteBackup(backup.filename);
        deleted++;
      } catch (error) {
        log.error(`[Backup] 删除失败: ${backup.filename}`, error);
      }
    }

    return { deleted, message: `已删除 ${deleted} 份旧备份，保留最近 ${keepCount} 份` };
  }
}

module.exports = new BackupService();
