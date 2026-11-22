figma.showUI(__html__, {width:332,height:670,themeColors:true});
let desk,phone,arrow,last='',direction=Object.assign({},SC.initial),active=false;
const fonts={Title:{family:'Inter',style:'Black'},normal:{family:'Inter',style:'Regular'}};
function paint(hex){return [{type:'SOLID',color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}}]}
function hex(n,fallback){const p=Array.isArray(n.fills)&&n.fills[0];if(!p||p.type!=='SOLID')return fallback;return '#'+['r','g','b'].map(k=>Math.round(p.color[k]*255).toString(16).padStart(2,'0')).join('')}
function drawFrame(scene,name,x,y) {
  const frame=figma.createFrame();frame.name=name;frame.resize(scene.width,scene.height);frame.x=x;frame.y=y;frame.fills=paint(scene.bg);frame.clipsContent=true;
  for(const role of SC.roles){
    const v=scene.layers[role];
    let n;
    if(role==='Hero'){n=figma.createNodeFromSvg(SC.art(v.fill));n.rescale(v.w/n.width)}
    else {n=figma.createText();n.fontName=role==='Title'?fonts.Title:fonts.normal;n.characters=v.text;
      n.fontSize=v.size;n.lineHeight={unit:'PERCENT',value:role==='Title'?92:110};n.textAutoResize='HEIGHT';n.resize(v.w,n.height);n.textAlignHorizontal=v.align==='right'?'RIGHT':'LEFT';n.fills=paint(v.fill)}
    frame.appendChild(n);n.name=role;n.x=v.x;n.y=v.y;
  }
  return frame;
}
function read(){
  const s=SC.base();s.bg=hex(desk,s.bg);s.width=desk.width;s.height=desk.height;
  for(const role of SC.roles){const n=desk.children.find(c=>c.name===role);if(!n)throw Error('Restore the '+role+' layer to resume.');
    const v=s.layers[role];Object.assign(v,{x:n.x,y:n.y,w:n.width,h:n.height});
    if(n.type==='TEXT'){v.text=n.characters;v.size=typeof n.fontSize==='number'?n.fontSize:v.size;v.fill=hex(n,v.fill)}
  }return s;
}
function cursor(x,y){
  if(!arrow||arrow.removed){arrow=figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="32"><path d="M2 2L25 16L15 18L10 29Z" fill="#7A47E7" stroke="white" stroke-width="2"/></svg>');arrow.name='Iris · pointer';arrow.locked=true}
  figma.currentPage.appendChild(arrow);arrow.x=x;arrow.y=y;
}
function render(force,focus) {
  if(!active||!desk||desk.removed)return;
  const s=read(),sig=JSON.stringify(s)+JSON.stringify(direction);if(!force&&sig===last)return;
  const m=SC.mobile(s,direction);
  // Clone the real hero so the proposal preserves vector edits and fills.
  const fresh=drawFrame(m,'Mobile · proposal',desk.x+desk.width+84,desk.y);
  const placeholder=fresh.children.find(n=>n.name==='Hero'), art=desk.children.find(n=>n.name==='Hero').clone();
  fresh.insertChild(1,art);art.rescale(m.layers.Hero.w/art.width);art.x=placeholder.x;art.y=placeholder.y;placeholder.remove();
  if(phone&&!phone.removed)phone.remove();phone=fresh;last=sig;
  const target=m.layers[focus]||m.layers.Title;cursor(phone.x+target.x+8,phone.y+target.y+8);
  figma.ui.postMessage({kind:'scene',source:s});
}
let failure='';
function tick(){try{render(false);failure=''}catch(e){if(String(e)!==failure){failure=String(e);figma.ui.postMessage({kind:'error',text:failure})}}}
async function startSample(){
  await Promise.all([figma.loadFontAsync(fonts.Title),figma.loadFontAsync(fonts.normal)]);
  if(desk&&!desk.removed)return;
  const center=figma.viewport.center;desk=drawFrame(SC.base(),'Desktop · edit me',Math.round(center.x-650),Math.round(center.y-300));active=true;render(true);figma.viewport.scrollAndZoomIntoView([desk,phone]);figma.currentPage.selection=inputFrame&&!inputFrame.removed?[inputFrame]:[desk];
  setInterval(tick,650);
}
figma.ui.onmessage=async msg=>{
  try{
    if(msg.kind==='ui-ready'){if(inputFrame&&!inputFrame.removed)figma.ui.postMessage({kind:'custom-source',name:inputFrame.name});else figma.ui.postMessage({kind:'blank-source'});return}
    if(msg.kind==='new-screen'){await startScreen(msg.screen,[5,25,100].includes(msg.count)?msg.count:100);return}
    if(['fleet-context','launch-fleet','apply','keep','snapshot'].includes(msg.kind)&&!targetFrame())await startSample();
    if(msg.kind==='fleet-context'){
      try{const f=targetFrame();if(!f)throw Error('Select a source frame.');
        const img=await f.exportAsync({format:'PNG',constraint:{type:'WIDTH',value:720}});
        figma.ui.postMessage({kind:'fleet-context',id:msg.id,sourceKey:f.id,source:{name:f.name,width:f.width,height:f.height,layers:f.children.slice(0,64).map((n,index)=>({index,name:n.name,type:n.type,x:n.x,y:n.y,w:n.width,h:n.height}))},png:figma.base64Encode(img)});
      }catch(e){figma.ui.postMessage({kind:'fleet-context',id:msg.id,error:e.message})}return}
    if(msg.kind==='launch-fleet'){await launchFleet([5,25,100].includes(msg.count)?msg.count:100,msg.brief,msg.sourceKey,msg.shared);return}
    if(msg.kind==='pause-fleet'){pauseFleet();return}
    if(msg.kind==='stop-fleet'){stopFleet();return}
    if(msg.kind==='snapshot'){try{const img=await desk.exportAsync({format:'PNG',constraint:{type:'WIDTH',value:720}});figma.ui.postMessage({kind:'snapshot',id:msg.id,png:figma.base64Encode(img)})}catch(e){figma.ui.postMessage({kind:'snapshot',id:msg.id})}return}
    if(msg.kind==='apply'){direction=SC.normalize(msg.plan);render(true,msg.focus)}
    if(msg.kind==='keep'&&phone&&!phone.removed){const saved=phone.clone();saved.name='Mobile · saved';saved.x=phone.x;saved.y=phone.y+phone.height+64;while(figma.currentPage.children.some(n=>n!==saved&&n.name==='Mobile · saved'&&n.x===saved.x&&n.y===saved.y))saved.y+=saved.height+64;figma.notify('Editable mobile frame saved below the proposal.')}
  }catch(e){figma.ui.postMessage({kind:'error',text:String(e)})}
};
figma.on('close',()=>{if(nativeRun)dropBoard(nativeRun);if(arrow&&!arrow.removed)arrow.remove()});
