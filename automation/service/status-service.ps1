# ============================================================
# status-service.ps1 — מצב המשימה המתוזמנת של עובד הגילוי
# ============================================================

$ErrorActionPreference = 'Stop'
$TaskName = 'NationalGemach-DiscoveryWorker'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Output "❌ המשימה '$TaskName' לא רשומה."
    Write-Output 'להתקנה: npm run discovery:service:install'
    return
}

$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Output "משימה:            $TaskName"
Write-Output "מצב:              $($task.State)"
Write-Output "הרצה אחרונה:      $($info.LastRunTime)"
Write-Output "תוצאה אחרונה:     $($info.LastTaskResult)  (0 = תקין, 267009 = רץ כעת)"
Write-Output "הרצה הבאה:        $($info.NextRunTime)"

$log = Join-Path (Split-Path -Parent $PSScriptRoot) 'state\logs\worker.log'
if (Test-Path $log) {
    Write-Output ''
    Write-Output "--- 12 שורות אחרונות מהלוג ---"
    Get-Content $log -Tail 12
} else {
    Write-Output ''
    Write-Output 'עדיין אין לוג.'
}
