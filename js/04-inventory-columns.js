/* <script> (index.html에서 그대로 옮김) */
const INVENTORY_COL_WIDTH_KEY="lush_inventory_column_widths_v1";
const INVENTORY_COL_DEFAULTS=[64,118,210,140,92,92,92,118,130];
function inventoryColumnWidths(){try{const x=JSON.parse(localStorage.getItem(INVENTORY_COL_WIDTH_KEY)||"null");return Array.isArray(x)&&x.length===9?x:INVENTORY_COL_DEFAULTS.slice()}catch{return INVENTORY_COL_DEFAULTS.slice()}}
function applyInventoryColumnWidths(){
  const table=document.querySelector("#inventoryOwnerView .inventory-grid");if(!table)return;
  const widths=inventoryColumnWidths();table.style.tableLayout="fixed";
  [...table.querySelectorAll("thead th")].forEach((th,i)=>{if(widths[i])th.style.width=widths[i]+"px"});
}
function initInventoryColumnResize(){
  const table=document.querySelector("#inventoryOwnerView .inventory-grid");if(!table||table.dataset.resizable==="1")return;table.dataset.resizable="1";
  const heads=[...table.querySelectorAll("thead th")];
  heads.forEach((th,i)=>{const h=document.createElement("span");h.className="col-resizer";h.title="드래그하여 열 너비 조절";th.appendChild(h);h.addEventListener("pointerdown",e=>{e.preventDefault();h.setPointerCapture(e.pointerId);const startX=e.clientX,startW=th.getBoundingClientRect().width;document.body.classList.add("resizing-col");const move=ev=>{const widths=inventoryColumnWidths();widths[i]=Math.max(58,Math.round(startW+ev.clientX-startX));localStorage.setItem(INVENTORY_COL_WIDTH_KEY,JSON.stringify(widths));applyInventoryColumnWidths()};const up=()=>{h.removeEventListener("pointermove",move);h.removeEventListener("pointerup",up);h.removeEventListener("pointercancel",up);document.body.classList.remove("resizing-col")};h.addEventListener("pointermove",move);h.addEventListener("pointerup",up);h.addEventListener("pointercancel",up)})});
  applyInventoryColumnWidths();
}
setTimeout(initInventoryColumnResize,0);

