/* <script> (index.html에서 그대로 옮김) */
(function(){
  function syncCompletedField(input){
    if(!input)return;
    const hasValue=String(input.value??"").trim()!=="";
    input.classList.toggle("field-complete",hasValue);
  }

  function scanCompletedFields(root=document){
    root.querySelectorAll(
      '.inventory-grid input[data-product-code], .inventory-grid input[data-lot-date], .inventory-grid input[data-lot-qty]'
    ).forEach(syncCompletedField);
  }

  scanCompletedFields();

  document.addEventListener("input",function(e){
    if(e.target.matches(
      '.inventory-grid input[data-product-code], .inventory-grid input[data-lot-date], .inventory-grid input[data-lot-qty]'
    )){
      syncCompletedField(e.target);
    }
  },true);

  document.addEventListener("blur",function(e){
    if(e.target.matches(
      '.inventory-grid input[data-product-code], .inventory-grid input[data-lot-date], .inventory-grid input[data-lot-qty]'
    )){
      syncCompletedField(e.target);
    }
  },true);

  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      for(const node of mutation.addedNodes){
        if(node.nodeType===1){
          if(node.matches?.('.inventory-grid input'))syncCompletedField(node);
          scanCompletedFields(node);
        }
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();

