import { getToolDefs } from "./setup-tool-defs.js";

/**
 * PowerShell template generators for automated setup and reset on Windows.
 * Supports tool-specific setup or all-in-one setup via toolId.
 */

export function renderPowerShellSetup(baseUrl: string, apiKey: string, toolId?: string, modelsList?: Array<any>, selectedModel?: string, subagentModels?: { explore?: string; plan?: string }): string {
	const tools = getToolDefs(baseUrl, apiKey, modelsList, true, selectedModel, subagentModels);
	const targetTools = toolId && tools[toolId] ? [tools[toolId]!] : Object.values(tools);
	const label = toolId && tools[toolId] ? tools[toolId]!.name : "all 11 AI harnesses";

	const envEntries = targetTools
		.flatMap((t) => t.vars.map(([k, v]) => `    "${k}" = "${v}"`))
		.filter((val, idx, arr) => arr.indexOf(val) === idx)
		.join("\n");

	const fileWrites = targetTools
		.flatMap((t) => t.files || [])
		.map((f) => `Save-ConfigWithBackup "${f.path}" @"\n${f.content}\n"@`)
		.join("\n");

	return `# ==============================================================================
# mnRouter - Automated Setup for ${label} (Windows PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"
$baseUrl = "${baseUrl}"
$apiKey = "${apiKey}"

if (-not $apiKey -or $apiKey -eq "mr_YOUR_API_KEY") {
    $apiKey = Read-Host "[mnRouter] Enter your mnRouter API Key (mr_...)"
}
if (-not $apiKey) { Write-Error "[mnRouter] Error: API Key cannot be empty."; exit 1 }

Write-Host "[mnRouter] Setting up ${label} for $baseUrl..." -ForegroundColor Cyan

$envMap = @{
${envEntries}
}

foreach ($k in $envMap.Keys) {
    [System.Environment]::SetEnvironmentVariable($k, $envMap[$k], [System.EnvironmentVariableTarget]::User)
    Set-Item -Path "env:$k" -Value $envMap[$k]
    Write-Host "  ✓ Set environment variable: $k" -ForegroundColor Green
}

$userProfile = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)

function Save-ConfigWithBackup($path, $content) {
    $resolved = $path.Replace('$userProfile', $userProfile)
    $dir = Split-Path -Parent $resolved
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if (Test-Path $resolved) {
        $bak = "$resolved.mnrouter.bak"
        if (-not (Test-Path $bak)) { Copy-Item -Path $resolved -Destination $bak -Force }
    }
    Set-Content -Path $resolved -Value $content -Encoding UTF8 -Force

    if ($resolved -like "*models_cache.json*" -and (Test-Path "$resolved.mnrouter.bak")) {
        try {
            $oldJson = Get-Content "$resolved.mnrouter.bak" -Raw | ConvertFrom-Json
            $newJson = Get-Content $resolved -Raw | ConvertFrom-Json
            $newSlugs = @($newJson.models | ForEach-Object { $_.slug })
            $rest = @($oldJson.models | Where-Object { $newSlugs -notcontains $_.slug })
            foreach ($m in $rest) { if ($null -ne $m.priority) { $m.priority += 50 } }
            $newJson.models = @($newJson.models) + $rest
            $newJson | ConvertTo-Json -Depth 20 | Set-Content -Path $resolved -Encoding UTF8 -Force
        } catch {}
    }

    if ($resolved -like "*config.toml*" -and (Test-Path "$resolved.mnrouter.bak")) {
        try {
            $bakContent = Get-Content "$resolved.mnrouter.bak" -Raw
            $newContent = Get-Content $resolved -Raw
            $bakLines = $bakContent -split "[\\r\\n]+" | Where-Object {
                $_ -notmatch '^\\s*model_provider\\s*=' -and
                $_ -notmatch '^\\s*model\\s*=' -and
                $_ -notmatch '^\\s*chatgpt_base_url\\s*='
            }
            $cleaned = @()
            $inMn = $false
            foreach ($line in $bakLines) {
                if ($line.Trim() -eq '[model_providers.mnrouter]') { $inMn = $true; continue }
                if ($inMn -and $line.Trim().StartsWith('[')) { $inMn = $false }
                if (-not $inMn) { $cleaned += $line }
            }
            $finalContent = ($newContent.Trim() + [Environment]::NewLine + [Environment]::NewLine + ($cleaned -join [Environment]::NewLine)).Trim() + [Environment]::NewLine
            Set-Content -Path $resolved -Value $finalContent -Encoding UTF8 -Force
        } catch {}
    }

    if (($resolved -like "*models.yml*" -or $resolved -like "*models.yaml*") -and (Test-Path "$resolved.mnrouter.bak")) {
        try {
            $bakContent = Get-Content "$resolved.mnrouter.bak" -Raw
            $newContent = Get-Content $resolved -Raw
            $bakLines = $bakContent -split "[\\r\\n]+"
            $out = @()
            $inMn = $false
            foreach ($line in $bakLines) {
                if ($line.Trim() -eq 'mnrouter:' -or $line.StartsWith('  mnrouter:')) { $inMn = $true; continue }
                if ($inMn) {
                    if (($line.StartsWith('  ') -and -not $line.StartsWith('    ') -and $line.Trim().EndsWith(':')) -or ($line.Length -gt 0 -and -not $line.StartsWith(' '))) {
                        $inMn = $false
                    }
                }
                if (-not $inMn) { $out += $line }
            }
            $newLines = $newContent -split "[\\r\\n]+"
            $mnBlock = $newLines | Where-Object { $_.Trim() -ne 'providers:' }
            $finalLines = @()
            $inserted = $false
            foreach ($line in $out) {
                $finalLines += $line
                if ($line.Trim() -eq 'providers:' -and -not $inserted) {
                    $finalLines += $mnBlock
                    $inserted = $true
                }
            }
            if (-not $inserted) { $finalLines = $newLines }
            Set-Content -Path $resolved -Value (($finalLines -join [Environment]::NewLine).Trim() + [Environment]::NewLine) -Encoding UTF8 -Force
        } catch {}
    }

    Write-Host "  ✓ Configured $resolved" -ForegroundColor Green
}
${fileWrites}

Write-Host "\`n[mnRouter] ${label} successfully configured!" -ForegroundColor Green
Write-Host "Please restart your PowerShell / Terminal or IDE for environment changes to take effect." -ForegroundColor Yellow
`;
}

