# FastDFS Docker Compose 使用说明

## 服务说明

- **tracker**: FastDFS调度服务器，端口 22122
- **storage**: FastDFS存储服务器，端口 23000（存储服务）、8888（HTTP访问）

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

### 4. 测试文件上传

可以使用FastDFS客户端工具测试，或者通过HTTP接口访问已上传的文件：

访问地址：`http://localhost:8888/group1/M00/00/00/xxxxx`

### 5. 停止服务

```bash
docker-compose down
```

## 数据持久化

- tracker数据目录：`./tracker_data`
- storage数据目录：`./storage_data`

## 可视化管理工具

### FastDFS 可视化工具分析

**重要说明**：传统FastDFS（Tracker+Storage架构）**没有官方的Web管理界面**，主要通过以下方式管理：

#### 1. HTTP访问（已配置）
- Storage服务已集成Nginx，可通过HTTP直接访问文件
- 访问地址：`http://localhost:8888/group1/M00/00/00/xxxxx`
- 这是最常用的文件访问方式

#### 2. 命令行监控工具
进入容器使用FastDFS内置的监控命令：

```bash
# 进入tracker容器
docker exec -it fastdfs_tracker bash

# 查看storage注册状态
fdfs_monitor /etc/fdfs/client.conf

# 查看storage列表
fdfs_monitor /etc/fdfs/client.conf list
```

#### 3. 第三方可视化工具（可选）

**注意**：目前市面上针对传统FastDFS的Web管理工具较少，主要有：

- **FastDFS-WebUI**（第三方开发，GitHub可搜索）
- **自研Web管理界面**：基于FastDFS客户端API开发

如果需要可视化界面，建议：
1. 使用HTTP接口（端口8888）直接访问文件
2. 通过客户端API开发自定义管理界面
3. 使用命令行工具进行监控和管理

#### 4. 文件上传测试

可以使用FastDFS客户端工具或通过编程语言SDK进行文件上传：

```bash
# 进入storage容器测试上传
docker exec -it fastdfs_storage bash
cd /var/fdfs
echo "Hello FastDFS" > test.txt
fdfs_upload_file /etc/fdfs/client.conf test.txt
```

## 注意事项

1. 首次启动时，storage会自动连接到tracker
2. 确保端口 22122、23000、8888 未被占用
3. 如需修改配置，可以进入容器修改 `/etc/fdfs/` 目录下的配置文件
4. FastDFS本身没有官方Web管理界面，主要通过HTTP接口和命令行工具管理
