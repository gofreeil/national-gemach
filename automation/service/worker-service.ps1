# ============================================================
# worker-service.ps1 — עוטף את ה-worker להרצה כמשימה מתוזמנת
# ============================================================
#
# רץ בחלון מוסתר, ולכן כל הפלט נכתב ללוג (automation/state/logs).
# לא מריצים את זה ידנית — install-service.ps1 רושם אותו כמשימה
# שעולה בכניסה למחשב. לצפייה בלוג: npm run discovery:service:log

$ErrorActionPreference = 'Stop'

$automationDir = Split-Path -Parent $PSScriptRoot
Set-Location $automationDir

$logDir = Join-Path $automationDir 'state\logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$log = Join-Path $logDir 'worker.log'

# סבב לוגים: מעל 5MB עובר לארכיון, כדי שהקובץ לא יגדל בלי סוף
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 5MB)) {
    Move-Item $log (Join-Path $logDir 'worker.prev.log') -Force
}

# עצירת המשימה הורגת את עטיפת ה-PowerShell אבל משאירה את node רץ.
# היתום ממשיך להחזיק את קובץ הלוג פתוח וחוסם את ההפעלה הבאה — לכן
# מנקים אותו לפני שמתחילים, וגם מבטיחים עובד יחיד.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*cli.ts*worker*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# כתיבת הכותרת לא תפיל את השירות גם אם הלוג עדיין תפוס לרגע
try {
    "=== עובד הגילוי עלה: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" |
        Out-File -FilePath $log -Append -Encoding utf8 -ErrorAction Stop
} catch {
    Start-Sleep -Seconds 2
}

# ההפניה ללוג נעשית ע"י cmd ולא ע"י PowerShell בכוונה: ב-Windows
# PowerShell 5.1 הפניית stderr של תוכנית חיצונית עוטפת כל שורה ב-ErrorRecord,
# ועם ErrorActionPreference='Stop' זו שגיאה מטרמינלת. Node כותב הודעות
# תקינות ל-stderr (למשל ".env not found"), ולכן העובד היה מת מיד בעלייה.
# מצב משותף ב-Strapi: אותו cursor שמשמש את הסריקה ב-GitHub Actions.
# בלי זה היו שני מונים נפרדים והשאילתות היו נסרקות פעמיים.
$env:DISCOVERY_STATE = 'strapi'

$ErrorActionPreference = 'Continue'
& cmd /c "node --env-file-if-exists=../.env --env-file-if-exists=.env --import tsx src/cli.ts worker --apply >> ""$log"" 2>&1"
$code = $LASTEXITCODE

"=== העובד הסתיים (קוד $code): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $log -Append -Encoding utf8
exit $code
