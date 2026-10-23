// Resize actual computed text, including px-based rules, instead of only the root.
module.exports=async function textResize(page,factor=2){
 await page.evaluate(factor=>{const text=[...document.querySelectorAll('body *')].filter(e=>e instanceof HTMLElement).map(e=>{const s=getComputedStyle(e);return{e,size:parseFloat(s.fontSize),line:parseFloat(s.lineHeight)}});for(const{e,size,line}of text){e.style.setProperty('font-size',`${size*factor}px`,'important');if(Number.isFinite(line))e.style.setProperty('line-height',`${line*factor}px`,'important');}},factor);
};
