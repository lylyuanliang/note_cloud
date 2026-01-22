# FastDFS Web管理界面故障排查指南

## 上传文件时出现"网络错误"的排查步骤

### 1. 检查所有服务是否正常运行

```bash
# 查看服务状态
docker compose ps

# 应该看到三个服务都在运行：
# - fastdfs_tracker
# - fastdfs_storage  
# - fastdfs_web_manager
```

### 2. 查看Web管理服务日志

```bash
# 查看web-manager日志
docker logs fastdfs_web_manager

# 实时查看日志
docker logs -f fastdfs_web_manager
```

**常见错误信息：**
- `ECONNREFUSED` - 无法连接到FastDFS tracker
- `ETIMEDOUT` - 连接超时
- `ENOTFOUND` - 无法解析主机名

### 3. 检查FastDFS服务是否正常

```bash
# 查看tracker日志
docker logs fastdfs_tracker

# 查看storage日志
docker logs fastdfs_storage

# 检查storage是否已注册到tracker
docker exec -it fastdfs_tracker fdfs_monitor /etc/fdfs/client.conf
```

### 4. 测试网络连接

```bash
# 进入web-manager容器
docker exec -it fastdfs_web_manager sh

# 测试能否连接到tracker
nc -zv tracker 22122

# 测试能否连接到storage
nc -zv storage 23000
```

### 5. 检查端口是否被占用

```bash
# Windows PowerShell
netstat -ano | findstr :3000
netstat -ano | findstr :22122
netstat -ano | findstr :23000
netstat -ano | findstr :8888
```

### 6. 重启服务

```bash
# 停止所有服务
docker compose down

# 重新启动
docker compose up -d

# 等待服务完全启动（web-manager需要一些时间）
docker compose ps
```

### 7. 检查浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页的错误信息
3. 查看 Network 标签页，检查 `/api/upload` 请求的状态

### 8. 手动测试API

```bash
# 测试健康检查接口
curl http://localhost:3000/api/health

# 应该返回JSON响应，包含服务状态信息
```

## 常见问题及解决方案

### 问题1: web-manager容器无法启动

**原因：** 可能是构建失败或依赖问题

**解决：**
```bash
# 重新构建
docker compose build --no-cache web-manager

# 查看构建日志
docker compose build web-manager
```

### 问题2: 无法连接到tracker

**原因：** tracker服务未启动或网络配置问题

**解决：**
```bash
# 检查tracker是否运行
docker ps | grep tracker

# 检查网络配置
docker network inspect fastdfs_liurl_net
```

### 问题3: FastDFS上传失败

**原因：** storage未正确注册到tracker

**解决：**
```bash
# 检查storage日志
docker logs fastdfs_storage

# 查看是否有注册错误
# 确保TRACKER_SERVER环境变量正确
```

### 问题4: 浏览器无法访问Web界面

**原因：** 端口未映射或防火墙阻止

**解决：**
```bash
# 检查端口映射
docker ps | grep web_manager

# 应该看到: 0.0.0.0:3000->3000/tcp

# 测试端口是否可访问
curl http://localhost:3000
```

## 获取详细错误信息

如果问题仍然存在，请收集以下信息：

1. **服务状态：**
   ```bash
   docker compose ps
   ```

2. **所有服务日志：**
   ```bash
   docker logs fastdfs_tracker > tracker.log
   docker logs fastdfs_storage > storage.log
   docker logs fastdfs_web_manager > web-manager.log
   ```

3. **网络配置：**
   ```bash
   docker network inspect fastdfs_liurl_net
   ```

4. **容器内部测试：**
   ```bash
   docker exec -it fastdfs_web_manager sh
   # 在容器内执行
   node -e "console.log(process.env)"
   ```

## 快速修复命令

如果所有服务都在运行但仍有问题，尝试：

```bash
# 完全重启
docker compose down
docker compose up -d

# 等待30秒后检查
sleep 30
docker compose ps

# 查看最新日志
docker logs --tail 50 fastdfs_web_manager
```
