# Arranca Nova en local: PostgreSQL + backend (puerto 3001) + frontend (puerto 4200).
# Uso: clic derecho sobre este archivo -> "Ejecutar con PowerShell"
#   o en PowerShell:  powershell -ExecutionPolicy Bypass -File .\iniciar-nova.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Fin($texto) { Write-Host "`n$texto" -ForegroundColor Red; Read-Host "Presiona Enter para cerrar"; exit 1 }

# ---------- 1. PostgreSQL ----------
$dbPort = 5432
$envLine = Get-Content (Join-Path $backend ".env") | Where-Object { $_ -match '^DB_PORT=(\d+)' } | Select-Object -First 1
if ($envLine -match '^DB_PORT=(\d+)') { $dbPort = [int]$Matches[1] }

function PuertoAbierto($port) {
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $port); $c.Close(); return $true } catch { return $false }
}

Paso "Revisando PostgreSQL (puerto $dbPort)"
if (-not (PuertoAbierto $dbPort)) {
  $servicios = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue
  if (-not $servicios) {
    Fin "No encontré ningún servicio de PostgreSQL. Si lo usas con Docker, prende el contenedor y vuelve a correr este script."
  }
  foreach ($s in $servicios) {
    if ($s.Status -ne "Running") {
      Write-Host "Prendiendo $($s.Name)..."
      try { Start-Service $s.Name }
      catch {
        Fin "No pude prender $($s.Name) (hace falta permiso de administrador).`nAbre PowerShell como administrador y corre:  Start-Service $($s.Name)`nO: tecla Windows > Servicios > $($s.Name) > Iniciar. Luego vuelve a correr este script."
      }
    }
  }
  for ($i = 0; $i -lt 20 -and -not (PuertoAbierto $dbPort); $i++) { Start-Sleep -Seconds 1 }
  if (-not (PuertoAbierto $dbPort)) {
    Fin "PostgreSQL está prendido pero no responde en el puerto $dbPort. Revisa DB_PORT en backend\.env."
  }
}
Write-Host "PostgreSQL OK" -ForegroundColor Green

# ---------- 2. npm sin cmd (el símbolo del sistema está bloqueado en este equipo) ----------
$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shellActual = (& npm config get script-shell 2>$null)
if ($shellActual -ne $psExe) {
  Paso "Configurando npm para usar PowerShell en vez de cmd"
  & npm config set script-shell $psExe
}

# ---------- 3. Dependencias ----------
if (-not (Test-Path (Join-Path $backend "node_modules\exceljs"))) {
  Paso "Instalando dependencias del backend (solo la primera vez)"
  Push-Location $backend; & npm install; $ok = $LASTEXITCODE; Pop-Location
  if ($ok -ne 0) { Fin "Falló npm install en el backend." }
}
if (-not (Test-Path (Join-Path $frontend "node_modules\@angular\cli"))) {
  Paso "Instalando dependencias del frontend (solo la primera vez)"
  Push-Location $frontend; & npm install; $ok = $LASTEXITCODE; Pop-Location
  if ($ok -ne 0) { Fin "Falló npm install en el frontend." }
}

# ---------- 4. Datos de prueba (opcional) ----------
$respuesta = Read-Host "`n¿Cargar (o recargar) los datos de DEMO para probar? (s/n)"
if ($respuesta -match '^[sS]') {
  Paso "Cargando datos de demo"
  Push-Location $backend
  & node -r ts-node/register/transpile-only src/seeds/demo.ts
  $ok = $LASTEXITCODE
  Pop-Location
  if ($ok -ne 0) { Fin "No se pudieron cargar los datos de demo (mira el error arriba)." }
}

# ---------- 5. Backend y frontend, cada uno en su ventana ----------
Paso "Abriendo backend (http://localhost:3001) y frontend (http://localhost:4200)"
$cmdBackend = "`$host.UI.RawUI.WindowTitle = 'Nova BACKEND'; Set-Location '$backend'; node node_modules/ts-node-dev/lib/bin.js --respawn --transpile-only src/index.ts"
$cmdFrontend = "`$host.UI.RawUI.WindowTitle = 'Nova FRONTEND'; Set-Location '$frontend'; `$env:NG_CLI_ANALYTICS = 'false'; node node_modules/@angular/cli/bin/ng.js serve"
Start-Process $psExe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $cmdBackend
Start-Process $psExe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $cmdFrontend

Write-Host "Esperando a que el frontend compile..."
for ($i = 0; $i -lt 120 -and -not (PuertoAbierto 4200); $i++) { Start-Sleep -Seconds 2 }
Start-Sleep -Seconds 3
Start-Process "http://localhost:4200/admin/login"

Write-Host "`nListo. Tienda: http://localhost:4200   Panel: http://localhost:4200/admin/login" -ForegroundColor Green
Write-Host "Usuario admin de prueba (si corriste el seed): admin@nova.com / admin123"
Write-Host "Para apagar todo, cierra las ventanas 'Nova BACKEND' y 'Nova FRONTEND'."
Read-Host "`nPresiona Enter para cerrar esta ventana"
