(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels=[["orders","출고 작업 생성"],["pick","PDA 피킹 작업"],["locations","로케이션·재고"],["das","DAS 분류"],["boxes","박스·출고"],["status","작업 현황판"]];
const stores=[{id:"S01",name:"강남점",A:20,B:10,C:5},{id:"S02",name:"홍대점",A:15,B:10,C:10},{id:"S03",name:"잠실점",A:15,B:10,C:5}];
const products=[{sku:"A",name:"제품 A",code:"SKU-A",zone:"A1",loc:"A1-01-01",order:50},{sku:"B",name:"제품 B",code:"SKU-B",zone:"A1",loc:"A1-02-01",order:30},{sku:"C",name:"제품 C",code:"SKU-C",zone:"B1",loc:"B1-01-01",order:20}];
const initialRacks=[{loc:"A1-01-01",sku:"A",level:1,qty:50},{loc:"A1-01-02",sku:"A",level:2,qty:120},{loc:"A1-02-03",sku:"A",level:3,qty:80},{loc:"B1-03-04",sku:"A",level:4,qty:35},{loc:"A1-02-01",sku:"B",level:1,qty:30},{loc:"A1-02-02",sku:"B",level:2,qty:90},{loc:"B1-01-01",sku:"C",level:1,qty:20},{loc:"B1-02-03",sku:"C",level:3,qty:70}];
const modules={
orders:{selected:["S01","S02","S03"],generated:false,sequence:0,notice:""},
pick:{zone:null,detail:null,scan:"",quantity:"",result:{},notice:""},
locations:{sku:"A",from:"A1-01-02",to:"A1-01-01",amount:"10",racks:initialRacks.map(x=>({...x})),history:[],notice:""},
das:{store:"S01",scans:{},boxes:{},notice:""},
boxes:{store:"S01",selected:"BOX-001",checks:{},notice:""},
status:{scenario:"standard",filter:"all",notice:""}
};
let page="pick";
const btn=(label,action,kind="",disabled=false)=>'<button type="button" class="btn '+kind+'" data-action="'+action+'" '+(disabled?"disabled":"")+'>'+label+'</button>';
const badge=(label,type="")=>'<span class="status '+type+'">'+label+'</span>';
const bar=(done,total)=>'<div class="progress"><span style="width:'+(total?Math.min(100,done/total*100):0)+'%"></span></div>';
const field=(label,id,value,attr="")=>'<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" value="'+esc(value)+'" '+attr+'></div>';
function title(k,h,desc){return '<div class="module-label">'+k+' · INDIVIDUAL SIMULATION</div><h2>'+h+'</h2><p class="muted module-intro">'+desc+'</p>'}
function note(h,lines,foot){return '<div class="note-title"><span class="dot"></span><h3 style="margin:0">'+h+'</h3></div><ol class="steps">'+lines.map(x=>'<li>'+x+'</li>').join("")+'</ol>'+(foot?'<hr class="divider"><p class="hint">'+foot+'</p>':"")}
function footer(){return '<hr class="divider">'+btn("현재 파트 테스트 초기화","reset-module","secondary")+'<p class="hint">각 업무는 독립적인 가상 데이터로 동작하며 다른 파트의 결과를 변경하지 않습니다.</p>'}
function render(){
$("tabs").innerHTML=labels.map((x,i)=>'<button type="button" class="tab '+(page===x[0]?"active":"")+'" data-page="'+x[0]+'"><span class="tab-index">MODULE '+String(i+1).padStart(2,"0")+'</span>'+x[1]+'</button>').join("");
let output=views[page]();$("main").innerHTML=output[0];$("aside").innerHTML=output[1]+footer();
if(page==="pick"&&modules.pick.zone&&!modules.pick.detail){$("scanCode")?.focus()}
}
const views={
orders(){
 const o=modules.orders, chosen=stores.filter(x=>o.selected.includes(x.id)),tot=k=>chosen.reduce((a,b)=>a+b[k],0);
 let m=title("01","출고 작업 생성 · ERP 화면","ERP의 출고지시 화면에서 매장 주문을 선택했을 때, PDA용 SKU 총량 피킹 지시가 어떻게 만들어지는지 검증합니다.");
 m+='<div class="mini"><div class="row"><strong>출고 관리 / 출고지시(본사)</strong>'+badge("가상 주문")+'</div><p class="muted" style="margin-bottom:0">주문 선택 → SKU별 집계 → 피킹리스트 생성</p></div><div class="stack" style="margin-top:13px">'+stores.map(x=>'<label class="card row"><span><input data-order="'+x.id+'" type="checkbox" '+(o.selected.includes(x.id)?"checked":"")+'><strong style="margin-left:8px">'+x.name+'</strong><span class="meta" style="display:block;margin-left:26px">주문 '+(x.A+x.B+x.C)+' EA</span></span>'+badge(x.id)+'</label>').join("")+'</div>';
 m+='<div class="tools">'+btn("피킹리스트 생성","orders-generate","green",!o.selected.length)+btn("선택 초기화","orders-clear","secondary")+'</div>';
 if(o.generated)m+='<div class="inline-message">생성 완료 · DEMO-PICK-'+String(o.sequence).padStart(3,"0")+'<br>매장별 주문을 합산한 SKU별 피킹리스트가 아래에 생성되었습니다. 실제 PDA에는 전송되지 않습니다.</div>';
 m+='<h3 style="margin-top:22px">SKU별 합산 결과</h3><table class="table"><thead><tr><th>로케이션</th><th>제품</th><th>합산 지시</th></tr></thead><tbody>'+products.map(x=>'<tr><td>'+x.loc+'</td><td>'+x.name+'</td><td><b>'+tot(x.sku)+' EA</b></td></tr>').join("")+'</tbody></table>';
 const side=note("해당 파트에서 설명할 내용",["사무실에서 출고 대상 주문을 선택","매장별 제품 수량을 SKU 단위로 자동 합산","제품 마스터·로케이션 정보를 연결해 Zone별 작업 목록 생성","출고 작업번호를 발급하고 피킹리스트 생성"],"시연 버튼은 로컬 화면에서만 작동합니다. 실제 ERP 메뉴 변경 및 자동 전송 기능은 구현하지 않았습니다.");
 return [m,side];
},
pick(){
const p=modules.pick;let m=title("02","PDA 총량 피킹 · 작업자 화면","Zone 선택과 로케이션 스캔을 분리했습니다. 로케이션을 스캔하면 상세 화면으로 이동하고, 수량 확정 후 리스트로 돌아옵니다.");
m+='<div class="pda"><div class="work-screen">';
if(!p.zone){m+='<div class="pda-header"><strong>피킹 지역 선택</strong><small>작업할 Zone을 목록에서 선택하세요.</small></div><div class="stack">';
for(const zone of ["A1","B1"]){const xs=products.filter(x=>x.zone===zone),done=xs.filter(x=>p.result[x.loc]).length,full=xs.filter(x=>p.result[x.loc]?.qty===x.order).length;
m+='<button class="list-row" data-zone="'+zone+'"><span><strong>'+zone+' Zone</strong><span class="meta">피킹 로케이션 '+xs.length+'개 · 확정 '+done+'개</span><span style="display:block;margin-top:9px">'+bar(done,xs.length)+'</span></span>'+badge(done===xs.length?(full===xs.length?"완료":"부족 포함 완료"):done?"진행 중":"대기",done===xs.length?(full===xs.length?"good":"warn"):"")+'</button>'}
m+='</div>'}
else if(!p.detail){const xs=products.filter(x=>x.zone===p.zone);
m+='<div class="pda-header"><div class="row"><strong>'+p.zone+' Zone 피킹리스트</strong>'+btn("지역 선택","pick-back-zone","secondary")+'</div><small>로케이션 바코드를 스캔해 상세 화면을 열어 주세요.</small></div>';
m+='<div class="field"><label for="scanCode">스캔 입력 · 데모</label><div class="scanline"><input id="scanCode" placeholder="로케이션 바코드" value="'+esc(p.scan)+'" autocomplete="off" autocapitalize="characters">'+btn("스캔","pick-scan","green")+'</div></div><p class="hint">목록을 누르면 바코드가 입력되며 Enter 또는 스캔 버튼으로 상세 화면이 열립니다.</p>';
if(p.notice)m+='<div class="alert">'+esc(p.notice)+'</div>';
m+='<div class="location-list">'+xs.map(x=>{const r=p.result[x.loc];return '<button class="location-item '+(r?"done":"")+'" data-pick-fill="'+x.loc+'"><div class="row"><b>'+x.loc+'</b>'+badge(r?(r.qty===x.order?"완료":"부족 확정"):"대기",r?(r.qty===x.order?"good":"warn"):"")+'</div><div class="row"><span class="name">'+x.name+'</span><strong class="number">'+(r?r.qty:0)+'/'+x.order+'</strong></div></button>'}).join("")+'</div>'}
else{const x=products.find(x=>x.loc===p.detail),v=Number(p.quantity),valid=p.quantity.trim()!==""&&Number.isInteger(v)&&v>=0&&v<=x.order,short=valid?x.order-v:null,alts=initialRacks.filter(r=>r.sku===x.sku&&r.loc!==x.loc);
m+='<div class="pda-header row"><div><strong>로케이션 상세 피킹</strong><small>스캔 완료 · '+x.zone+' Zone · 1단</small></div>'+btn("뒤로","pick-back-list","secondary")+'</div><div class="card selected"><div class="muted small">로케이션</div><h2 style="margin:5px 0 2px">'+x.loc+'</h2><div class="muted">'+x.name+' · '+x.code+'</div><div class="row" style="margin-top:12px"><span class="muted">실제 / 지시</span>'+badge("수량 입력")+'</div><div id="liveQty" class="bigqty">'+(valid?v:0)+'/'+x.order+' <span class="small">EA</span></div>';
m+=field("실제 피킹 수량 (EA)","pickQuantity",p.quantity,'class="qty-input" type="number" step="1" min="0" max="'+x.order+'"');
m+='<div class="quick-qty"><button data-qty="target">지시 수량 '+x.order+' 입력</button><button data-qty="minus2">2EA 부족</button><button data-qty="zero">0EA</button></div><div id="pickAlternatives" style="margin-top:15px">'+alternatives(x,short)+'</div><div class="tools">'+btn("피킹 수량 확정 → 리스트 복귀","pick-confirm","green",!valid)+'</div></div>'}
m+='</div></div>';
const side=note("PDA 동작 시나리오",["Zone은 카드가 아닌 세로 리스트로 선택","해당 Zone 전체 로케이션을 스크롤 목록으로 표시","스캔한 로케이션의 상세 정보만 열기","실제 피킹 수량을 0/50 또는 48/50으로 표시","부족 시 동일 SKU의 다른 보관 위치·재고 조회","확정 후 리스트 자동 복귀 및 빗금 표시"],"이 데모의 바코드 입력은 실제 PDA 스캐너 연동이 아닙니다. 실스캔 연동 방식은 단말기 환경에 따라 별도로 개발해야 합니다.");
return [m,side];
},
locations(){
const l=modules.locations,arr=l.racks.filter(x=>x.sku===l.sku),p=products.find(x=>x.sku===l.sku);
let m=title("03","로케이션·재고 조회 및 이동","피킹 위치와 보관 위치를 분리해 보고, 로케이션 간 이동 시 양쪽 재고 수량이 어떻게 바뀌는지 개별적으로 테스트합니다.");
m+='<div class="secondary-tabs">'+products.map(x=>'<button class="pill '+(l.sku===x.sku?"active":"")+'" data-locsku="'+x.sku+'">'+x.name+'</button>').join("")+'</div><h3 style="margin-top:18px">'+p.name+' · 로케이션별 재고</h3><div class="stack">'+arr.map(x=>'<div class="rack-option"><div><strong>'+x.loc+'</strong><div class="muted small">'+x.level+'단 · '+(x.level===1?"피킹":"보관")+'</div></div><strong>'+x.qty+' EA</strong></div>').join("")+'</div>';
m+='<hr class="divider"><h3>로케이션 간 재고 이동 시연</h3><div class="design-grid"><div class="field"><label>출발 로케이션</label><select id="moveFrom">'+arr.map(x=>'<option value="'+x.loc+'" '+(l.from===x.loc?"selected":"")+'>'+x.loc+'</option>').join("")+'</select></div><div class="field"><label>도착 로케이션</label><select id="moveTo">'+arr.map(x=>'<option value="'+x.loc+'" '+(l.to===x.loc?"selected":"")+'>'+x.loc+'</option>').join("")+'</select></div></div>'+field("이동 수량 (EA)","moveAmount",l.amount,'type="number" step="1" min="1"')+'<div class="tools">'+btn("재고 이동 실행 (시연)","loc-move","green")+'</div>'+(l.notice?'<div class="'+(l.notice.startsWith("완료")?"inline-message":"alert")+'">'+esc(l.notice)+'</div>':"");
if(l.history.length)m+='<h3 style="margin-top:18px">현재 파트 이동 이력</h3><div class="stack">'+l.history.map(x=>'<div class="card muted">'+esc(x)+'</div>').join("")+'</div>';
const side=note("로케이션 관리 기준",["파렛트랙 1단은 피킹 대상","2~4단은 보관 대상","SKU에 연결된 모든 로케이션·수량을 조회","이동 시 출발 재고 차감, 도착 재고 증가","재고 부족·동일 위치 이동은 차단"],"현재는 독립된 가상 재고를 수정합니다. 실제 ERP 재고 및 다른 파트의 피킹 지시는 변경하지 않습니다.");
return [m,side];
},
das(){
const d=modules.das,st=stores.find(x=>x.id===d.store),done=d.scans[d.store]||{};
let m=title("04","DAS 매장별 분류 · 업체 업무","업체가 수행하는 분류 업무를 실제 설비 없이 화면으로 설명합니다. 주문 수신·SKU별 투입·매장 박스 완료의 개념 시연입니다.");
m+='<div class="field"><label>분류 대상 매장</label><select id="dasStore">'+stores.map(x=>'<option value="'+x.id+'" '+(d.store===x.id?"selected":"")+'>'+x.name+'</option>').join("")+'</select></div><div class="mini"><div class="row"><strong>'+st.name+' 모의 주문서</strong>'+badge("업체 시스템 영역")+'</div><p class="muted small" style="margin-bottom:0">제품별 주문 수량을 매장별로 구분하는 예시입니다.</p></div><div class="stack" style="margin-top:12px">'+products.map(x=>{const n=st[x.sku],v=done[x.sku]||0;return '<div class="card"><div class="row"><div><strong>'+x.name+'</strong><div class="muted small">'+x.code+'</div></div><strong class="number">'+v+'/'+n+'</strong></div>'+bar(v,n)+'<div class="tools">'+btn("1EA 투입","das-add-"+x.sku,"secondary",v>=n||!!d.boxes[d.store])+btn("잔량 투입","das-all-"+x.sku,"secondary",v>=n||!!d.boxes[d.store])+'</div></div>'}).join("")+'</div><div class="tools">'+btn("매장 박스 분류 완료","das-close","green",!!d.boxes[d.store]||products.some(x=>(done[x.sku]||0)!==st[x.sku]))+btn("현재 매장 재시작","das-reset","secondary")+'</div>'+(d.boxes[d.store]?'<div class="inline-message">가상 분류 완료 · '+d.boxes[d.store]+'<br>제품별 수량과 박스 번호가 생성되었습니다.</div>':"");
const side=note("업체 측 기능 설명",["매장별 주문 수신","투입한 SKU를 매장별로 분류","분류 실적을 제품·매장별로 집계","박스 식별번호와 내품 정보 생성","사내 시스템으로 완료 데이터 제공"],"실제 설비 LED 및 소터 동작의 재현이 아닙니다. 사내 ERP·PDA 데이터와 연결하지 않은 독립 시연입니다.");
return [m,side];
},
boxes(){
const b=modules.boxes,st=stores.find(x=>x.id===b.store),name="BOX-"+b.store;
let m=title("05","박스 내품 확인 · 출고 검수","박스 바코드를 읽으면 내품 목록을 열고, 작업자가 항목을 확인해 검수 완료 처리하는 화면 예시입니다.");
m+='<div class="field"><label>매장 선택</label><select id="boxStore">'+stores.map(x=>'<option value="'+x.id+'" '+(b.store===x.id?"selected":"")+'>'+x.name+'</option>').join("")+'</select></div><div class="mini row"><div><strong>'+name+'</strong><div class="muted small">'+st.name+' · 가상 박스</div></div>'+badge(products.every(x=>b.checks[st.id+"-"+x.sku])?"검수 완료":"검수 중",products.every(x=>b.checks[st.id+"-"+x.sku])?"good":"")+'</div><h3 style="margin-top:18px">박스 내품 상세</h3><div class="stack">'+products.map(x=>'<label class="card row"><span><input type="checkbox" data-boxcheck="'+st.id+"-"+x.sku+'" '+(b.checks[st.id+"-"+x.sku]?"checked":"")+'><strong style="margin-left:8px">'+x.name+'</strong></span><strong>'+st[x.sku]+' EA</strong></label>').join("")+'</div><div class="metric" style="margin-top:13px"><span class="muted">검수 상태</span><strong>'+products.filter(x=>b.checks[st.id+"-"+x.sku]).length+'/'+products.length+' 항목</strong></div><div class="tools">'+btn("전체 항목 검수 확인","box-check-all","green")+btn("현재 매장 검수 초기화","box-clear","secondary")+'</div>';
const side=note("박스 업무 정의",["바코드의 박스 ID로 해당 박스를 조회","매장코드·매장명·내품 SKU·수량 표시","내품 확인 완료 기록","실제 출고 확정 및 ERP 전표 처리는 별도 협의"],"현재 박스 번호는 가상 번호입니다. 실제 바코드에는 박스 ID만 넣고 내품 정보는 시스템 조회로 제공하는 방안을 검토할 수 있습니다.");
return [m,side];
},
status(){
const v=modules.status;const statuses=v.scenario==="standard"?[["출고 주문","완료"],["총량 피킹","진행 중"],["DAS 분류","대기"],["박스 출고","대기"]]:v.scenario==="short"?[["출고 주문","완료"],["총량 피킹","부족 2EA"],["DAS 분류","대기"],["박스 출고","대기"]]:[["출고 주문","완료"],["총량 피킹","완료"],["DAS 분류","완료"],["박스 출고","완료"]];
let m=title("06","작업 현황판 · 보고 화면","다른 메뉴의 작업을 이어받지 않고, 정상·피킹 부족·전체 완료의 세 가지 상황을 선택해 현황 표시 방식을 검토합니다.");
m+='<div class="secondary-tabs">'+[["standard","기본 진행"],["short","수량 부족"],["complete","전체 완료"]].map(x=>'<button class="pill '+(v.scenario===x[0]?"active":"")+'" data-scenario="'+x[0]+'">'+x[1]+'</button>').join("")+'</div><div class="stats" style="margin-top:19px"><div class="stat"><small>출고 주문</small><b>3건</b></div><div class="stat"><small>피킹 확정</small><b>'+(v.scenario==="complete"?"100%":v.scenario==="short"?"98%":"65%")+'</b></div><div class="stat"><small>DAS 진행</small><b>'+(v.scenario==="complete"?"100%":"0%")+'</b></div></div><h3 style="margin-top:22px">업무별 상태 예시</h3><div class="stack">'+statuses.map(x=>'<div class="card row"><strong>'+x[0]+'</strong>'+badge(x[1],x[1]==="완료"?"good":x[1].includes("부족")?"warn":"")+'</div>').join("")+'</div>';
const side=note("현황판 검토 항목",["사무실에서 단계별 처리 상태 확인","피킹 부족·정상 완료를 색상과 문구로 구분","출고 대상 매장 및 SKU별 실적 조회 방향 검토","시스템 오류·중복 처리 여부의 모니터링 기준 정의"],"선택한 시나리오는 현황판에만 반영되며 다른 5개 화면에 영향을 주지 않습니다.");
return [m,side];
}
};
function alternatives(x,short){if(short===null)return '<p class="hint">0부터 지시 수량까지의 정수를 입력해 주세요.</p>';if(short===0)return '<div class="inline-message">지시 수량을 전량 피킹했습니다.</div>';const xs=initialRacks.filter(r=>r.sku===x.sku&&r.loc!==x.loc);return '<div class="alert"><b>부족 수량 '+short+' EA</b> · 동일 제품의 다른 로케이션 조회</div><div class="stack" style="margin-top:9px">'+(xs.length?xs.map(a=>'<div class="stock row"><span><strong>'+a.loc+'</strong><span class="meta" style="display:block">'+a.level+'단 · 보관</span></span><b>'+a.qty+' EA</b></div>').join(""):'<div class="hint">다른 보관 로케이션이 등록되어 있지 않습니다.</div>')+'</div>'}
function syncQty(){const p=modules.pick,x=products.find(x=>x.loc===p.detail),val=Number(p.quantity),valid=p.quantity.trim()!==""&&Number.isInteger(val)&&val>=0&&val<=x.order;$("liveQty").innerHTML=(valid?val:0)+"/"+x.order+' <span class="small">EA</span>';$("pickAlternatives").innerHTML=alternatives(x,valid?x.order-val:null);const b=document.querySelector('[data-action="pick-confirm"]');if(b)b.disabled=!valid}
function resetPart(){if(page==="orders")modules.orders={selected:["S01","S02","S03"],generated:false,sequence:0,notice:""};if(page==="pick")modules.pick={zone:null,detail:null,scan:"",quantity:"",result:{},notice:""};if(page==="locations")modules.locations={sku:"A",from:"A1-01-02",to:"A1-01-01",amount:"10",racks:initialRacks.map(x=>({...x})),history:[],notice:""};if(page==="das")modules.das={store:"S01",scans:{},boxes:{},notice:""};if(page==="boxes")modules.boxes={store:"S01",selected:"BOX-001",checks:{},notice:""};if(page==="status")modules.status={scenario:"standard",filter:"all",notice:""};render()}
document.addEventListener("click",ev=>{
const tab=ev.target.closest("[data-page]");if(tab){page=tab.dataset.page;render();return}
const zone=ev.target.closest("[data-zone]");if(zone){modules.pick.zone=zone.dataset.zone;render();return}
const locSku=ev.target.closest("[data-locsku]");if(locSku){const l=modules.locations;l.sku=locSku.dataset.locsku;const items=l.racks.filter(x=>x.sku===l.sku);l.from=(items.find(x=>x.level>1)||items[0]).loc;l.to=(items.find(x=>x.level===1)||items[0]).loc;l.notice="";render();return}
const fill=ev.target.closest("[data-pick-fill]");if(fill){const el=$("scanCode");if(el){el.value=fill.dataset.pickFill;modules.pick.scan=el.value;el.focus()}return}
const scenario=ev.target.closest("[data-scenario]");if(scenario){modules.status.scenario=scenario.dataset.scenario;render();return}
const preset=ev.target.closest("[data-qty]");if(preset){const p=modules.pick,x=products.find(x=>x.loc===p.detail);p.quantity=String(preset.dataset.qty==="target"?x.order:preset.dataset.qty==="minus2"?Math.max(0,x.order-2):0);$("pickQuantity").value=p.quantity;syncQty();return}
const action=ev.target.closest("[data-action]");if(!action)return;
const a=action.dataset.action,o=modules.orders,p=modules.pick,l=modules.locations,d=modules.das,b=modules.boxes;
if(a==="reset-module"){resetPart();return}
if(a==="orders-generate"){o.generated=true;o.sequence++;render();return}
if(a==="orders-clear"){o.selected=[];o.generated=false;render();return}
if(a==="pick-back-zone"){p.zone=null;p.detail=null;p.notice="";render();return}
if(a==="pick-back-list"){p.detail=null;render();return}
if(a==="pick-scan"){const raw=($("scanCode")?.value||"").trim().toUpperCase();const x=products.find(y=>y.zone===p.zone&&y.loc===raw);if(!x){p.notice="현재 Zone의 피킹리스트에 등록되지 않은 로케이션입니다.";render();return}p.detail=x.loc;p.scan="";p.notice="";p.quantity=String(p.result[x.loc]?.qty??0);render();return}
if(a==="pick-confirm"){const x=products.find(y=>y.loc===p.detail),raw=$("pickQuantity")?.value||"",n=Number(raw);if(!raw.trim()||!Number.isInteger(n)||n<0||n>x.order)return;p.result[x.loc]={qty:n};p.detail=null;p.scan="";p.notice="";render();return}
if(a==="loc-move"){const from=$("moveFrom")?.value,to=$("moveTo")?.value,raw=$("moveAmount")?.value||"",n=Number(raw),src=l.racks.find(x=>x.loc===from&&x.sku===l.sku),dst=l.racks.find(x=>x.loc===to&&x.sku===l.sku);l.from=from;l.to=to;l.amount=raw;if(!src||!dst||from===to||!Number.isInteger(n)||n<=0){l.notice="서로 다른 로케이션과 1EA 이상의 정수 수량을 선택해 주세요.";render();return}if(src.qty<n){l.notice="출발 로케이션의 재고가 이동 수량보다 부족합니다.";render();return}src.qty-=n;dst.qty+=n;l.notice="완료 · "+n+"EA 재고 이동";l.history.unshift(from+" → "+to+" · "+n+" EA");render();return}
if(a==="das-reset"){d.scans[d.store]={};delete d.boxes[d.store];render();return}
if(a.startsWith("das-add-")||a.startsWith("das-all-")){const all=a.startsWith("das-all-"),sku=a.slice(8),st=stores.find(x=>x.id===d.store);if(!st||d.boxes[d.store])return;const rec=d.scans[d.store]||(d.scans[d.store]={});rec[sku]=Math.min(st[sku],(rec[sku]||0)+(all?st[sku]:1));render();return}
if(a==="das-close"){const st=stores.find(x=>x.id===d.store),rec=d.scans[d.store]||{};if(products.some(x=>(rec[x.sku]||0)!==st[x.sku]))return;d.boxes[d.store]="BOX-"+d.store;render();return}
if(a==="box-check-all"){products.forEach(x=>b.checks[b.store+"-"+x.sku]=true);render();return}
if(a==="box-clear"){products.forEach(x=>delete b.checks[b.store+"-"+x.sku]);render();return}
});
document.addEventListener("input",ev=>{if(ev.target.id==="pickQuantity"){modules.pick.quantity=ev.target.value;syncQty()}if(ev.target.id==="scanCode")modules.pick.scan=ev.target.value});
document.addEventListener("change",ev=>{
const t=ev.target;
if(t.matches("[data-order]")){const o=modules.orders,id=t.dataset.order;o.selected=t.checked?[...new Set([...o.selected,id])]:o.selected.filter(x=>x!==id);o.generated=false;render();return}
if(t.id==="moveFrom"){modules.locations.from=t.value;return}if(t.id==="moveTo"){modules.locations.to=t.value;return}if(t.id==="moveAmount"){modules.locations.amount=t.value;return}
if(t.id==="dasStore"){modules.das.store=t.value;render();return}if(t.id==="boxStore"){modules.boxes.store=t.value;render();return}
if(t.matches("[data-boxcheck]")){modules.boxes.checks[t.dataset.boxcheck]=t.checked;render();return}
});
document.addEventListener("keydown",ev=>{if(ev.key==="Enter"&&ev.target.id==="scanCode"){ev.preventDefault();document.querySelector('[data-action="pick-scan"]')?.click()}});
render();
})();