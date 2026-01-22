# Docker 端口访问问题诊断和解决方案

## 问题描述

访问 `http://localhost:3000` 或 `http://localhost:5601` 时：
- 大多数时候报错 "无法访问此网站" (ERR_CONNECTION_RESET)
- 多次刷新后偶尔可以访问
- 重启Docker后正常一段时间，之后又出现

## 可能原因分析

### 1. Docker Desktop 资源限制（最可能）

**症状**：多个容器运行时，资源不足导致端口转发不稳定

**检查方法**：
```bash
# 查看Docker资源使用
docker stats

# 查看Docker Desktop设置中的资源分配
# Docker Desktop -> Settings -> Resources
```

**解决方案**：
- 增加Docker Desktop的内存分配（建议至少4GB）
- 减少同时运行的容器数量
- 关闭不必要的容器

### 2. Windows 端口转发问题

**症状**：Windows上Docker Desktop的端口转发机制不稳定

**检查方法**：
```bash
# 检查端口占用
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5601"

# 检查是否有TIME_WAIT状态的连接过多
netstat -ano | findstr "TIME_WAIT"
```

**解决方案**：
- 使用 `127.0.0.1:3000` 而不是 `localhost:3000`
- 配置host网络模式（不推荐，可能有其他问题）
- 重启Docker Desktop

### 3. 连接数限制

**症状**：连接池耗尽，新连接被拒绝

**检查方法**：
```bash
# 查看连接状态
netstat -ano | findstr "ESTABLISHED" | findstr ":3000"
```

**解决方案**：
- 增加Windows的TCP连接数限制
- 优化应用连接池配置

### 4. Docker Desktop 网络问题

**症状**：Docker网络不稳定

**检查方法**：
```bash
# 检查Docker网络
docker network ls
docker network inspect liurl_net
```

**解决方案**：
- 重启Docker Desktop
- 重置Docker网络：`docker network prune`
- 重新创建网络

### 5. Windows 防火墙/安全软件

**症状**：安全软件拦截连接

**检查方法**：
- 检查Windows防火墙日志
- 检查安全软件（如360、火绒等）的拦截记录

**解决方案**：
- 添加防火墙规则允许Docker端口
- 临时关闭安全软件测试

## 诊断步骤

### 步骤1：检查容器状态

```bash
# 查看所有容器状态
docker ps -a

# 查看特定容器日志
docker logs fastdfs_web_manager
docker logs kibana
```

### 步骤2：检查端口监听

```bash
# 检查端口是否在监听
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5601"

# 应该看到 LISTENING 状态
```

### 步骤3：测试容器内部连接

```bash
# 进入容器测试
docker exec -it fastdfs_web_manager sh
# 在容器内执行
wget -O- http://localhost:3000/api/health
# 或
curl http://localhost:3000/api/health
```

### 步骤4：检查Docker Desktop资源

1. 打开 Docker Desktop
2. 进入 Settings -> Resources
3. 检查：
   - Memory: 建议至少4GB
   - CPUs: 建议至少2核
   - Disk image size: 确保有足够空间

### 步骤5：检查系统资源

```bash
# 查看系统资源使用
# 任务管理器 -> 性能标签
# 检查CPU、内存、磁盘使用率
```

## 快速修复方案

### 方案1：重启Docker Desktop（临时解决）

1. 右键点击系统托盘中的Docker图标
2. 选择 "Restart Docker Desktop"
3. 等待重启完成

### 方案2：使用127.0.0.1代替localhost

尝试访问：
- `http://127.0.0.1:3000` 而不是 `http://localhost:3000`
- `http://127.0.0.1:5601` 而不是 `http://localhost:5601`

### 方案3：增加Docker资源

1. Docker Desktop -> Settings -> Resources
2. 增加 Memory 到 4GB 或更多
3. 增加 CPUs 到 2 或更多
4. 点击 "Apply & Restart"

### 方案4：优化容器配置

添加健康检查和资源限制：

```yaml
web-manager:
  # ... 其他配置 ...
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
      reservations:
        memory: 256M
        cpus: '0.25'
```

### 方案5：使用host网络模式（不推荐，仅测试用）

```yaml
web-manager:
  network_mode: "host"
  # 注意：使用host模式时，ports配置无效
```

## 长期解决方案

### 1. 优化Docker Desktop配置

- 定期清理未使用的镜像和容器
- 限制同时运行的容器数量
- 为重要服务设置资源限制

### 2. 使用Nginx反向代理

通过Nginx统一管理端口转发，避免直接访问容器端口：

```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
```

### 3. 监控和日志

添加监控工具，及时发现资源问题：
- Portainer（Docker管理界面）
- cAdvisor（容器监控）

## 验证修复

修复后验证：

```bash
# 1. 检查服务状态
docker ps

# 2. 测试端口连接
curl http://localhost:3000/api/health
curl http://localhost:5601/api/status

# 3. 持续监控
docker stats
```

## 如果问题仍然存在

1. 收集诊断信息：
   ```bash
   docker info > docker_info.txt
   docker ps -a > docker_ps.txt
   docker stats --no-stream > docker_stats.txt
   ```

2. 检查Windows事件查看器中的错误日志

3. 考虑使用WSL2后端（如果使用Docker Desktop）

4. 联系Docker支持或查看Docker Desktop日志：
   - `%LOCALAPPDATA%\Docker\log.txt`
