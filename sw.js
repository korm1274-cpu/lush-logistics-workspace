const VERSION = 'lush-logistics-pwa-test-v3';

const DESKTOP_SIDEBAR_PATCH = `
<script id="desktop-sidebar-refresh-fix">
(function () {
  function syncDesktopSidebarStyle() {
    var legacyTopnav = document.getElementById('v70-dark-topnav');
    if (!legacyTopnav) return;
    legacyTopnav.disabled = window.matchMedia('(min-width: 901px)').matches;
  }

  syncDesktopSidebarStyle();
  window.addEventListener('resize', syncDesktopSidebarStyle, { passive: true });
})();
<\/script>
`;

function applyWorkspacePatches(html) {
  // 누계 생산성 / 출고 박스 조회 버튼 명칭 통일
  html = html.replace(
    '<button type="button" class="btn primary status-filter-btn" id="cumSearchBtn">기간 조회</button>',
    '<button type="button" class="btn primary status-filter-btn" id="cumSearchBtn">조회</button>'
  );
  html = html.replace(
    '<button type="button" class="btn primary status-filter-btn" id="boxcountPeriodSearch">기간 조회</button>',
    '<button type="button" class="btn primary status-filter-btn" id="boxcountPeriodSearch">조회</button>'
  );
  html = html.replace(
    '<button type="button" class="btn status-filter-btn" id="boxcountAll">올해 누계</button>',
    '<button type="button" class="btn status-filter-btn" id="boxcountAll">전체 누계</button>'
  );

  // 출고 박스 누계도 생산성 누계와 동일하게 year / custom / all 조회 모드 사용
  html = html.replace(
    "var boxcountPeriod={start:'',end:''};",
    "var boxcountPeriod={start:'',end:''};\n  var boxcountViewMode='year';"
  );

  html = html.replace(
`  function boxcountMonths(){
    var y=today.slice(0,4),cur=Number(today.slice(5,7)),arr=[];
    for(var m=1;m<=cur;m++)arr.push(y+'-'+String(m).padStart(2,'0'));
    var start=boxcountPeriod.start,end=boxcountPeriod.end;
    return arr.filter(function(x){return(!start||x>=start)&&(!end||x<=end)});
  }`,
`  function boxcountMonths(){
    var y=today.slice(0,4),cur=Number(today.slice(5,7)),currentMonth=today.slice(0,7),set={};
    for(var m=1;m<=cur;m++)set[y+'-'+String(m).padStart(2,'0')]=true;
    try{
      if(typeof boxRows==='function'){
        boxRows().forEach(function(r){
          var raw=String(r&&r[0]||'').trim(),match=raw.match(/^(\\d{4})[-/.](\\d{1,2})/);
          if(match)set[match[1]+'-'+String(Number(match[2])).padStart(2,'0')]=true;
        });
      }
    }catch(e){}
    var arr=Object.keys(set).sort(),start=boxcountPeriod.start,end=boxcountPeriod.end;
    if(boxcountViewMode==='all')return arr;
    if(boxcountViewMode==='custom'&&(start||end)){
      return arr.filter(function(x){return(!start||x>=start)&&(!end||x<=end)});
    }
    return arr.filter(function(x){return x.slice(0,4)===y&&x<=currentMonth});
  }`
  );

  html = html.replace(
    "var label=boxcountPeriod.start||boxcountPeriod.end?((boxcountPeriod.start||'최초 월')+' ~ '+(boxcountPeriod.end||'최신 월')):today.slice(0,4)+'년';",
    "var label=boxcountViewMode==='all'?'전체 누계':(boxcountViewMode==='custom'&&(boxcountPeriod.start||boxcountPeriod.end)?((boxcountPeriod.start||'최초 월')+' ~ '+(boxcountPeriod.end||'최신 월')):today.slice(0,4)+'년');"
  );

  html = html.replace(
    "if(q('#boxcountPeriodSearch'))q('#boxcountPeriodSearch').addEventListener('click',function(){var s1=q('#boxcountStartMonth').value||'',e=q('#boxcountEndMonth').value||'';if(!s1||!e){if(typeof toastMsg==='function')toastMsg('시작월과 종료월을 선택해주세요.');return}if(s1>e){var t=s1;s1=e;e=t;q('#boxcountStartMonth').value=s1;q('#boxcountEndMonth').value=e}boxcountPeriod={start:s1,end:e};renderBoxcountCumulative()});",
    "if(q('#boxcountPeriodSearch'))q('#boxcountPeriodSearch').addEventListener('click',function(){var s1=q('#boxcountStartMonth').value||'',e=q('#boxcountEndMonth').value||'';if(s1&&e&&s1>e){var t=s1;s1=e;e=t;q('#boxcountStartMonth').value=s1;q('#boxcountEndMonth').value=e}boxcountPeriod={start:s1,end:e};boxcountViewMode=(s1||e)?'custom':'year';renderBoxcountCumulative()});"
  );

  html = html.replace(
    "if(q('#boxcountAll'))q('#boxcountAll').addEventListener('click',function(){q('#boxcountStartMonth').value='';q('#boxcountEndMonth').value='';boxcountPeriod={start:'',end:''};renderBoxcountCumulative()});",
    "if(q('#boxcountAll'))q('#boxcountAll').addEventListener('click',function(){q('#boxcountStartMonth').value='';q('#boxcountEndMonth').value='';boxcountPeriod={start:'',end:''};boxcountViewMode='all';renderBoxcountCumulative()});"
  );

  return html;
}

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

async function fetchWithWorkspaceFixes(request) {
  const response = await fetch(request);

  if (request.mode !== 'navigate') return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  html = applyWorkspacePatches(html);

  if (!html.includes('desktop-sidebar-refresh-fix')) {
    html = html.replace('</body>', DESKTOP_SIDEBAR_PATCH + '\n</body>');
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetchWithWorkspaceFixes(event.request).catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LUSH Logistics</title><body style="font-family:system-ui;padding:32px"><h2>LUSH Logistics</h2><p>네트워크 연결을 확인해주세요.</p></body>',
      {headers:{'Content-Type':'text/html; charset=utf-8'}}
    ))
  );
});
