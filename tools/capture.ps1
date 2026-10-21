# Cyber Michelangelo — headless screenshot helper (robust version).
# Usage:
#   powershell -NoProfile -File tools/capture.ps1 -Shots "title|?noboot=1;game|?scene=game&sim=26&freeze=1&noboot=1"
# Each shot is "name|query" with optional "|width|height".
param(
  [string]$BaseUrl = 'http://127.0.0.1:5173/',
  [string]$Shots = 'title|',
  [int]$Width = 540,
  [int]$Height = 940,
  [int]$Budget = 3200,
  [int]$TimeoutSeconds = 45,
  [string]$OutDir = 'screenshots'
)

$ErrorActionPreference = 'Continue'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $edge)) { Write-Output 'EDGE NOT FOUND'; exit 1 }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$root = (Get-Location).Path
$results = @()
$shotList = $Shots -split ';'

function Kill-ProfileProcesses([string]$profile) {
  try {
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profile) } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch { }
}

foreach ($shot in $shotList) {
  $parts = $shot -split '\|', 4
  $name = $parts[0]
  $query = if ($parts.Length -gt 1) { $parts[1] } else { '' }
  $shotW = if ($parts.Length -gt 2 -and $parts[2]) { [int]$parts[2] } else { $Width }
  $shotH = if ($parts.Length -gt 3 -and $parts[3]) { [int]$parts[3] } else { $Height }
  $file = Join-Path (Join-Path $root $OutDir) "$name.png"
  Remove-Item $file -ErrorAction SilentlyContinue
  $profile = Join-Path $env:TEMP ("edge-cm-" + $name + "-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
  $url = "$BaseUrl$query"

  $edgeArgs = @(
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-extensions',
    '--disable-background-networking', '--mute-audio', '--disable-crash-reporter',
    '--disable-breakpad', '--no-sandbox',
    "--user-data-dir=$profile",
    "--window-size=$shotW,$shotH",
    "--virtual-time-budget=$Budget",
    "--screenshot=$file",
    $url
  )
  # Start-Process does not auto-quote arguments containing spaces.
  $quoted = $edgeArgs | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }

  $proc = $null
  try {
    $proc = Start-Process -FilePath $edge -ArgumentList $quoted -PassThru -WindowStyle Hidden
  } catch {
    $results += "FAIL $name  (spawn: $($_.Exception.Message))"
    continue
  }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while (-not (Test-Path $file) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 200 }

  if (Test-Path $file) {
    $last = -1
    for ($i = 0; $i -lt 40; $i++) {
      $len = (Get-Item $file).Length
      if ($len -eq $last -and $len -gt 0) { break }
      $last = $len
      Start-Sleep -Milliseconds 120
    }
    $results += "OK   $name  $((Get-Item $file).Length) bytes"
  } else {
    $results += "FAIL $name  (timeout / no file)"
  }

  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
  Kill-ProfileProcesses $profile
  Start-Sleep -Milliseconds 250
  Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
}

$results | ForEach-Object { Write-Output $_ }
