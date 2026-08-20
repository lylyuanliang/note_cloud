#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
诊断脚本 B: 对指定主机做逐 IP 稳定性测试 (DNS+TCP443+TLS握手+实际取资源)
=========================================================================
用途:
    diagnose_page.py 找到可疑主机后, 用本脚本确认它是不是多线 CDN、
    哪些边缘节点坏了 (连接重置/超时)、哪些是好的。

用法:
    python diagnose_cdn.py [主机名] [资源URL(可选)]
    示例:
      python diagnose_cdn.py
      python diagnose_cdn.py download.codebuddy.cn
      python diagnose_cdn.py download.codebuddy.cn https://download.codebuddy.cn/path/to/file.js

默认值:
    主机 = download.codebuddy.cn
    资源 = 该主机下一个已知 JS 路径

依赖:
    pip install requests urllib3

输出:
    A) 走代理拉资源 6 次的成功/失败统计
    B) 直连(无代理)拉资源 6 次的成功/失败统计
    C) 逐 IP: TCP443 + TLS 握手 + 用 Host 头取资源状态行
       (好 IP -> HTTP/1.1 200 OK; 坏 IP -> ConnectionResetError/超时)
"""
import sys, ssl, socket, time
from urllib.parse import urlparse
import requests
import urllib3
urllib3.disable_warnings()

HOST = sys.argv[1] if len(sys.argv) > 1 else "download.codebuddy.cn"
JS = (sys.argv[2] if len(sys.argv) > 2
      else "https://download.codebuddy.cn/web/workbuddy/17a05ee8a0595055ccacbb4e14a553c5d59069d6/assets/index-DqwS5p5p.js")
PROXY = {"http": "http://127.0.0.1:7897", "https": "http://127.0.0.1:7897"}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

ips = sorted({i[4][0] for i in socket.getaddrinfo(HOST, None, socket.AF_UNSPEC, socket.SOCK_STREAM)})
print(f"=== {HOST} 解析 ===")
print("IPs:", ips)

# A. 走代理
print("\n=== A. 走代理拉资源 6 次 ===")
ok = bad = 0
for i in range(6):
    t0 = time.time()
    try:
        r = requests.get(JS, headers={"User-Agent": UA}, proxies=PROXY, verify=False, timeout=(6, 10))
        print(f"  #{i}: {r.status_code} ({time.time()-t0:.1f}s)"); ok += 1
    except Exception as e:
        print(f"  #{i}: FAIL ({time.time()-t0:.1f}s) {type(e).__name__}: {str(e)[:100]}"); bad += 1
print(f"  代理结果: ok={ok} bad={bad}")

# B. 直连
print("\n=== B. 直连(无代理)拉资源 6 次 ===")
ok = bad = 0
for i in range(6):
    t0 = time.time()
    try:
        r = requests.get(JS, headers={"User-Agent": UA}, verify=False, timeout=(6, 10))
        print(f"  #{i}: {r.status_code} ({time.time()-t0:.1f}s)"); ok += 1
    except Exception as e:
        print(f"  #{i}: FAIL ({time.time()-t0:.1f}s) {type(e).__name__}: {str(e)[:100]}"); bad += 1
print(f"  直连结果: ok={ok} bad={bad}")

# C. 逐 IP
print("\n=== C. 逐 IP: TCP443 + TLS握手 + 用 Host 头取资源状态行 ===")
path = urlparse(JS).path or "/"
for ip in ips:
    try:
        s = socket.create_connection((ip, 443), timeout=5)
        s.settimeout(8)
        ctx = ssl._create_unverified_context()
        ss = ctx.wrap_socket(s, server_hostname=HOST)
        req = (f"HEAD {path} HTTP/1.1\r\nHost: {HOST}\r\nUser-Agent: {UA}\r\n"
               f"Connection: close\r\n\r\n").encode()
        ss.sendall(req)
        data = b""
        while len(data) < 200:
            try:
                ch = ss.recv(1024)
                if not ch:
                    break
                data += ch
            except Exception:
                break
        line = data.decode("utf-8", "replace").splitlines()
        print(f"  {ip:18} -> {line[0] if line else 'NO RESPONSE'}")
        ss.close()
    except Exception as e:
        print(f"  {ip:18} -> {type(e).__name__}: {str(e)[:60]}")

print("\n判读: HTTP/1.1 200 OK = 好节点; ConnectionResetError/超时 = 坏节点(证书未部署/被重置)。")