export function renderPowerShellReset(toolId?: string): string {
	const tools = getToolDefs("http://localhost", "mr_key", undefined, true);
	const targetTools = toolId && tools[toolId] ? [tools[toolId]!] : Object.values(tools);
	const label = toolId && tools[toolId] ? tools[toolId]!.name : "all 11 AI harnesses";

	const envNames = targetTools
		.flatMap((t) => t.vars.map(([k]) => [k]))
		.map(([k]) => `    "${k}"`)
		.filter((val, idx, arr) => arr.indexOf(val) === idx)
		.join("\n");

	const fileRestores = targetTools
		.flatMap((t) => t.files || [])
		.map((f) => `Restore-ConfigWithBackup "${f.path}"`)
		.join("\n");

	return `# ==============================================================================
# mnRouter - Automated Reset for ${label} (Windows PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "[mnRouter] Cleaning up ${label}..." -ForegroundColor Cyan

$envList = @(
${envNames}
)

foreach ($k in $envList) {
    [System.Environment]::SetEnvironmentVariable($k, $null, [System.EnvironmentVariableTarget]::User)
    Remove-Item -Path "env:$k" -ErrorAction SilentlyContinue
    Write-Host "  ✓ Removed environment variable: $k" -ForegroundColor Green
}

$userProfile = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)

function Restore-ConfigWithBackup($path) {
    $resolved = $path.Replace('$userProfile', $userProfile)
    $bak = "$resolved.mnrouter.bak"
    if (Test-Path $bak) {
        Move-Item -Path $bak -Destination $resolved -Force
        Write-Host "  ✓ Restored original $resolved" -ForegroundColor Green
    } elseif (Test-Path $resolved) {
        Remove-Item -Path $resolved -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Removed $resolved" -ForegroundColor Green
    }
}

${fileRestores}

Write-Host "\`n[mnRouter] ${label} reset complete!" -ForegroundColor Green
`;
}
