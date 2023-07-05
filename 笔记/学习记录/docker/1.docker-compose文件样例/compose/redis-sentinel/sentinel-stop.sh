#!/bin/sh
docker-compose -f ./redis/docker-compose.yml stop
docker-compose -f ./sentinel/docker-compose.yml stop
