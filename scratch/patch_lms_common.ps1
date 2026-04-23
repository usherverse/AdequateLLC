
$path = 'c:\Users\Ushern\Desktop\adequateCapital\lms-prod\src\lms-common.jsx'
$content = Get-Content $path

# 1. Update ADMIN_NAV
# Match: { cat: "Financials", id: "paymentshub", l: "Payments Hub", i: ShieldCheck, c: '#6699FF' },
$navSearch = '{ cat: "Financials", id: "paymentshub", l: "Payments Hub", i: ShieldCheck, c: ''#6699FF'' },'
$navReplace = "$navSearch`n  { cat: ""Financials"", id: ""salary_ledger"", l: ""Salary Ledger"", i: Landmark, c: ''#00D4AA'' },"
$content = $content -replace [regex]::Escape($navSearch), $navReplace

# 2. Update buildReportData signature
$sigSearch = 'export const buildReportData = \(type, \{loans, customers, payments, workers, auditLog\}, filters = \{\}\) => \{'
$sigReplace = "export const buildReportData = (type, data, filters = {}) => {`n  const {loans, customers, payments, workers, auditLog, salaryPayments} = data;"
$content = $content -replace $sigSearch, $sigReplace

# 3. Add salary-payouts report logic
$retSearch = 'return {name:''report'', title:''Report'', hdr:\[\], rows:\[\]};'
$retReplace = @"
  if(type==='salary-payouts') {
    const sList = salaryPayments || [];
    return {name:'salary-payouts', title:'Salary Disbursement Report',
      hdr:['Date','Id','Worker','Amount','Month','Phone','Receipt','Status'],
      rows: sList.map(s => {
        const w = (workers || []).find(x => x.id === s.worker_id);
        return [ts(s.created_at), s.id.slice(0,8), w?.name || 'Unknown', s.amount, s.month, s.recipient_phone, s.mpesa_receipt, s.status];
      })};
  }
  return {name:'report', title:'Report', hdr:[], rows:[]};
"@
$content = $content -replace $retSearch, $retReplace

$content | Set-Content $path
