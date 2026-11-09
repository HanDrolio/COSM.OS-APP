# Download llama.cpp Windows CPU build and copy executable + dependencies inside the app.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $root "vendor\llama"
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$headers = @{"User-Agent"="COSM.OS-LOCAL";"Accept"="application/vnd.github+json"}
if ($env:GITHUB_TOKEN) { $headers["Authorization"] = "Bearer $env:GITHUB_TOKEN" }
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" -Headers $headers
$asset = $release.assets | Where-Object { $_.name -match "win-cpu-x64.*\.zip$" } | Select-Object -First 1
if (-not $asset) { throw "No Windows CPU x64 release asset found. Check llama.cpp GitHub Releases." }
$temp = Join-Path $env:TEMP ("cosmosruntime-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
try {
  $zip = Join-Path $temp "llama.zip"
  Write-Host ("Downloading " + $asset.name)
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing
  $extracted = Join-Path $temp "unpacked"
  Expand-Archive -Path $zip -DestinationPath $extracted -Force
  $binary = Get-ChildItem -Path $extracted -Recurse -File | Where-Object { $_.Name -eq "llama-server.exe" } | Select-Object -First 1
  if (-not $binary) { throw "llama-server.exe absent in the release archive." }
  Copy-Item -Path (Join-Path $binary.DirectoryName "*") -Destination $destination -Recurse -Force
  Write-Host ("Bundled runtime: " + (Join-Path $destination "llama-server.exe"))
} finally {
  Remove-Item -Path $temp -Recurse -Force -ErrorAction SilentlyContinue
}
