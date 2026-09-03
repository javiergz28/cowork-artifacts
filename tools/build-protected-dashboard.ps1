param([switch]$Dialog)

$ErrorActionPreference = 'Stop'

if ($Dialog) {
    Add-Type -AssemblyName System.Windows.Forms
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Multitrend - Publicar con el acceso actual'
    $form.Width = 460
    $form.Height = 220
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $label = New-Object System.Windows.Forms.Label
    $label.Text = 'Ingresá la contraseña actual del panel. Se usa sólo para esta generación y no se guarda.'
    $label.SetBounds(20, 18, 400, 45)
    $passwordBox = New-Object System.Windows.Forms.TextBox
    $passwordBox.UseSystemPasswordChar = $true
    $passwordBox.SetBounds(20, 72, 400, 28)
    $accept = New-Object System.Windows.Forms.Button
    $accept.Text = 'Generar páginas'
    $accept.SetBounds(250, 120, 170, 32)
    $accept.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Text = 'Cancelar'
    $cancel.SetBounds(130, 120, 110, 32)
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.AddRange(@($label, $passwordBox, $accept, $cancel))
    $form.AcceptButton = $accept
    $form.CancelButton = $cancel
    $form.Add_Shown({ $passwordBox.Focus() })
    try {
        if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
            Write-Host 'Generación cancelada. No se modificó el sitio.'
            exit 1
        }
        if (!$passwordBox.Text) { throw 'No se ingresó una contraseña.' }
        $securePassword = ConvertTo-SecureString $passwordBox.Text -AsPlainText -Force
        $passwordBox.Clear()
    }
    finally { $form.Dispose() }
}
else {
    $securePassword = Read-Host 'Clave para proteger el dashboard' -AsSecureString
}
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $env:STATICRYPT_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    & node "$PSScriptRoot\build-protected-dashboard.mjs"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Remove-Item Env:STATICRYPT_PASSWORD -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
