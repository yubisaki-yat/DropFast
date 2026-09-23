try {
    Add-Type -AssemblyName System.Drawing
    [Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
     = [Windows.Globalization.Language]::new('en-US')
     = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage()
    if () {
        Write-Host 'WINDOWS_OCR_READY'
    } else {
        Write-Host 'ENGINE_NULL'
    }
} catch {
    Write-Host " EXCEPTION: \
}
