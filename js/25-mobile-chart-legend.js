/* <script id="mobile-chart-legend"> (index.html에서 그대로 옮김) */
/* 제품군 그래프 범례: 누르면 그 제품군 선만 진하게(나머지는 연한 회색) + 최고·최저 숫자 표시, 다시 누르면 전체
   - PC: 그래프 아래 Chart.js 범례를 누르면 window.__chartFocus
   - 휴대폰: 그래프 아래 작은 칩(opts.focus) / 칩 없이 켜기·끄기만 하는 옛 방식도 남김 */
window.__chartFocus=function(chart,i){
  try{
    chart.$focus=(i==null||chart.$focus===i)?null:i;
    var f=chart.$focus;
    chart.data.datasets.forEach(function(ds,k){
      if(!ds._c)ds._c=ds.borderColor;
      var on=f==null||f===k;
      ds.borderColor=ds.backgroundColor=on?ds._c:'#dcd8d0';
      ds.borderWidth=f===k?3.5:(on?2.5:1.5);
      ds.pointRadius=f===k?4:(on?3:0);
      ds.order=f===k?0:1;
    });
    chart.update();
    if(chart.$legendSync)chart.$legendSync();
  }catch(e){}
};
window.__mobileChartLegend=function(chart,canvas,opts){
  try{
    var host=canvas.parentElement;if(!host)return;
    var old=host.parentElement.querySelector(':scope > .m-chart-legend[data-for="'+canvas.id+'"]');if(old)old.remove();
    if(!chart||!(window.matchMedia&&window.matchMedia('(max-width:900px)').matches))return;
    var focus=!!(opts&&opts.focus);
    var box=document.createElement('div');box.className='m-chart-legend'+(focus?' m-chart-focus':'');box.setAttribute('data-for',canvas.id||'');
    var btns=[],hint=null;
    chart.data.datasets.forEach(function(ds,i){
      var b=document.createElement('button');b.type='button';
      var dot=document.createElement('i');dot.style.background=ds._c||ds.borderColor||'#999';b.appendChild(dot);
      b.appendChild(document.createTextNode(ds.label||''));
      b.onclick=focus
        ?function(){window.__chartFocus(chart,i)}
        :function(){var vis=chart.isDatasetVisible(i);chart.setDatasetVisibility(i,!vis);chart.update();b.classList.toggle('off',vis)};
      btns.push(b);box.appendChild(b);
    });
    if(focus){
      hint=document.createElement('small');hint.className='m-chart-hint';box.appendChild(hint);
      chart.$legendSync=function(){
        var f=chart.$focus;
        btns.forEach(function(b,i){b.classList.toggle('on',f===i);b.classList.toggle('dim',f!=null&&f!==i)});
        hint.textContent=f==null?'제품군을 누르면 그 선만 진하게 볼 수 있어요':'다시 누르면 전체 보기';
      };
      chart.$legendSync();
    }
    host.insertAdjacentElement('afterend',box);
  }catch(e){}
};
