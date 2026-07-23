$ErrorActionPreference = 'Stop'

$databasePath = Join-Path $env:APPDATA 'bossmaster-ai-chat-batch\bossmaster-data\database.json'
$resetScriptPath = Join-Path $PSScriptRoot 'scripts\reset-super-admin.js'
$nodePath = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) {
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
}

Write-Host ''
Write-Host 'BOSSMASTER - Reset Super Admin Password' -ForegroundColor Cyan
Write-Host 'Chat, Batch, Notepad, Settings and API keys will be preserved.' -ForegroundColor Green
Write-Host 'Close BOSSMASTER before continuing.' -ForegroundColor Yellow
Write-Host ''

$firstPtr = [IntPtr]::Zero
$secondPtr = [IntPtr]::Zero

try {
    $first = Read-Host -Prompt 'Enter a new password' -AsSecureString
    $second = Read-Host -Prompt 'Enter the new password again' -AsSecureString
    $firstPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
    $secondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
    $firstText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPtr)
    $secondText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPtr)

    if ($firstText -cne $secondText) {
        throw 'The two passwords do not match.'
    }

    $payload = @{
        databasePath = $databasePath
        username = 'bosszer42'
        password = $firstText
    } | ConvertTo-Json -Compress

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $nodePath
    $startInfo.Arguments = '"' + $resetScriptPath + '"'
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $nodeProcess = New-Object System.Diagnostics.Process
    $nodeProcess.StartInfo = $startInfo
    [void]$nodeProcess.Start()
    $nodeProcess.StandardInput.WriteLine($payload)
    $nodeProcess.StandardInput.Close()
    $result = $nodeProcess.StandardOutput.ReadToEnd()
    $errorText = $nodeProcess.StandardError.ReadToEnd()
    $nodeProcess.WaitForExit()

    if ($nodeProcess.ExitCode -ne 0) {
        throw $errorText
    }

    Write-Host ''
    Write-Host 'Password reset completed successfully.' -ForegroundColor Green
    Write-Host 'A safety backup was created before changing the password.' -ForegroundColor Green
    Write-Host 'Open BOSSMASTER and sign in with username: bosszer42' -ForegroundColor Cyan
}
catch {
    Write-Host ''
    Write-Host ('Password reset failed: ' + $_.Exception.Message) -ForegroundColor Red
}
finally {
    if ($firstPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPtr)
    }
    if ($secondPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPtr)
    }
    $firstText = $null
    $secondText = $null
    $payload = $null
}
