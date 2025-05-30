#!/bin/sh

# 哨兵构建, 直接运行这个脚本就行可以了, 然后

# 注意文件的编码, 使用set ff查看, 如果显示fileformat=doc则表示是windows, 则需要修改 set fileformat=unix
# 1.创建挂载目录
# 1.1 redis配置挂载目录
mkdir -p ./redis/6380/conf
mkdir -p ./redis/6381/conf
mkdir -p ./redis/6382/conf
# 1.2 sentinel配置挂载目录
mkdir -p ./sentinel/

# 2.复制配置文件
# 2.1 复制redis配置文件
# 2.1.1 复制master配置
cp ./redis/redis.conf ./redis/6380/conf/redis.conf
# 2.1.2 复制slave配置
cp ./redis/redis_slave.conf ./redis/6381/conf/redis.conf
cp ./redis/redis_slave.conf ./redis/6382/conf/redis.conf
# 2.2 复制sentinel配置文件, 复制三份, 和sentinel一一对应
for i in `seq 3`; do cp "./sentinel/sentinel.conf" "./sentinel/sentinel$i.conf"; done

# 创建主从redis
docker-compose -f ./redis/docker-compose.yml up -d

# 创建哨兵
docker-compose -f ./sentinel/docker-compose.yml up -d

# 创建完后按如下步骤进行验证
# 1 Master/Slave副本集
#   进入Master容器，确认两个Slave容器已经连接。
#   redis-cli
#   auth liurl
#   info replication
# 2.Redis Sentinel 进入 Sentinel容器
#   redis-cli -p 26379
#   sentinel master mymaster

# 客户端访问时, 会发现连接不了, 还需要设置windows路由
# 添加路由, windows powershell中进行设置, 172.18.0.0是子网网关, 可以从sentinel配置文件中查看
# route add -p 172.18.0.1 mask 255.255.255.240 172.27.32.1

# route相关常用命令
# route print 查看当前的路由信息
# route add 10.0.0.0 mask 255.0.0.0 10.1.1.1 增加一条到10.0.0.0/8网络的路由，网关是10.1.1.1
# route -p add 10.0.0.0 mask 255.0.0.0 10.1.1.1 增加一条永久路由
# route delete 10.0.0.0 删除10.0.0.0这条路由
# route change 10.0.0.0 mask 255.0.0.0 10.1.1.111 把网关改成10.1.1.111，注意，change命令只能修改网关或者metric的值
