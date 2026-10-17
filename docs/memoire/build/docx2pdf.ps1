# Convert a .docx to PDF with Microsoft Word (COM), for PCs without LibreOffice.
# Usage: powershell -File build\docx2pdf.ps1 <in.docx> <out.pdf>   (absolute Windows paths)
param([Parameter(Mandatory)][string]$InDocx, [Parameter(Mandatory)][string]$OutPdf)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($InDocx, $false, $true)  # ConfirmConversions=false, ReadOnly=true
    $doc.Fields.Update() | Out-Null
    $doc.SaveAs([ref]$OutPdf, [ref]17)                   # 17 = wdFormatPDF
    $doc.Close([ref]0)                                   # 0 = wdDoNotSaveChanges
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
