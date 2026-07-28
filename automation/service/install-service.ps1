# ============================================================
# install-service.ps1 — רישום עובד הגילוי כמשימה שעולה עם המחשב
# ============================================================
#
# הרצה: npm run discovery:service:install
# לא דורש הרשאות מנהל — המשימה נרשמת למשתמש הנוכחי בלבד.

$ErrorActionPreference = 'Stop'

$TaskName = 'NationalGemach-DiscoveryWorker'
$runner   = Join-Path $PSScriptRoot 'worker-service.ps1'

if (-not (Test-Path $runner)) { throw "לא נמצא הקובץ $runner" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'node לא נמצא ב-PATH — התקינו Node.js או הריצו מטרמינל שמכיר אותו'
}

$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""

# עולה בכניסה למשתמש. השהיה קצרה כדי שהרשת תתייצב קודם (ממילא יש retry).
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Delay = 'PT1M'

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)   # לולאה ארוכה — בלי תקרת זמן

Register-ScheduledTask `
    -TaskName    $TaskName `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -Description 'עובד הגילוי של "הגמ"ח הארצי" — מבצע סריקות שנוצרו בפאנל /admin/discovery' `
    -Force | Out-Null

Write-Output "✅ המשימה '$TaskName' נרשמה — העובד יעלה אוטומטית בכל כניסה למחשב."

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3
$state = (Get-ScheduledTask -TaskName $TaskName).State
Write-Output "▶️  הופעל גם עכשיו. מצב: $state"
Write-Output ""
Write-Output "לצפייה בלוג:    npm run discovery:service:log"
Write-Output "לבדיקת מצב:     npm run discovery:service:status"
Write-Output "להסרה:          npm run discovery:service:uninstall"
