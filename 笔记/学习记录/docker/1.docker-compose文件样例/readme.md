# Docker Compose文件样例

这里收集本地开发和测试常用中间件的 compose 配置。多数样例适合单机环境，生产环境使用前需要重新评估账号、密码、数据卷、网络和安全配置。

### 1. [Cassandra](./compose/Cassandra/)

> Cassandra 单节点服务样例，用于本地验证宽列数据库连接和基础功能。

[docker-compose](./compose/Cassandra/docker-compose.yml)

### 2. [Elastic](./compose/elastic/)

> Elasticsearch/Kibana 相关配置样例，用于本地搜索服务和索引功能验证。

[docker-compose](./compose/elastic/docker-compose.yml)

### 3. [FTP](./compose/ftp/)

> FTP 服务样例，用于本地文件上传下载、账号和端口映射测试。

[docker-compose](./compose/ftp/docker-compose.yml)

### 4. [FastDFS](./compose/fastdfs/)

> FastDFS 文件服务样例，包含 tracker、storage、Web 管理和排障说明。

[docker-compose](./compose/fastdfs/docker-compose.yml)

[README](./compose/fastdfs/README.md)

### 5. [JRebel](./compose/jrebel/)

> JRebel 激活服务相关样例，仅用于本地实验和历史记录。

[docker-compose](./compose/jrebel/docker-compose.yml)

### 6. [Kafka](./compose/kafka/)

> Kafka 本地服务样例，包含 Zookeeper 版和不依赖 Zookeeper 的 KRaft 单节点版。

[Zookeeper版 compose](./compose/kafka/docker-compose.yml)

[KRaft版 compose](./compose/kafka/docker-compose-kraft.yml)

### 7. [EMQX](./compose/emqx/)

> EMQX MQTT Broker 样例，用于本地物联网设备接入、MQTT 消息收发和管理控制台测试。

[docker-compose](./compose/emqx/docker-compose.yml)

### 8. [MySQL](./compose/mysql/)

> MySQL 5/8 和 Windows 挂载路径样例，用于本地数据库测试。

[docker-compose](./compose/mysql/docker-compose.yml)

[docker-compose8](./compose/mysql/docker-compose8.yml)

[docker-compose windows挂载路径](./compose/mysql/docker-compose-win.yml)

### 9. [Node-RED](./compose/node-red/)

> Node-RED 流程编排工具样例，用于本地规则编排、协议接入和事件流转演示。

[docker-compose](./compose/node-red/docker-compose.yml)

### 10. [Nginx](./compose/nginx/)

> Nginx 反向代理和静态页面样例，用于本地 Web 入口、代理和端口转发测试。

[docker-compose](./compose/nginx/docker-compose.yml)

### 11. [Oracle](./compose/oracle/)

> Oracle 数据库样例，包含不同版本 compose 文件。

[docker-compose](./compose/oracle/docker-compose.yml)

[docker-compose-11g](./compose/oracle/docker-compose-11g.yml)

### 12. [Portainer](./compose/portainer/)

> Portainer 容器管理界面样例，用于本地 Docker 可视化管理。

[docker-compose](./compose/portainer/docker-compose.yml)

### 13. [RabbitMQ](./compose/rabbitmq/)

> RabbitMQ 消息队列样例，用于本地消息收发、管理控制台和端口测试。

[docker-compose](./compose/rabbitmq/docker-compose.yml)

### 14. [RocketMQ](./compose/rocketmq/)

> RocketMQ 消息队列样例，包含 broker 配置文件。

[docker-compose](./compose/rocketmq/docker-compose.yml)

### 15. [Redis Local](./compose/redis_local/)

> Redis 单机样例，包含 Linux/Windows 路径挂载配置。

[docker-compose](./compose/redis_local/docker-compose.yml)

[docker-compose windows路径挂载](./compose/redis_local/docker-compose-win.yml)

### 16. [Redis Sentinel](./compose/redis-sentinel/)

> Redis 主从和哨兵样例，用于验证高可用切换和 Sentinel 配置。

[redis](./compose/redis-sentinel/redis/)

[sentinel](./compose/redis-sentinel/sentinel/)

[说明](./compose/redis-sentinel/1.readme.md)

### 17. [XXL-JOB](./compose/xxl-job/)

> XXL-JOB 调度中心样例，用于本地任务调度服务测试。

[docker-compose](./compose/xxl-job/docker-compose.yml)

### 18. [YApi](./compose/yapi/)

> YApi 接口管理平台样例，用于本地接口文档和 Mock 服务测试。

[docker-compose](./compose/yapi/docker-compose.yml)
