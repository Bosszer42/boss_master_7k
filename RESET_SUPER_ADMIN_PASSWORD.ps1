$ErrorActionPreference = 'Stop'

$databasePath = Join-Path $env:APPDATA 'bossmaster-ai-chat-batch\bossmaster-data\database.json'
$scriptPath = Join-Path $PSScriptRoot 'scripts\reset-super-admin.js'
$nodePath = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) {
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
}

Write-Host ''
Write-Host 'BOSSMASTER - Reset Super Admin Password' -ForegroundColor Cyan
Write-Host 'ข้อมูล Chat, Batch, Notepad และ API Key จะไม่ถูกลบ' -ForegroundColor Green
Write-Host ''

$first = Read-Host 'พิมพ์รหัสผ่านใหม่' -AsSecureString
$second = Read-Host 'พิมพ์รหัสผ่านใหม่อีกครั้ง' -AsSecureString
$firstPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
$secondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)

try {
    $firstText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPtr)
    $secondText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPtr)
    if ($firstText -cne $secondText) {
        throw 'รหัสผ่านทั้งสองครั้งไม่ตรงกัน'
    }
    $payload = @{
        databasePath = $databasePath
        username = 'bosszer42'
        password = $firstText
    } | ConvertTo-Json -Compress
    $result = $payload | & $nodePath $scriptPath
    if ($LASTEXITCODE -ne 0) { throw $result }
    Write-Host ''
    Write-Host 'ตั้งรหัสผ่านใหม่สำเร็จแล้ว กรุณาเปิดโปรแกรมและเข้าสู่ระบบอีกครั้ง' -ForegroundColor Green
    Write-Host 'ระบบสร้างไฟล์สำรองฐานข้อมูลก่อนเปลี่ยนรหัสแล้ว' -ForegroundColor Green
} finally {
    if ($firstPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPtr) }
    if ($secondPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPtr) }
    $firstText = $null
    $secondText = $null
    $payload = $null
}

Write-Host ''
Read-Host 'กด Enter เพื่อปิดหน้าต่าง'
