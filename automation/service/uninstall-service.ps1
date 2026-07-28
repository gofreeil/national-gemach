# ============================================================
# uninstall-service.ps1 — הסרת המשימה המתוזמנת של עובד הגילוי
# ============================================================
#
# הרצה: npm run discovery:service:uninstall
# הלוגים והמצב המקומי (automation/state) נשארים.

$ErrorActionPreference = 'Stop'
$TaskName = 'NationalGemach-DiscoveryWorker'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Output "המשימה '$TaskName' לא רשומה — אין מה להסיר."
    return
}

if ($task.State -eq 'Running') {
    Stop-ScheduledTask -TaskName $TaskName
    Write-Output '⏹️  העובד נעצר.'
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Output "🗑️  המשימה '$TaskName' הוסרה. העובד לא יעלה יותר אוטומטית."
Write-Output 'להפעלה ידנית בכל עת: npm run discovery:worker'
