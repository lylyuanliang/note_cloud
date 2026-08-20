#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
诊断脚本 A: 抓取目标页面 -> 提取所有子资源 -> 逐主机做 DNS/TCP/HTTPS 可达性探测
============================================================================
用途:
    当浏览器能打开页面、但一堆 JS/CSS 报 ERR_CONNECTION_TIMED_OUT 时,
    用来定位"到底是哪个资源主机打不开"。

用法:
    python diagnose_page.py [目标URL] [代理URL]
    示例:
      python diagnose_page.py
      python diagnose_page.py https://www.workbuddy.cn/
      python diagnose_page.py https://www.workbuddy.cn/ http://127.0.0.1:7897

默认值:
    目标 = https://www.workbuddy.cn/
    代理 = http://127.0.0.1:7897

依赖:
    pip install requests urllib3
    (Python 自带 ssl/socket/re, 无需额外安装)

输出:
    1) 主页面 HTML 是否抓到、状态码
    2) 页面引用的全部资源 URL 及按主机分组清单
    3) 每个主机的 DNS / TCP443 / TCP80 / HTTPS 探测结果
    4) 汇总: 哪些主机打不开/超时 ( <-- 问题主机 )
"""
import sys, re, socket, time
from urllib.parse import urljoin, urlparse
import requests
import urllib3
urllib3.disable_warnings()

TARGET = sys.argv[1] if len(sys.argv) > 1 else "https://www.workbuddy.cn/"
PROXY_HOST = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:7897"
PROXY = {"http": PROXY_HOST, "https": PROXY_HOST}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
H = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}


def main():
    print(f"=== 目标: {TARGET} ===")
    print(f"=== 代理: {PROXY_HOST} ===\n")

    # ---- 1. 抓主页面 HTML ----
    print("=== 1. 抓取主页面 HTML (走代理, 不校验证书) ===")
    html = ""
    try:
        r = requests.get(TARGET, headers=H, proxies=PROXY, verify=False, timeout=(15, 30))
        print(f"status: {r.status_code}  len: {len(r.text)}")
        html = r.text
    except Exception as e:
        print(f"FETCH FAILED via proxy: {e}")
        print("retry direct (no proxy)...")
        try:
            r = requests.get(TARGET, headers=H, verify=False, timeout=(15, 30))
            print(f"direct status: {r.status_code}  len: {len(r.text)}")
            html = r.text
        except Exception as e2:
            print(f"FETCH FAILED direct: {e2}")
    if not html:
        print("!! 拿不到 HTML, 无法继续")
        return
    try:
        open("page.html", "w", encoding="utf-8").write(html)
    except Exception:
        pass

    # ---- 2. 提取资源 URL ----
    print("\n=== 2. 提取所有资源 URL ===")
    srcs = set()
    for m in re.finditer(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', html, re.I):
        u = m.group(1)
        if u.startswith(("data:", "javascript:", "#")):
            continue
        srcs.add(urljoin(TARGET, u))
    for m in re.finditer(r'https?://[A-Za-z0-9.\-]+(?:\.[A-Za-z]{2,})[^\s"\'<>)]*', html):
        srcs.add(m.group(0))
    print(f"unique resource URLs: {len(srcs)}")

    by_host = {}
    for u in srcs:
        p = urlparse(u)
        key = f"{p.scheme}://{p.hostname or ''}"
        by_host.setdefault(key, []).append(u)

    print("\n=== 3. 涉及主机清单 ===")
    for h in sorted(by_host):
        print(f"  {h}  ({len(by_host[h])} url)")

    # ---- 4. 逐主机可达性 ----
    print("\n=== 4. 逐主机可达性 (DNS+TCP443+TCP80+HTTPS) ===")
    results = []
    for origin in sorted(by_host):
        host = urlparse(origin).hostname
        # DNS
        ips = []
        try:
            info = socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
            ips = sorted({i[4][0] for i in info})
            dns = "OK " + ",".join(ips)
        except Exception as e:
            dns = "FAIL " + str(e)
        # TCP443
        tcp443 = ""
        for ip in ips[:2]:
            try:
                s = socket.create_connection((ip, 443), timeout=4); s.close()
                tcp443 = f"OK {ip}"; break
            except Exception as e:
                tcp443 = f"FAIL {ip} {e}"
        # TCP80
        tcp80 = ""
        for ip in ips[:2]:
            try:
                s = socket.create_connection((ip, 80), timeout=4); s.close()
                tcp80 = f"OK {ip}"; break
            except Exception as e:
                tcp80 = f"FAIL {ip} {e}"
        # HTTPS
        https = ""
        t0 = time.time()
        try:
            rr = requests.get(origin + "/", headers=H, proxies=PROXY, verify=False,
                              timeout=(5, 8), stream=True)
            https = f"{rr.status_code} ({time.time()-t0:.1f}s)"
        except Exception as e:
            https = f"FAIL ({time.time()-t0:.1f}s) {type(e).__name__}: {str(e)[:80]}"
        tag = "  <-- 问题主机!" if ("FAIL" in dns or "FAIL" in tcp443 or "FAIL" in https) else ""
        print(f"[{origin}]")
        print(f"    DNS   : {dns}")
        print(f"    TCP443: {tcp443}")
        print(f"    TCP80 : {tcp80}")
        print(f"    HTTPS : {https}{tag}")
        results.append({"origin": origin, "dns": dns, "tcp443": tcp443, "tcp80": tcp80, "https": https})

    # ---- 5. 汇总 ----
    print("\n=== 5. 汇总: 打不开/超时的主机 ===")
    bad = [x for x in results if ("FAIL" in x["https"] or "FAIL" in x["dns"] or "FAIL" in x["tcp443"])]
    if bad:
        for x in bad:
            print(f"  * {x['origin']}  -> HTTPS: {x['https']}")
        print("\n  下一步: 对这些主机运行 diagnose_cdn.py 做逐 IP 稳定性测试。")
    else:
        print("  (所有主机可达, 问题可能在具体路径或加载时机)")


if __name__ == "__main__":
    main()
