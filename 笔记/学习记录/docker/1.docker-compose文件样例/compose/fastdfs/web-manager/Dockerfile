# 使用具体版本号，避免因latest标签导致的版本不兼容问题
# 查看可用版本：https://hub.docker.com/_/node/tags
# 使用更具体的版本号，提高拉取成功率
FROM node:18.20.0-alpine

WORKDIR /app

# 复制package文件
COPY package.json ./

# 安装依赖
RUN npm install --production

# 复制应用文件
COPY . .

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
