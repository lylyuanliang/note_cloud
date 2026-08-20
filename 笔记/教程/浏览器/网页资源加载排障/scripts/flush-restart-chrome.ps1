#Requires -Version 5.0
<#
  flush-restart-chrome.ps1
  作用: 清系统 DNS 缓存 + 优雅重启 Chrome(恢复上次标签页)
  适用: 解决因 Chrome 缓存了坏 IP / 复用了坏连接导致 workbuddy.cn (download.codebuddy.cn) 资源 ERR_CONNECTION_TIMED_OUT
  作者: DSH agent
#>
$ErrorActionPreference = 'Stop'
try { $Host.UI.RawUI.WindowTitle = '清缓存 & 重启 Chrome' } catch {}

function Step($m){ Write-Host "[*] $m" -ForegroundColor Cyan }
function Ok($m){   Write-Host "[+] $m" -ForegroundColor Green }
function Warn($m){  Write-Host "[!] $m" -ForegroundColor Yellow }
function Err($m){   Write-Host "[x] $m" -ForegroundColor Red }

Write-Host ""
Write-Host "=== 清浏览器 DNS / 连接缓存 (重启式) ===" -ForegroundColor White
Write-Host "    即将: 关闭 Chrome -> ipconfig /flushdns -> 重开并恢复标签页"
Write-Host "    (1.5 秒后开始, 可按 Ctrl+C 取消)" -ForegroundColor DarkGray
Write-Host ""
Start-Sleep -Seconds 1.5

# ---------- 1. 定位 Chrome ----------
Step '定位 Chrome 安装路径...'
$chrome = $null
$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
foreach ($p in $candidates) {
  if ($p -and (Test-Path -LiteralPath $p)) { $chrome = $p; break }
}
if (-not $chrome) {
  foreach ($root in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
                      'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe')) {
    try {
      $ap = Get-ItemProperty -LiteralPath $root -ErrorAction Stop
      $def = $ap.'(default)'
      if ($def -and (Test-Path -LiteralPath $def)) { $chrome = $def; break }
    } catch { }
  }
}
if (-not $chrome) {
  try { $c = Get-Command chrome.exe -ErrorAction Stop; if ($c.Source) { $chrome = $c.Source } } catch { }
}
if ($chrome) { Ok "Chrome: $chrome" } else { Warn '未找到 Chrome 路径,将仅执行 DNS 清理。' }

# ---------- 2. 优雅关闭 Chrome (保住标签页以便恢复) ----------
if ($chrome) {
  Step '优雅关闭 Chrome(让 Chrome 保存当前会话)...'
  $procs = Get-Process -Name chrome -ErrorAction SilentlyContinue
  if (-not $procs) {
    Ok 'Chrome 当前未运行。'
  } else {
    # 优先对带窗口的进程发 WM_CLOSE (浏览器主进程)
    $windowed = @($procs | Where-Object { $_.MainWindowHandle -ne 0 })
    if ($windowed.Count -gt 0) {
      foreach ($w in $windowed) { try { $w.CloseMainWindow() | Out-Null } catch { } }
    }
    # 等待最多 10 秒优雅退出
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline) {
      $still = Get-Process -Name chrome -ErrorAction SilentlyContinue
      if (-not $still) { break }
      Start-Sleep -Milliseconds 500
    }
    $still = Get-Process -Name chrome -ErrorAction SilentlyContinue
    if ($still) {
      Warn 'Chrome 未在 10 秒内退出, 强制结束...'
      $still | Stop-Process -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 800
    }
    Ok 'Chrome 已关闭。'
  }
}

# ---------- 3. 清系统 DNS 缓存 ----------
Step '清系统 DNS 缓存 (ipconfig /flushdns)...'
try {
  $o = ipconfig /flushdns 2>&1
  $txt = ($o | Out-String).Trim()
  Ok $txt
} catch {
  Warn "flushdns 执行异常: $($_.Exception.Message)"
}

# ---------- 4. 重启 Chrome, 恢复上次标签页 ----------
if ($chrome) {
  Step '启动 Chrome 并恢复上次标签页 (--restore-last-session)...'
  $launchArgs = @('--restore-last-session')
  try {
    Start-Process -FilePath $chrome -ArgumentList $launchArgs
    Ok 'Chrome 已启动, 标签页将自动恢复。'
  } catch {
    Err "启动 Chrome 失败: $($_.Exception.Message)"
    Warn '请手动打开 Chrome 即可(也行)。'
  }
}

Write-Host ""
Write-Host "完成。" -ForegroundColor Green
Write-Host "提示: 若 workbuddy.cn 仍打不开, 改用 hosts 固定好 IP 的方案。" -ForegroundColor DarkGray
Write-Host ""
Start-Sleep -Seconds 3
