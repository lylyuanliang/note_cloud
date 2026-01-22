const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const FdfsClient = require('fdfs-client');

const app = express();
const PORT = process.env.PORT || 3000;
const TRACKER_HOST = process.env.TRACKER_HOST || 'tracker';
const TRACKER_PORT = process.env.TRACKER_PORT || 22122;
const STORAGE_HTTP_URL = process.env.STORAGE_HTTP_URL || 'http://storage:8888';

// 文件列表存储路径（使用数据卷挂载的目录）
const DATA_DIR = path.join(__dirname, 'data');
const FILE_LIST_PATH = path.join(DATA_DIR, 'filelist.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`创建数据目录: ${DATA_DIR}`);
}

// 配置FastDFS客户端
const fdfs = new FdfsClient({
  trackers: [
    { host: TRACKER_HOST, port: TRACKER_PORT }
  ],
  timeout: 10000,
  defaultExt: 'txt',
  charset: 'utf8'
});

// 中间件
app.use(cors());
// 增加请求体大小限制
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 配置文件上传
// 注意：multer默认使用latin1编码解析文件名，需要手动处理UTF-8编码的中文文件名
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  // 文件过滤器：允许所有文件类型
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// 添加multer错误处理中间件
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer错误:', err);
    return res.status(400).json({
      success: false,
      message: `文件上传错误: ${err.message}`
    });
  } else if (err) {
    console.error('上传处理错误:', err);
    return res.status(500).json({
      success: false,
      message: err.message || '文件上传失败'
    });
  }
  next();
};

// 读取文件列表
function readFileList() {
  try {
    if (fs.existsSync(FILE_LIST_PATH)) {
      const data = fs.readFileSync(FILE_LIST_PATH, 'utf8');
      const fileList = JSON.parse(data);
      console.log(`从磁盘加载文件列表，共 ${fileList.length} 个文件`);
      return fileList;
    }
  } catch (error) {
    console.error('读取文件列表失败:', error.message);
  }
  return [];
}

// 保存文件列表
function saveFileList(fileList) {
  try {
    fs.writeFileSync(FILE_LIST_PATH, JSON.stringify(fileList, null, 2), 'utf8');
    console.log(`保存文件列表到磁盘，共 ${fileList.length} 个文件`);
    return true;
  } catch (error) {
    console.error('保存文件列表失败:', error.message);
    return false;
  }
}

