Add-Type -AssemblyName System.Drawing

$src = "C:\projects\astrology-birth-chart-app\backend\data\uploads\vietqr-vcb-default.png"
$out = "C:\projects\astrology-birth-chart-app\backend\data\uploads\vietqr-vcb-qrcode-only.png"

$img = [System.Drawing.Image]::FromFile($src)
$w = $img.Width
$h = $img.Height
Write-Output "size ${w}x${h}"

$left = [int]($w * 0.18)
$top = [int]($h * 0.22)
$width = [int]($w * 0.64)
$height = [int]($h * 0.36)

$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$srcRect = New-Object System.Drawing.Rectangle $left, $top, $width, $height
$destRect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
$g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$img.Dispose()

Write-Output "saved $out (${width}x${height})"
