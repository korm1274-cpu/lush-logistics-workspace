/* <script id="mobile-chart-legend"> (index.html에서 그대로 옮김) */
/* 휴대폰: 제품군 그래프 범례를 그래프 아래 작은 글씨로 한 번에(누르면 해당 제품군 켜기/끄기)
   opts.focus: 누르면 그 제품군 선만 진하게(나머지는 연한 회색) + 최고·최저 숫자 표시, 다시 누르면 전체 */
window.__mobileChartLegend=function(chart,canvas,opts){
  try{
    var host=canvas.parentElement;if(!host)return;
    var old=host.parentElement.querySelector(':scope > .m-chart-legend[data-for="'+canvas.id+'"]');if(old)old.remove();
    if(!chart||!(window.matchMedia&&window.matchMedia('(max-width:900px)').matches))return;
    var focus=!!(opts&&opts.focus);
    var box=document.createElement('div');box.className='m-chart-legend'+(focus?' m-chart-focus':'');box.setAttribute('data-for',canvas.id||'');
    var btns=[];
    function applyFocus(){
      var f=chart.$focus;
      chart.data.datasets.forEach(function(ds,i){
        if(!ds._c)ds._c=ds.borderColor;
        var on=f==null||f===i;
        ds.borderColor=ds.backgroundColor=on?ds._c:'#dcd8d0';
        ds.borderWidth=f===i?3.5:(on?2.5:1.5);
        ds.pointRadius=f===i?4:(on?3:0);
        ds.order=f===i?0:1;
      });
      btns.forEach(function(b,i){b.classList.toggle('on',f===i);b.classList.toggle('dim',f!=null&&f!==i)});
      if(hint)hint.textContent=f==null?'제품군을 누르면 그 선만 진하게 볼 수 있어요':'다시 누르면 전체 보기';
      chart.update();
    }
    chart.data.datasets.forEach(function(ds,i){
      var b=document.createElement('button');b.type='button';
      var dot=document.createElement('i');dot.style.background=ds._c||ds.borderColor||'#999';b.appendChild(dot);
      b.appendChild(document.createTextNode(ds.label||''));
      b.onclick=focus
        ?function(){chart.$focus=chart.$focus===i?null:i;applyFocus()}
        :function(){var vis=chart.isDatasetVisible(i);chart.setDatasetVisibility(i,!vis);chart.update();b.classList.toggle('off',vis)};
      btns.push(b);box.appendChild(b);
    });
    var hint=null;
    if(focus){hint=document.createElement('small');hint.className='m-chart-hint';box.appendChild(hint);chart.$focus=null;applyFocus()}
    host.insertAdjacentElement('afterend',box);
  }catch(e){}
};
