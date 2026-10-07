/* <script id="mobile-chart-legend"> (index.html에서 그대로 옮김) */
/* 휴대폰: 제품군 그래프 범례를 그래프 아래 작은 글씨로 한 번에(누르면 해당 제품군 켜기/끄기) */
window.__mobileChartLegend=function(chart,canvas){
  try{
    var host=canvas.parentElement;if(!host)return;
    var old=host.parentElement.querySelector(':scope > .m-chart-legend[data-for="'+canvas.id+'"]');if(old)old.remove();
    if(!chart||!(window.matchMedia&&window.matchMedia('(max-width:900px)').matches))return;
    var box=document.createElement('div');box.className='m-chart-legend';box.setAttribute('data-for',canvas.id||'');
    chart.data.datasets.forEach(function(ds,i){
      var b=document.createElement('button');b.type='button';
      var dot=document.createElement('i');dot.style.background=ds.borderColor||'#999';b.appendChild(dot);
      b.appendChild(document.createTextNode(ds.label||''));
      b.onclick=function(){var vis=chart.isDatasetVisible(i);chart.setDatasetVisibility(i,!vis);chart.update();b.classList.toggle('off',vis)};
      box.appendChild(b);
    });
    host.insertAdjacentElement('afterend',box);
  }catch(e){}
};

