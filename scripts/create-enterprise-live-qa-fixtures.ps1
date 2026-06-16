$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$OutputDir = Join-Path $RepoRoot "artifacts/manual-qa/enterprise-metadata"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$Sections = @(
  [pscustomobject]@{ Group = "Azure"; Name = "Azure resource group"; Value = "rg-prod-weu-files-001"; Expected = "[AZURE_RG_N]" },
  [pscustomobject]@{ Group = "Azure"; Name = "Azure storage account"; Value = "stdeberfileprd1234567"; Expected = "[STORAGE_ACCOUNT_N]" },
  [pscustomobject]@{ Group = "Azure"; Name = "tenantId"; Value = "99999999-8888-7777-6666-555555555555"; Expected = "[AZURE_TENANT_ID_N]" },
  [pscustomobject]@{ Group = "Azure"; Name = "subscriptionId"; Value = "11111111-2222-3333-4444-555555555555"; Expected = "[AZURE_SUBSCRIPTION_ID_N]" },
  [pscustomobject]@{ Group = "AWS"; Name = "AWS ARN"; Value = "arn:aws:iam::123456789012:role/LeakGuardQaRole"; Expected = "[AWS_ARN_N]" },
  [pscustomobject]@{ Group = "AWS"; Name = "AWS account id"; Value = "210987654321"; Expected = "[AWS_ACCOUNT_ID_N]" },
  [pscustomobject]@{ Group = "GCP"; Name = "project_id"; Value = "lg-prod-project-123"; Expected = "[GCP_PROJECT_N]" },
  [pscustomobject]@{ Group = "OTC/OpenStack"; Name = "OTC resource"; Value = "otc-prod-de-ecs-001"; Expected = "[OTC_RESOURCE_N]" },
  [pscustomobject]@{ Group = "OTC/OpenStack"; Name = "OpenStack project_id"; Value = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; Expected = "[OPENSTACK_PROJECT_ID_N]" },
  [pscustomobject]@{ Group = "Kubernetes"; Name = "Kubernetes namespace"; Value = "prod-payments"; Expected = "[K8S_NAMESPACE_N]" },
  [pscustomobject]@{ Group = "Kubernetes"; Name = "Kubernetes resource"; Value = "secret/db-password"; Expected = "[K8S_SECRET_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "PRIVATE_IP"; Value = "10.10.20.30"; Expected = "[PRIVATE_IP_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "PRIVATE_CIDR"; Value = "10.10.20.0/24"; Expected = "[PRIVATE_CIDR_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "UNC_PATH"; Value = "\\fs-prod-weu-01\FSA1234567"; Expected = "[UNC_PATH_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "SPN"; Value = "cifs/stdeberfileprd1234567.file.core.windows.net"; Expected = "[SPN_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "LDAP_DN"; Value = "CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local"; Expected = "[LDAP_DN_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "FILE_SHARE"; Value = "FSA1234567"; Expected = "[FILE_SHARE_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "AD_GROUP"; Value = "AD123-SH070-FILE-L-STFSA1234567R"; Expected = "[AD_GROUP_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "HOSTNAME"; Value = "fs-prod-weu-01.corp.local"; Expected = "[HOSTNAME_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "USERNAME"; Value = "CORP\adm-test.user"; Expected = "[USERNAME_N]" },
  [pscustomobject]@{ Group = "Internal"; Name = "EMAIL"; Value = "test.user@example.com"; Expected = "[EMAIL_N]" }
)

$Harmless = @(
  "rg-blue",
  "rg-test",
  "product-roadmap-item",
  "invoice 123456789012",
  "8.8.8.8",
  "192.0.2.44",
  "192.0.2.0/24",
  "docs/page",
  "service/name",
  "random GUID 123e4567-e89b-12d3-a456-426614174000",
  "report.final.docx",
  "package.name"
)

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  Set-Content -Path $Path -Value $Content -Encoding utf8
}

$Header = @"
LeakGuard synthetic enterprise metadata live-site QA upload fixture.
Generated locally by scripts/create-enterprise-live-qa-fixtures.ps1.
All values are fake examples for manual QA only.
"@

$TextLines = @($Header, "")
foreach ($Item in $Sections) {
  if ($Item.Name -eq "FILE_SHARE") {
    $TextLines += "Azure Files share $($Item.Value)"
  } elseif ($Item.Name -eq "EMAIL") {
    $TextLines += "EMAIL=$($Item.Value)"
  } else {
    $TextLines += "$($Item.Name): $($Item.Value)"
  }
}
$TextLines += ""
$TextLines += "Harmless controls:"
$TextLines += $Harmless

$TxtPath = Join-Path $OutputDir "enterprise_metadata_live_qa.txt"
Write-Utf8File -Path $TxtPath -Content ($TextLines -join [Environment]::NewLine)

$MdPath = Join-Path $OutputDir "enterprise_metadata_live_qa.md"
$Markdown = @("# Enterprise Metadata Live QA Synthetic Upload", "", $Header, "", "## Sensitive Synthetic Values", "")
foreach ($Item in $Sections) {
  $Markdown += "- $($Item.Group) / $($Item.Name): $($Item.Value) -> $($Item.Expected)"
}
$Markdown += ""
$Markdown += "## Harmless Controls"
$Markdown += ""
foreach ($Value in $Harmless) {
  $Markdown += "- $Value"
}
Write-Utf8File -Path $MdPath -Content ($Markdown -join [Environment]::NewLine)

$JsonPath = Join-Path $OutputDir "enterprise_metadata_live_qa.json"
$JsonObject = [pscustomobject]@{
  product = "LeakGuard"
  purpose = "synthetic enterprise metadata live-site QA"
  localOnly = $true
  sensitiveSyntheticValues = $Sections
  harmlessControls = $Harmless
}
$JsonObject | ConvertTo-Json -Depth 5 | Set-Content -Path $JsonPath -Encoding utf8

$CsvPath = Join-Path $OutputDir "enterprise_metadata_live_qa.csv"
$Rows = @()
foreach ($Item in $Sections) {
  $Rows += [pscustomobject]@{
    Kind = "sensitive_synthetic"
    Group = $Item.Group
    Name = $Item.Name
    Value = $Item.Value
    Expected = $Item.Expected
  }
}
foreach ($Value in $Harmless) {
  $Rows += [pscustomobject]@{
    Kind = "harmless_control"
    Group = "Harmless"
    Name = "preserve"
    Value = $Value
    Expected = "visible"
  }
}
$Rows | Export-Csv -Path $CsvPath -NoTypeInformation -Encoding utf8

$HtmlPath = Join-Path $OutputDir "enterprise_metadata_live_qa.html"
$HtmlRows = foreach ($Item in $Sections) {
  "<tr><td>$([System.Net.WebUtility]::HtmlEncode($Item.Group))</td><td>$([System.Net.WebUtility]::HtmlEncode($Item.Name))</td><td>$([System.Net.WebUtility]::HtmlEncode($Item.Value))</td><td>$([System.Net.WebUtility]::HtmlEncode($Item.Expected))</td></tr>"
}
$HarmlessItems = foreach ($Value in $Harmless) {
  "<li>$([System.Net.WebUtility]::HtmlEncode($Value))</li>"
}
$Html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>LeakGuard Synthetic Enterprise Metadata Live QA</title>
</head>
<body>
  <h1>LeakGuard Synthetic Enterprise Metadata Live QA</h1>
  <p>Generated locally. All values are fake examples for manual QA only.</p>
  <table>
    <thead><tr><th>Group</th><th>Name</th><th>Value</th><th>Expected</th></tr></thead>
    <tbody>
      $($HtmlRows -join [Environment]::NewLine)
    </tbody>
  </table>
  <h2>Harmless Controls</h2>
  <ul>
    $($HarmlessItems -join [Environment]::NewLine)
  </ul>
</body>
</html>
"@
Write-Utf8File -Path $HtmlPath -Content $Html

@($TxtPath, $MdPath, $JsonPath, $CsvPath, $HtmlPath) | ForEach-Object {
  Write-Output $_
}
