#!/bin/sh
docker-compose -f ./redis/docker-compose.yml start
docker-compose -f ./sentinel/docker-compose.yml start
