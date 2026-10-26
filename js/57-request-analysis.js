/* 트래픽 출고 요청 › 기간별 출고 요청 현황 아래: 매장별 분석 · 요청 구분별 분석
   - 기준: 위 시작일·종료일(요청일자가 기간에 포함된 요청, 처리 여부 상관없이) — 기간별 현황 숫자와 같은 기준
   - 매장별: 구분(전체/대량/트래픽/본사/노즐) 칩을 고르면 그 구분 건수로 매장 순위·비율(그 구분 전체 중 몇 %)
   - 구분별: 구분마다 건수·비율·매장 수·가장 많은 매장·처리완료율
   - 데이터: localStorage 'lush_outbound_requests_v1' (js/14-v52-outbound-request-manager.js와 같음) */
(function(){
  var KEY='lush_outbound_requests_v1';
  var TYPES=[['bulk','대량 주문'],['traffic','트래픽'],['hq','본사 출고'],['nozzle','노즐/비닐']];
  var $=function(id){return document.getElementById(id)};
  var pick='',showAll=false;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function read(){try{var a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
  function pct(n,t){return t?(Math.round(n/t*1000)/10)+'%':'0%'}
  function typeName(t){var x=TYPES.find(function(y){return y[0]===t});return x?x[1]:(t||'기타')}
  function storeOf(r){return String(r.storeName||'').trim()||'(매장명 없음)'}
  // 위 기간별 현황과 같은 기준: 요청일자 중 하나라도 기간 안이면 포함
  function inPeriod(){
    var st=($('requestPeriodStart')||{}).value||'',en=($('requestPeriodEnd')||{}).value||'';
    return read().filter(function(r){return (r.requestDates||[]).some(function(d){return (!st||d>=st)&&(!en||d<=en)})});
  }
  function ensureBox(){
    var box=$('reqAnalysis');if(box)return box;
    var foot=$('requestPeriodCaption');if(!foot)return null;
    box=document.createElement('div');box.id='reqAnalysis';box.className='rqa';
    foot.parentNode.insertBefore(box,foot.nextSibling);
    box.addEventListener('click',function(e){
      var c=e.target.closest('[data-rqa-type]');if(c){pick=c.getAttribute('data-rqa-type');showAll=false;render();return}
      if(e.target.closest('[data-rqa-more]')){showAll=!showAll;render()}
    });
    return box;
  }
  function render(){
    var box=ensureBox();if(!box)return;
    var list=inPeriod(),total=list.length;
    if(!total){box.innerHTML='<div class="rqa-empty">이 기간에 출고 요청이 없어 분석할 내용이 없습니다.</div>';return}
    var target=pick?list.filter(function(r){return r.type===pick}):list,tTotal=target.length;
    // 매장별
    var stores={};
    list.forEach(function(r){var k=storeOf(r),s=stores[k]||(stores[k]={name:k,all:0,bulk:0,traffic:0,hq:0,nozzle:0});s.all++;if(s[r.type]!=null)s[r.type]++});
    var key=pick||'all',rows=Object.keys(stores).map(function(k){return stores[k]}).filter(function(s){return s[key]>0}).sort(function(a,b){return b[key]-a[key]||b.all-a.all||a.name.localeCompare(b.name,'ko')});
    var top=rows[0],max=top?top[key]:0,label=pick?typeName(pick):'전체';
    var chips='<div class="rqa-chips"><button type="button" class="rqa-chip'+(pick?'':' on')+'" data-rqa-type="">전체 <em>'+total+'</em></button>'+TYPES.map(function(t){var n=list.filter(function(r){return r.type===t[0]}).length;return '<button type="button" class="rqa-chip'+(pick===t[0]?' on':'')+(n?'':' zero')+'" data-rqa-type="'+t[0]+'">'+t[1]+' <em>'+n+'</em></button>'}).join('')+'</div>';
    // 1위가 여러 매장(같은 건수)이면 함께 표시
    var ties=top?rows.filter(function(s){return s[key]===max}).map(function(s){return s.name}):[];
    var headline=top?'<div class="rqa-top"><span class="rqa-top-badge">'+(ties.length>1?'공동 1위':'1위')+'</span><b>'+esc(ties.join(' · '))+'</b> · '+esc(label)+' <b>'+top[key]+'건</b> <span class="rqa-top-pct">('+label+' '+tTotal+'건 중 '+(ties.length>1?'각 ':'')+pct(top[key],tTotal)+')</span></div>':'<div class="rqa-top rqa-muted">이 기간에 '+esc(label)+' 요청이 없습니다.</div>';
    var shown=showAll?rows:rows.slice(0,10);
    var table=rows.length?'<div class="rqa-table-wrap"><table class="rqa-table"><thead><tr><th class="rqa-rank">순위</th><th>매장</th><th class="rqa-n">'+esc(label)+'</th><th class="rqa-bar-h">비율</th>'+(pick?'':TYPES.map(function(t){return '<th class="rqa-n rqa-sub">'+t[1]+'</th>'}).join(''))+'</tr></thead><tbody>'+
      shown.map(function(s,i){var v=s[key];return '<tr'+(i===0?' class="rqa-first"':'')+'><td class="rqa-rank">'+(i+1)+'</td><td class="rqa-store">'+esc(s.name)+'</td><td class="rqa-n"><b>'+v+'</b>건</td><td class="rqa-bar-td"><div class="rqa-bar-c"><span class="rqa-bar"><i style="width:'+(max?Math.max(4,Math.round(v/max*100)):0)+'%"></i></span><span class="rqa-pct">'+pct(v,tTotal)+'</span></div></td>'+(pick?'':TYPES.map(function(t){return '<td class="rqa-n rqa-sub">'+(s[t[0]]||'<span class="rqa-zero">-</span>')+'</td>'}).join(''))+'</tr>'}).join('')+
      '</tbody></table></div>'+(rows.length>10?'<button type="button" class="rqa-more" data-rqa-more>'+(showAll?'상위 10개만 보기':'전체 '+rows.length+'개 매장 보기')+'</button>':''):'';
    // 구분별
    var typeRows=TYPES.map(function(t){
      var a=list.filter(function(r){return r.type===t[0]}),n=a.length,st={};
      a.forEach(function(r){var k=storeOf(r);st[k]=(st[k]||0)+1});
      var best=Object.keys(st).sort(function(x,y){return st[y]-st[x]||x.localeCompare(y,'ko')})[0];
      var done=a.filter(function(r){return r.status==='처리완료'}).length;
      return{key:t[0],name:t[1],n:n,stores:Object.keys(st).length,best:best,bestN:best?st[best]:0,done:done};
    });
    var tmax=Math.max.apply(null,typeRows.map(function(t){return t.n}).concat([1]));
    var typeHtml='<div class="rqa-types">'+typeRows.map(function(t){
      return '<div class="rqa-type rqa-'+t.key+'"><div class="rqa-type-head"><b>'+t.name+'</b><span><strong>'+t.n+'</strong>건 · '+pct(t.n,total)+'</span></div>'+
        '<span class="rqa-bar"><i style="width:'+(t.n?Math.max(4,Math.round(t.n/tmax*100)):0)+'%"></i></span>'+
        '<dl><div><dt>요청 매장</dt><dd>'+t.stores+'곳</dd></div><div><dt>가장 많은 매장</dt><dd>'+(t.best?esc(t.best)+' '+t.bestN+'건 ('+pct(t.bestN,t.n)+')':'-')+'</dd></div><div><dt>처리완료</dt><dd>'+t.done+'/'+t.n+'건'+(t.n?' ('+pct(t.done,t.n)+')':'')+'</dd></div></dl></div>';
    }).join('')+'</div>';
    box.innerHTML='<div class="rqa-grid">'+
      '<section class="rqa-card"><div class="rqa-head"><h4>매장별 분석</h4><small>'+Object.keys(stores).length+'개 매장 · 요청 '+total+'건</small></div>'+chips+headline+table+'</section>'+
      '<section class="rqa-card"><div class="rqa-head"><h4>요청 구분별 분석</h4><small>전체 '+total+'건 기준 비율</small></div>'+typeHtml+'</section>'+
    '</div>';
  }
  function init(){
    if(!$('requestPeriodCaption'))return;
    var btn=$('requestPeriodApplyBtn');if(btn)btn.addEventListener('click',function(){setTimeout(render,0)});
    // 기간별 현황 숫자가 다시 그려질 때(요청 등록·수정·처리, 기간 변경) 같이 갱신
    var tot=$('requestPeriodTotal');if(tot)new MutationObserver(function(){render()}).observe(tot,{childList:true,characterData:true,subtree:true});
    var cap=$('requestPeriodCaption');if(cap)new MutationObserver(function(){render()}).observe(cap,{childList:true,characterData:true,subtree:true});
    window.addEventListener('storage',function(e){if(e.key===KEY)render()});
    render();
  }
  window.renderRequestAnalysis=function(){render()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
