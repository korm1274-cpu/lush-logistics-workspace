/* <script> (index.html에서 그대로 옮김) */
const inventoryUndoStack=[];
const MAX_INVENTORY_UNDO=20;
function pushInventoryUndo(a){inventoryUndoStack.push({...a,owner:currentInventoryOwner,date:currentInventoryDate});if(inventoryUndoStack.length>MAX_INVENTORY_UNDO)inventoryUndoStack.shift()}
function clearInventoryUndo(){inventoryUndoStack.length=0}
function cloneInventoryValue(v){return JSON.parse(JSON.stringify(v))}

function normalizeManufactureDate(raw){
  raw=String(raw||"").trim().replace(/[.\-\s]/g,"/");if(!raw)return "";
  const pad=n=>String(n).padStart(2,"0");let m=raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if(m){const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(y,mo-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return null;return `${y}-${pad(mo)}-${pad(d)}`}
  m=raw.match(/^(\d{1,2})\/(\d{1,2})$/);if(!m)return null;
  const today=new Date(),mo=+m[1],d=+m[2];let y=today.getFullYear(),dt=new Date(y,mo-1,d);
  if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return null;
  if(dt>new Date(today.getFullYear(),today.getMonth(),today.getDate()))y--;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

(function(){
  const body=document.getElementById("inventoryBody"),menu=document.getElementById("inventoryContextMenu");
  const addManual=document.getElementById("inventoryAddManual"),addProduct=document.getElementById("inventoryAddProduct"),del=document.getElementById("inventoryRowDelete");
  if(!body||!menu||!addManual||!addProduct||!del)return;
  let targetIndex=null;
  const snap=()=>ownerSnapshot(currentInventoryOwner,currentInventoryDate);
  const hide=()=>{menu.classList.remove("show");targetIndex=null};
  const insert=(item,focusSelector)=>{
    const s=snap();if(!s)return;const index=targetIndex===null?s.products.length:Math.min(targetIndex+1,s.products.length);
    s.products.splice(index,0,item);pushInventoryUndo({type:"add",index});markInventoryDirty();renderInventoryOwner();hide();
    if(focusSelector)setTimeout(()=>document.querySelector(`${focusSelector}[data-p="${index}"]`)?.focus(),0);
  };
  body.addEventListener("contextmenu",e=>{
    const row=e.target.closest("tr[data-inventory-row]");e.preventDefault();targetIndex=row?Number(row.dataset.inventoryRow):null;
    menu.style.left=Math.min(e.clientX,window.innerWidth-270)+"px";menu.style.top=Math.min(e.clientY,window.innerHeight-220)+"px";
    del.style.display=targetIndex===null?"none":"";menu.classList.add("show");
  });
  addManual.onclick=()=>insert({rowType:"manual",id:"",name:"",sourceCategory:"",category:"",system:0,lots:[{date:"",qty:0}]},'[data-product-code]');
  addProduct.onclick=()=>insert({id:"",name:"",sourceCategory:"",category:"",system:0,lots:[{date:"",qty:0}]},'[data-product-code]');
  del.onclick=()=>{if(targetIndex===null)return;if(!confirm("선택한 행을 삭제할까요?"))return;const s=snap();if(!s)return;const index=targetIndex,removed=cloneInventoryValue(s.products[index]);s.products.splice(index,1);pushInventoryUndo({type:"delete",index,item:removed});markInventoryDirty();renderInventoryOwner();hide()};
  document.addEventListener("click",e=>{if(!menu.contains(e.target))hide()});window.addEventListener("scroll",hide,true);window.addEventListener("resize",hide);
  document.addEventListener("keydown",e=>{if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=="z"||e.target.closest("input,textarea,[contenteditable=true]"))return;const a=inventoryUndoStack.at(-1);if(!a)return;if(a.owner!==currentInventoryOwner||a.date!==currentInventoryDate){clearInventoryUndo();return}inventoryUndoStack.pop();const s=snap();if(!s)return;e.preventDefault();if(a.type==="add")s.products.splice(a.index,1);if(a.type==="delete")s.products.splice(Math.min(a.index,s.products.length),0,cloneInventoryValue(a.item));markInventoryDirty();renderInventoryOwner();toastMsg("직전 행 작업을 되돌렸습니다.")});
})();

