# 360 WorkFox Tech - local development MySQL instance manager
#
# Creates and runs a DEDICATED MySQL 8 instance on port 3307 with its data
# directory inside the project (gitignored `devdb/`). The machine's own
# MySQL service (port 3306) and its data are never touched.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action start
#   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action stop
#   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action status
#   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action reset   # DESTRUCTIVE (dev only)

param(
  [ValidateSet('start', 'stop', 'status', 'reset')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DataDir     = Join-Path $ProjectRoot 'devdb\data'
$LogFile     = Join-Path $ProjectRoot 'devdb\mysqld.log'
$PidFile     = Join-Path $ProjectRoot 'devdb\mysqld.pid'
$Port        = 3307
$DbName      = 'workfox_tech'
$DbUser      = 'workfox'
$DbPassword  = 'WorkfoxDev3307'

function Find-Mysqld {
  $candidates = @(
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe',
    'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe',
    'C:\Program Files\MySQL\MySQL Server 9.6\bin\mysqld.exe'
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  $found = Get-ChildItem 'C:\Program Files\MySQL' -Filter 'mysqld.exe' -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  if ($found) { return $found }
  throw 'mysqld.exe not found. Install MySQL Server 8.x or set the path in scripts/dev-db.ps1.'
}

$Mysqld = Find-Mysqld
$Mysql  = Join-Path (Split-Path -Parent $Mysqld) 'mysql.exe'

function Test-DevDbRunning {
  $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  return [bool]$conn
}

function Initialize-DataDir {
  if (Test-Path (Join-Path $DataDir 'mysql')) { return }
  Write-Host "Initializing dev MySQL data directory at $DataDir ..."
  New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
  & $Mysqld --no-defaults --initialize-insecure --datadir="$DataDir" --mysqlx=OFF 2>&1 |
    Tee-Object -FilePath $LogFile -Append
  Write-Host 'Data directory initialized (root has an empty password, local-only instance).'
}

function Start-DevDb {
  if (Test-DevDbRunning) { Write-Host "Dev MySQL already running on port $Port."; return }
  Initialize-DataDir
  Write-Host "Starting dev MySQL on port $Port ..."
  $proc = Start-Process -FilePath $Mysqld -ArgumentList @(
    '--no-defaults',
    "--datadir=$DataDir",
    "--port=$Port",
    '--bind-address=127.0.0.1',
    '--mysqlx=OFF',
    "--log-error=$LogFile",
    "--pid-file=$PidFile"
  ) -WindowStyle Hidden -PassThru

  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-DevDbRunning) { break }
  }
  if (-not (Test-DevDbRunning)) {
    throw "Dev MySQL failed to start. See $LogFile"
  }
  Write-Host "Dev MySQL is up (pid $($proc.Id))."
  Initialize-Database
}

function Initialize-Database {
  $sql = @"
CREATE DATABASE IF NOT EXISTS ``$DbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DbUser'@'127.0.0.1' IDENTIFIED BY '$DbPassword';
CREATE USER IF NOT EXISTS '$DbUser'@'localhost' IDENTIFIED BY '$DbPassword';
ALTER USER '$DbUser'@'127.0.0.1' IDENTIFIED BY '$DbPassword';
ALTER USER '$DbUser'@'localhost' IDENTIFIED BY '$DbPassword';
GRANT ALL PRIVILEGES ON ``$DbName``.* TO '$DbUser'@'127.0.0.1';
GRANT ALL PRIVILEGES ON ``$DbName``.* TO '$DbUser'@'localhost';
FLUSH PRIVILEGES;
"@
  $sql | & $Mysql --protocol=TCP --host=127.0.0.1 --port=$Port -u root 2>&1 | Out-String | Write-Host
  Write-Host "Database '$DbName' and user '$DbUser' are ready."
}

function Stop-DevDb {
  if (-not (Test-DevDbRunning)) { Write-Host "Dev MySQL is not running on port $Port."; return }
  if (Test-Path $Mysql) {
    & $Mysql --protocol=TCP --host=127.0.0.1 --port=$Port -u root -e 'SHUTDOWN;' 2>&1 | Out-Null
  }
  Start-Sleep -Seconds 2
  if (Test-DevDbRunning) {
    $procId = (Get-NetTCPConnection -State Listen -LocalPort $Port | Select-Object -First 1).OwningProcess
    Stop-Process -Id $procId -Force
  }
  Write-Host 'Dev MySQL stopped.'
}

function Show-Status {
  if (Test-DevDbRunning) {
    $proc = (Get-NetTCPConnection -State Listen -LocalPort $Port | Select-Object -First 1).OwningProcess
    Write-Host "Dev MySQL RUNNING on port $Port (pid $proc)"
    Write-Host "  data dir: $DataDir"
    if (Test-Path $Mysql) {
      & $Mysql --protocol=TCP --host=127.0.0.1 --port=$Port -u root -e "SELECT VERSION() AS version; SHOW DATABASES;" 2>&1 | Out-String | Write-Host
    }
  } else {
    Write-Host "Dev MySQL NOT running on port $Port"
  }
}

switch ($Action) {
  'start'  { Start-DevDb }
  'stop'   { Stop-DevDb }
  'status' { Show-Status }
  'reset'  {
    Write-Host 'WARNING: this deletes the LOCAL DEVELOPMENT database only.' -ForegroundColor Yellow
    if ($env:WORKFOX_CONFIRM_DEV_RESET -ne 'yes') {
      Write-Host 'Refusing to reset. Re-run with $env:WORKFOX_CONFIRM_DEV_RESET = "yes" (development only).' -ForegroundColor Yellow
      exit 1
    }
    Stop-DevDb
    if (Test-Path $DataDir) { Remove-Item $DataDir -Recurse -Force }
    Start-DevDb
  }
}
