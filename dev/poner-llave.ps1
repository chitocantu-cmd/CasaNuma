# ===========================================================================
# Guarda una llave secreta en dev/secretos.env
# ---------------------------------------------------------------------------
# Evita editar el archivo a mano: pegas la llave, se valida y se guarda sola.
# La llave nunca sale de esta computadora.
#
#   powershell -ExecutionPolicy Bypass -File dev\poner-llave.ps1            (Supabase)
#   powershell -ExecutionPolicy Bypass -File dev\poner-llave.ps1 -Cual stripe
# ===========================================================================

param(
  [ValidateSet('supabase', 'stripe')]
  [string]$Cual = 'supabase'
)

$archivo = Join-Path $PSScriptRoot 'secretos.env'

$llaves = @{
  supabase = @{
    titulo    = 'Secret key de Supabase'
    variable  = 'SUPABASE_SERVICE_ROLE_KEY'
    prefijos  = @('sb_secret_', 'eyJ')
    pasos     = @('1. Ve a Supabase -> Settings -> API Keys',
                  '2. En "Secret keys", da clic al boton de COPIAR',
                  '3. Pega aqui con clic derecho (o Ctrl+V) y presiona Enter')
    formato   = "Debe empezar con 'sb_secret_' (o 'eyJ' si es del formato viejo)."
    publica   = 'OJO: la que empieza con sb_publishable_ NO es. Esa es la publica.'
  }
  stripe = @{
    titulo    = 'Secret key de Stripe (modo prueba)'
    variable  = 'STRIPE_SECRET_KEY'
    prefijos  = @('sk_test_')
    pasos     = @('1. Ve a dashboard.stripe.com/test/apikeys',
                  '2. En la fila "Secret key", da clic al iconito de COPIAR',
                  '3. Pega aqui con clic derecho (o Ctrl+V) y presiona Enter')
    formato   = "Debe empezar con 'sk_test_' (por ahora solo la de prueba)."
    publica   = 'OJO: la que empieza con pk_test_ NO es. Esa es la publica.'
  }
}
$k = $llaves[$Cual]

Write-Host ''
Write-Host "  Casa Numa - $($k.titulo)" -ForegroundColor Cyan
Write-Host '  ----------------------------------' -ForegroundColor Cyan
Write-Host ''
$k.pasos | ForEach-Object { Write-Host "  $_" }
Write-Host ''

$llave = (Read-Host '  Pega la llave').Trim()

if ([string]::IsNullOrWhiteSpace($llave)) {
    Write-Host ''
    Write-Host '  No pegaste nada. Vuelve a correr el script.' -ForegroundColor Red
    Write-Host ''
    Read-Host '  Enter para cerrar'
    exit 1
}

if (-not ($k.prefijos | Where-Object { $llave.StartsWith($_) })) {
    Write-Host ''
    Write-Host "  Eso no parece la llave correcta." -ForegroundColor Red
    Write-Host "  $($k.formato)" -ForegroundColor Red
    Write-Host "  Lo que pegaste empieza con: $($llave.Substring(0, [Math]::Min(12, $llave.Length)))" -ForegroundColor Yellow
    Write-Host ''
    Write-Host "  $($k.publica)" -ForegroundColor Yellow
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
$patron = "(?m)^$($k.variable)\s*=.*$"
if ($contenido -match $patron) {
    $nuevo = $contenido -replace $patron, "$($k.variable)=$llave"
} else {
    $nuevo = $contenido.TrimEnd() + "`n$($k.variable)=$llave`n"
}

# UTF8 sin BOM: el CLI de Supabase no lee bien un archivo con BOM.
[System.IO.File]::WriteAllText($archivo, $nuevo, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
Write-Host '  Guardada.' -ForegroundColor Green
Write-Host "  Empieza con: $($llave.Substring(0, [Math]::Min(14, $llave.Length)))...  ($($llave.Length) caracteres)"
Write-Host ''
Write-Host '  Ya puedes cerrar esta ventana y decirme "listo".' -ForegroundColor Cyan
Write-Host ''
Read-Host '  Enter para cerrar'
