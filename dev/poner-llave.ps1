# ===========================================================================
# Guarda la Secret key de Supabase en dev/secretos.env
# ---------------------------------------------------------------------------
# Evita editar el archivo a mano: pegas la llave, se valida y se guarda sola.
# La llave nunca sale de esta computadora.
# ===========================================================================

$archivo = Join-Path $PSScriptRoot 'secretos.env'

Write-Host ''
Write-Host '  Casa Numa - Secret key de Supabase' -ForegroundColor Cyan
Write-Host '  ----------------------------------' -ForegroundColor Cyan
Write-Host ''
Write-Host '  1. Ve a Supabase -> Settings -> API Keys'
Write-Host '  2. En "Secret keys", da clic al boton de COPIAR'
Write-Host '  3. Pega aqui con clic derecho (o Ctrl+V) y presiona Enter'
Write-Host ''

$llave = (Read-Host '  Pega la llave').Trim()

if ([string]::IsNullOrWhiteSpace($llave)) {
    Write-Host ''
    Write-Host '  No pegaste nada. Vuelve a correr el script.' -ForegroundColor Red
    Write-Host ''
    Read-Host '  Enter para cerrar'
    exit 1
}

# Acepta el formato nuevo (sb_secret_) y el viejo (JWT eyJ...)
if (-not ($llave.StartsWith('sb_secret_') -or $llave.StartsWith('eyJ'))) {
    Write-Host ''
    Write-Host "  Eso no parece una Secret key." -ForegroundColor Red
    Write-Host "  Debe empezar con 'sb_secret_' (o 'eyJ' si es del formato viejo)." -ForegroundColor Red
    Write-Host "  Lo que pegaste empieza con: $($llave.Substring(0, [Math]::Min(12, $llave.Length)))" -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  OJO: la que empieza con sb_publishable_ NO es. Esa es la publica.' -ForegroundColor Yellow
    Write-Host ''
    Read-Host '  Enter para cerrar'
    exit 1
}

if (-not (Test-Path $archivo)) {
    Write-Host ''
    Write-Host "  No encuentro $archivo" -ForegroundColor Red
    Read-Host '  Enter para cerrar'
    exit 1
}

$contenido = Get-Content $archivo -Raw
$nuevo = $contenido -replace '(?m)^SUPABASE_SERVICE_ROLE_KEY\s*=.*$', "SUPABASE_SERVICE_ROLE_KEY=$llave"

# UTF8 sin BOM: el CLI de Supabase no lee bien un archivo con BOM.
[System.IO.File]::WriteAllText($archivo, $nuevo, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
Write-Host '  Guardada.' -ForegroundColor Green
Write-Host "  Empieza con: $($llave.Substring(0, [Math]::Min(14, $llave.Length)))...  ($($llave.Length) caracteres)"
Write-Host ''
Write-Host '  Ya puedes cerrar esta ventana y decirme "listo".' -ForegroundColor Cyan
Write-Host ''
Read-Host '  Enter para cerrar'
