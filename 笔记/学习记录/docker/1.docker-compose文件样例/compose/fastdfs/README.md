# FastDFS Docker Compose 使用说明

## 服务说明

- **tracker**: FastDFS调度服务器，端口 22122
- **storage**: FastDFS存储服务器，端口 23000（存储服务）、8888（HTTP访问）
- **web-manager**: FastDFS Web管理界面，端口 3000

## 快速开始

### 1. 启动服务

```bash
cd compose/fastdfs
docker-compose up -d
```

### 2. 查看服务状态

```bash
docker-compose ps
```

### 3. 查看日志

```bash
# 查看tracker日志
docker logs fastdfs_tracker

# 查看storage日志
docker logs fastdfs_storage
```

### 4. 访问Web管理界面

启动服务后，打开浏览器访问：

**Web管理界面**：`http://localhost:3000`

在Web界面中可以：
- 📤 上传文件
- 📋 查看文件列表
- 🔍 通过文件ID管理文件
- ⬇️ 下载文件
- 🗑️ 删除文件（单个或批量）
- 📊 查看存储统计信息

### 5. 直接访问文件

通过HTTP接口直接访问已上传的文件：

访问地址：`http://localhost:8888/group1/M00/00/00/xxxxx`

### 6. 停止服务

```bash
docker-compose down
```

## Web管理界面功能

### 主要功能

1. **文件上传**
   - 支持拖拽上传
   - 支持点击选择文件
   - 最大支持 100MB 单文件
   - 实时显示上传进度

2. **文件管理**
   - 通过文件ID添加文件到管理列表
   - 查看文件详细信息（ID、大小、时间等）
   - 文件预览和下载
   - 单个文件删除
   - 批量文件删除（用于清理存储空间）

3. **存储统计**
   - 显示已管理文件数量
   - 显示总存储大小

### 使用技巧

- **通过文件ID管理**：如果你知道文件的FastDFS ID（如 `group1/M00/00/00/xxxxx`），可以直接输入ID添加到管理列表
- **批量删除**：勾选多个文件后，点击"批量删除"可以一次性清理多个文件
- **文件访问**：点击文件URL可以直接在浏览器中打开文件

## 数据持久化

- tracker数据：使用命名卷 `fastdfs_tracker_data`
- storage数据：使用命名卷 `fastdfs_storage_data`
- Web管理界面：文件列表存储在浏览器本地（刷新页面会清空，但文件仍在FastDFS中）

## 命令行工具（可选）

如果需要使用命令行工具：

```bash
# 进入tracker容器
docker exec -it fastdfs_tracker bash

# 查看storage注册状态
fdfs_monitor /etc/fdfs/client.conf

# 进入storage容器测试上传
docker exec -it fastdfs_storage bash
cd /var/fdfs
echo "Hello FastDFS" > test.txt
fdfs_upload_file /etc/fdfs/client.conf test.txt
```

## 注意事项

1. 首次启动时，storage会自动连接到tracker
2. 确保端口 22122、23000、8888、3000 未被占用
3. Web管理界面启动需要一些时间（构建镜像），请耐心等待
4. 文件列表存储在浏览器本地，刷新页面会清空列表（但文件仍在FastDFS中）
5. 如需修改配置，可以进入容器修改 `/etc/fdfs/` 目录下的配置文件
6. 删除文件操作不可恢复，请谨慎操作

## 版本管理建议

**重要**：为了确保部署的稳定性和可重复性，建议：

1. **使用具体版本号**：避免使用 `latest` 标签，使用具体的版本号（如 `mysql:5.7.16`）
2. **定期检查更新**：定期检查镜像更新，并在测试环境验证后再更新生产环境
3. **版本锁定**：对于关键服务，建议锁定到特定版本，避免自动更新导致的不兼容问题
4. **查看可用版本**：
   - Docker Hub：访问 `https://hub.docker.com/r/<镜像名>/tags`
   - 命令行：`docker search <镜像名>` 或 `docker pull <镜像名> --all-tags`

**当前配置说明**：
- `delron/fastdfs:latest` - 如果该镜像没有版本标签，建议定期检查并考虑使用镜像digest固定版本
- `node:18-alpine` - 已使用相对稳定的版本标签，建议定期检查更新

## 技术栈

- **后端**：Node.js + Express + fdfs-client
- **前端**：原生HTML + JavaScript（无框架依赖）
- **容器化**：Docker + Docker Compose