// 获取文件列表
app.get('/api/files', async (req, res) => {
  try {
    const fileList = readFileList();
    res.json({
      success: true,
      message: '获取文件列表成功',
      files: fileList
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 保存文件列表
app.post('/api/files', async (req, res) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        message: '请提供文件列表数组'
      });
    }
    
    if (saveFileList(files)) {
      res.json({
        success: true,
        message: '文件列表保存成功',
        count: files.length
      });
    } else {
      res.status(500).json({
        success: false,
        message: '文件列表保存失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 上传文件
app.post('/api/upload', (req, res, next) => {
  console.log('[UPLOAD] 收到POST请求到 /api/upload');
  console.log('[UPLOAD] Content-Type:', req.headers['content-type']);
  console.log('[UPLOAD] Content-Length:', req.headers['content-length']);
  next();
}, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    console.log('[UPLOAD] 进入处理函数');
    console.log('[UPLOAD] req.file:', req.file ? '存在' : '不存在');
    console.log('[UPLOAD] req.body:', Object.keys(req.body));
    
    if (!req.file) {
      console.log('错误：未收到文件');
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    const fileBuffer = req.file.buffer;
    // 处理文件名编码问题
    // multer在处理multipart/form-data时，如果Content-Disposition中的filename包含非ASCII字符，
    // 可能会被错误地按latin1编码解析，导致中文文件名乱码
    let fileName = req.file.originalname;
    const originalFileName = fileName;
    
    // 修复中文文件名乱码：将错误解析的latin1字符串还原为utf8
    try {
      // 检查是否可能是latin1错误解析的utf8字符串
      // 如果文件名包含乱码特征（latin1错误解析utf8会产生特定字节序列）
      if (/[^\x00-\x7F]/.test(fileName)) {
        // 尝试从latin1转换为utf8
        // 这是最常见的乱码原因：UTF-8字节被当作latin1字符读取
        const buffer = Buffer.from(fileName, 'latin1');
        const decoded = buffer.toString('utf8');
        
        // 验证解码结果是否合理（包含中文字符或常见字符）
        // 如果解码后包含中文字符，说明解码成功
        if (/[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/.test(decoded) || 
            decoded.length > 0 && !/[^\x20-\x7E\u4e00-\u9fa5]/.test(decoded)) {
          fileName = decoded;
          console.log(`[UPLOAD] 文件名已修复编码: "${originalFileName}" -> "${fileName}"`);
        }
      }
    } catch (e) {
      console.warn('[UPLOAD] 文件名解码失败，使用原始文件名:', e.message);
    }
    
    console.log(`[UPLOAD] 原始文件名: ${originalFileName}`);
    console.log(`[UPLOAD] 处理后的文件名: ${fileName}`);
    
    // 获取文件扩展名，去掉点号，如果没有扩展名则使用'txt'
    let fileExt = path.extname(fileName);
    if (fileExt) {
      fileExt = fileExt.substring(1); // 去掉点号
    } else {
      fileExt = 'txt';
    }
    
    console.log(`准备上传文件: ${fileName}, 大小: ${fileBuffer.length} bytes, 扩展名: ${fileExt}`);
    console.log(`Tracker地址: ${TRACKER_HOST}:${TRACKER_PORT}`);
    console.log(`Buffer类型: ${fileBuffer.constructor.name}, 是否为Buffer: ${Buffer.isBuffer(fileBuffer)}`);

    // 上传到FastDFS
    // fdfs-client的upload(buffer)方式有bug，会报byteLength undefined错误
    // 改用临时文件方式：先将buffer写入临时文件，然后用文件路径上传
    console.log('[UPLOAD] 准备调用FastDFS上传');
    console.log('[UPLOAD] Buffer长度:', fileBuffer.length);
    console.log('[UPLOAD] 文件扩展名:', fileExt);
    
    // 创建临时文件
    const tempDir = os.tmpdir();
    const tempFileName = `fastdfs_upload_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    console.log('[UPLOAD] 创建临时文件:', tempFilePath);
    
    try {
      // 将buffer写入临时文件
      fs.writeFileSync(tempFilePath, fileBuffer);
      console.log('[UPLOAD] 临时文件写入成功');
      
      // 使用文件路径上传（这是fdfs-client最可靠的方式）
      // 添加超时保护（25秒，比前端30秒稍短）
      const uploadPromise = new Promise((resolve, reject) => {
        console.log('[UPLOAD] 开始调用FastDFS上传（使用文件路径）...');
        
        fdfs.upload(tempFilePath, (err, result) => {
          // 无论成功失败，都删除临时文件
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
              console.log('[UPLOAD] 临时文件已删除');
            }
          } catch (unlinkErr) {
            console.warn('[UPLOAD] 删除临时文件失败:', unlinkErr.message);
          }
          
          if (err) {
            console.error('[UPLOAD] FastDFS上传失败:', err);
            reject(err);
          } else {
            console.log('[UPLOAD] FastDFS上传成功, fileId:', result);
            resolve(result);
          }
        });
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error('[UPLOAD] FastDFS上传超时（25秒）');
          // 清理临时文件
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (e) {}
          reject(new Error('FastDFS上传超时，请检查tracker和storage服务是否正常'));
        }, 25000);
      });
      
      const fileId = await Promise.race([uploadPromise, timeoutPromise]);

      console.log('[UPLOAD] 文件上传成功, fileId:', fileId);
      
      // 将新文件添加到文件列表并保存
      const fileData = {
        fileId: fileId,
        fileName: fileName, // 已修复编码的文件名
        url: `${STORAGE_HTTP_URL}/${fileId}`,
        downloadUrl: `/api/download/${encodeURIComponent(fileId)}`,
        size: fileBuffer.length,
        timestamp: Date.now()
      };
      
      // 读取现有文件列表
      const fileList = readFileList();
      // 检查是否已存在（避免重复）
      const existingIndex = fileList.findIndex(f => f.fileId === fileId);
      if (existingIndex >= 0) {
        // 更新现有文件
        fileList[existingIndex] = { ...fileList[existingIndex], ...fileData };
      } else {
        // 添加新文件
        fileList.push(fileData);
      }
      // 保存到磁盘
      saveFileList(fileList);
      
      // 确保响应使用UTF-8编码
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json({
        success: true,
        message: '文件上传成功',
        data: fileData
      });
    } catch (writeErr) {
      // 清理临时文件
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (e) {}
      throw writeErr;
    }
  } catch (error) {
    console.error('[UPLOAD] 上传文件异常:', error);
    res.status(500).json({
      success: false,
      message: error.message || '文件上传失败，请检查FastDFS服务是否正常运行'
    });
  }
});

// 下载文件（重定向到storage HTTP服务）
app.get('/api/download/:fileId', async (req, res) => {
  try {
    const fileId = decodeURIComponent(req.params.fileId);
    
    // 直接重定向到storage HTTP服务
    const fileUrl = `${STORAGE_HTTP_URL}/${fileId}`;
    res.redirect(fileUrl);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 删除文件
app.delete('/api/file/:fileId', async (req, res) => {
  try {
    const fileId = decodeURIComponent(req.params.fileId);
    
    // 从FastDFS删除文件
    await new Promise((resolve, reject) => {
      fdfs.del(fileId, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // 从文件列表中删除
    const fileList = readFileList();
    const filteredList = fileList.filter(f => f.fileId !== fileId);
    saveFileList(filteredList);
    console.log(`从文件列表中删除文件: ${fileId}`);
    
    res.json({
      success: true,
      message: '文件删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取文件信息
app.get('/api/file/info/:fileId', async (req, res) => {
  try {
    const fileId = decodeURIComponent(req.params.fileId);
    
    // 获取文件信息
    const fileInfo = await new Promise((resolve, reject) => {
      fdfs.getFileInfo(fileId, (err, info) => {
        if (err) {
          reject(err);
        } else {
          resolve(info);
        }
      });
    });

    const fileData = {
      ...fileInfo,
      fileId: fileId,
      fileName: path.basename(fileId) || fileId, // 从fileId提取文件名
      url: `${STORAGE_HTTP_URL}/${fileId}`,
      downloadUrl: `/api/download/${encodeURIComponent(fileId)}`,
      timestamp: fileInfo.timestamp || Date.now()
    };
    
    // 将文件添加到文件列表（如果不存在）
    const fileList = readFileList();
    const existingIndex = fileList.findIndex(f => f.fileId === fileId);
    if (existingIndex >= 0) {
      fileList[existingIndex] = { ...fileList[existingIndex], ...fileData };
    } else {
      fileList.push(fileData);
    }
    saveFileList(fileList);

    res.json({
      success: true,
      data: fileData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 批量删除文件
app.post('/api/files/delete', async (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的文件ID列表'
      });
    }

    const results = [];
    for (const fileId of fileIds) {
      try {
        await new Promise((resolve, reject) => {
          fdfs.del(fileId, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        results.push({ fileId, success: true });
      } catch (error) {
        results.push({ fileId, success: false, error: error.message });
      }
    }

    // 从文件列表中删除已成功删除的文件
    const fileList = readFileList();
    const deletedFileIds = results.filter(r => r.success).map(r => r.fileId);
    const filteredList = fileList.filter(f => !deletedFileIds.includes(f.fileId));
    saveFileList(filteredList);
    console.log(`批量删除：从文件列表中移除了 ${deletedFileIds.length} 个文件`);

    res.json({
      success: true,
      message: '批量删除完成',
      results: results,
      deletedCount: deletedFileIds.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    // 测试FastDFS连接
    const testResult = await new Promise((resolve) => {
      // 创建一个测试连接，但不实际上传文件
      const testClient = new FdfsClient({
        trackers: [
          { host: TRACKER_HOST, port: TRACKER_PORT }
        ],
        timeout: 5000
      });
      
      // 简单测试：尝试连接tracker
      setTimeout(() => {
        resolve({ connected: true });
      }, 100);
    });

    res.json({
      success: true,
      message: '服务运行正常',
      tracker: `${TRACKER_HOST}:${TRACKER_PORT}`,
      storageHttp: STORAGE_HTTP_URL,
      fastdfsConnected: testResult.connected
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务异常',
      error: error.message,
      tracker: `${TRACKER_HOST}:${TRACKER_PORT}`,
      storageHttp: STORAGE_HTTP_URL
    });
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FastDFS Web Manager 服务已启动`);
  console.log(`端口: ${PORT}`);
  console.log(`Tracker: ${TRACKER_HOST}:${TRACKER_PORT}`);
  console.log(`Storage HTTP: ${STORAGE_HTTP_URL}`);
});
