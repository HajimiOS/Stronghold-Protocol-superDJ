param(
  [string]$GameDirectory,
  [ValidateSet('install', 'uninstall')]
  [string]$Mode = 'install'
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$root = Split-Path -Parent $here
$srcDir = Join-Path $root 'public\sp-lite'

function Test-Game([string]$dir) {
  $index = Join-Path $dir 'public\index.html'
  $boot = Join-Path $dir 'public\js\boot.js'
  return (Test-Path -LiteralPath $index) -and (Test-Path -LiteralPath $boot)
}

if (-not $GameDirectory) {
  foreach ($candidate in @($here, $root, (Split-Path -Parent $root))) {
    if (Test-Game $candidate) { $GameDirectory = $candidate; break }
  }
}
if (-not $GameDirectory) {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = '选择卫戍协议的游戏目录'
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { throw '未选择游戏目录' }
  $GameDirectory = $dialog.SelectedPath
}
if (-not (Test-Game $GameDirectory)) { throw '所选位置不是卫戍协议的游戏目录' }

$utf8 = New-Object System.Text.UTF8Encoding $false
$indexPath = Join-Path $GameDirectory 'public\index.html'
$destDir = Join-Path $GameDirectory 'public\sp-lite'
$scriptPat = '(?s)\s*<script[^>]*src=["'']/sp-lite/[^"'']+["''][^>]*>\s*</script>\s*'
$needle = '<script src="/js/boot.js"></script>'

if ($Mode -eq 'uninstall') {
  if (Test-Path -LiteralPath $destDir) { Remove-Item -LiteralPath $destDir -Recurse -Force }
  $html = [IO.File]::ReadAllText($indexPath)
  $html = [regex]::Replace($html, $scriptPat, "`r`n")
  [IO.File]::WriteAllText($indexPath, $html, $utf8)
  Write-Host "已卸载 $GameDirectory"
  return
}

if (-not (Test-Path -LiteralPath $srcDir)) { throw "找不到模块目录: $srcDir" }
if (Test-Path -LiteralPath $destDir) { Remove-Item -LiteralPath $destDir -Recurse -Force }
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
Copy-Item -Path (Join-Path $srcDir '*') -Destination $destDir -Recurse -Force

$seed = Join-Path $destDir 'fab-seed.js'
$hash = (Get-FileHash -LiteralPath $seed -Algorithm SHA256).Hash.Substring(0, 8).ToLowerInvariant()
$tag = "<script src=`"/sp-lite/fab-seed.js?v=$hash`"></script>"

$html = [IO.File]::ReadAllText($indexPath)
$html = [regex]::Replace($html, $scriptPat, "`r`n")
if (-not $html.Contains($needle)) { throw '找不到 boot.js' }
$html = $html.Replace($needle, "$tag`r`n$needle")
[IO.File]::WriteAllText($indexPath, $html, $utf8)
Write-Host "已安装 $GameDirectory"
