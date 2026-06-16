# AI Generated code <PURPOSE>: startup production environment bootstrap
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$rootEnv = Join-Path $repoRoot ".env"

function Test-CommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name
    )

    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Path -LiteralPath $rootEnv)) {
    @(
        "# AI Generated code <PURPOSE>: editable production compose defaults"
        "# Edit these values before running in a real production environment."
        "POSTGRES_DB=quiz_dev"
        "POSTGRES_USER=quiz"
        "POSTGRES_PASSWORD=quiz"
        "DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_dev"
        "REDIS_URL=redis://redis:6379"
        "BACKEND_PORT=3000"
        "FRONTEND_PORT=5173"
        "VITE_API_URL=http://localhost:3000"
    ) | Set-Content -LiteralPath $rootEnv -Encoding ascii
    Write-Host "Created .env with editable production defaults"
}

if (-not (Test-CommandAvailable -Name "docker")) {
    [Console]::Error.WriteLine("Docker is unavailable. Install Docker and ensure the docker command is on PATH.")
    exit 1
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    [Console]::Error.WriteLine("Docker is unavailable. Start Docker and try again.")
    exit 1
}

& docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    [Console]::Error.WriteLine("Docker Compose is unavailable. Install Docker Compose or enable the Docker Compose plugin.")
    exit 1
}

Push-Location -LiteralPath $repoRoot
$composeExitCode = 0
try {
    docker compose up --build
    $composeExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

exit $composeExitCode
