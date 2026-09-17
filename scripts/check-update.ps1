# Check for BetterGravity upstream updates
Write-Host "Fetching upstream from https://github.com/YashjitPal/BetterGravity..." -ForegroundColor Cyan
git -C "$PSScriptRoot\.." fetch upstream

$localHead = git -C "$PSScriptRoot\.." rev-parse --short HEAD
$upstreamHead = git -C "$PSScriptRoot\.." rev-parse --short upstream/main
$behindCount = (git -C "$PSScriptRoot\.." rev-list --count HEAD..upstream/main).Trim()

Write-Host "`nLocal HEAD:    $localHead"
Write-Host "Upstream HEAD: $upstreamHead"

if ([int]$behindCount -gt 0) {
    Write-Host "`n⚠️  $behindCount new commit(s) available upstream:`n" -ForegroundColor Yellow
    git -C "$PSScriptRoot\.." log HEAD..upstream/main --pretty=format:"  %C(yellow)%h%Creset %C(green)%ad%Creset %C(bold blue)<%an>%Creset %s" --date=short
    Write-Host "`n"
} else {
    Write-Host "`n✅ Up to date with upstream/main.`n" -ForegroundColor Green
}
