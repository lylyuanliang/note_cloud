#!/bin/sh

# 注意文件的编码, 使用set ff查看, 如果显示fileformat=doc则表示是windows, 则需要修改 set fileformat=unix
docker-compose -f ./redis/docker-compose.yml stop
docker-compose -f ./sentinel/docker-compose.yml stop
