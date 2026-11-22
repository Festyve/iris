// Project the upstream browser layout into Figma primitives in CSS paint order.
// Only the inert, bundled vault documents are accepted by the caller.
function projectCodePage(d, brand, replacements={}) {
  const win=d.defaultView, body=d.body;
  const elements=[body,...body.querySelectorAll('*')];
  for(const [index,e] of elements.entries()){
    if(!e.hasAttribute('data-copy'))continue;
    const value=replacements['t'+index] ?? (e.dataset.copy==='brand'?brand:null);
    if(value!=null)e.textContent=value;
  }
  const width=win.innerWidth, height=Math.min(2400,Math.max(240,body.scrollHeight,d.documentElement.scrollHeight));
  const nodes=[];
  const color=s=>{
    const rgb=s?.match(/[\d.]+/g);
    if(!rgb || rgb.length<3 || Number(rgb[3])===0)return null;
    return {hex:'#'+rgb.slice(0,3).map(v=>Math.round(+v).toString(16).padStart(2,'0')).join(''),alpha:rgb[3]===undefined?1:+rgb[3]};
  };
  const indexOf=new Map(elements.map((e,i)=>[e,i]));
  function visit(e){
    const i=indexOf.get(e), style=win.getComputedStyle(e), box=e.getBoundingClientRect();
    if(style.display==='none'||style.visibility==='hidden')return;
    const rect=e===body?{x:0,y:0,w:width,h:height}:{x:box.x,y:box.y,w:box.width,h:Math.min(box.height,height-box.y)};
    const usable=rect.w>=.5&&rect.h>=.5&&rect.x>=-1&&rect.x+rect.w<=width+1&&rect.y>=-1;
    const label=e.tagName.toLowerCase(), fill=color(style.backgroundColor),stroke=color(style.borderTopColor),border=parseFloat(style.borderTopWidth);
    if(usable&&(e.dataset.art||fill||border&&stroke)){
      nodes.push({...rect,id:'s'+i,type:'shape',name:e.dataset.art?'Photograph or illustration':label+' surface',fill:e.dataset.art?'#FFFFFF':fill?.hex||null,
        ...(e.dataset.art?{art:e.dataset.art}:{}),...(fill&&!e.dataset.art?{opacity:fill.alpha}:{}),r:parseFloat(style.borderTopLeftRadius)||0,...(border&&stroke?{stroke:stroke.hex,sw:border}:{})});
      if(e.dataset.tint)nodes.push({...rect,id:'overlay'+i,type:'shape',name:'Photograph tint',fill:e.dataset.tint,opacity:Number(e.dataset.alpha)});
    }
    if(e.hasAttribute('data-copy')&&usable&&e.textContent.trim()){
      const range=d.createRange();range.selectNodeContents(e);
      const ink=range.getBoundingClientRect();
      const block=style.display!=='inline';
      const left=block?box.x+parseFloat(style.paddingLeft)+parseFloat(style.borderLeftWidth):ink.x;
      const w=block?box.width-(left-box.x)-parseFloat(style.paddingRight)-parseFloat(style.borderRightWidth):ink.width;
      const size=parseFloat(style.fontSize), line=parseFloat(style.lineHeight)||size*1.2;
      if(w>=1&&ink.height>0 && ink.bottom<=height+1){
        const text=e.textContent.trim();
        // Read the browser's line breaks after CSS has resized the controls and columns.
        const leaf=e.firstChild, lines=[];
        let top=null;
        if(leaf?.nodeType===3){
          for(let pos=0;pos<leaf.length;){
            const char=String.fromCodePoint(leaf.textContent.codePointAt(pos));
            range.setStart(leaf,pos);pos+=char.length;range.setEnd(leaf,pos);
            const glyph=range.getBoundingClientRect();
            if(glyph.height===0)continue;
            if(top===null||Math.abs(glyph.y-top)>1){lines.push('');top=glyph.y;}
            lines[lines.length-1]+=char;
          }
        }
        const displayText=lines.map(l=>l.trim()).filter(Boolean).join('\n')||text;
        const lh=Math.max(.8,Math.min(2.2,line/size));
        nodes.push({id:'t'+i,type:'text',name:e.dataset.copy==='brand'?'Site name':text,text,displayText,measuredText:text,copyRole:e.dataset.copy==='brand'?'brand':'copy',x:left,y:Math.max(0,ink.y-(line-size)*.5),w:Math.min(w,width-left),h:Math.max(line,ink.height+(line-size)*.5),size,weight:Number(style.fontWeight)||400,color:color(style.color)?.hex||'#151515',align:style.textAlign==='center'?'center':style.textAlign==='right'?'right':'left',lh,wrap:true});
      }
    }
    // Fixed navigation and positioned elements paint above normal-flow siblings.
    const children=[...e.children].map(child=>({child,s:win.getComputedStyle(child)}));
    const z=v=>v.s.zIndex==='auto'?(v.s.position==='absolute'||v.s.position==='fixed'?1:0):Number(v.s.zIndex);
    children.sort((a,b)=>z(a)-z(b)).forEach(({child})=>visit(child));
  }
  visit(body);
  return {w:width,h:height,nodes};
}
async function measureCodePage(html,width,brand,replacements){
  const frame=document.createElement('iframe');
  frame.setAttribute('sandbox','allow-same-origin');
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;left:-20000px;top:0;border:0;visibility:hidden;width:'+width+'px;height:780px';
  const ready=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('Could not measure the imported page.'));});
  frame.srcdoc=html;document.body.appendChild(frame);
  try{await ready;return projectCodePage(frame.contentDocument,brand,replacements);}
  finally{frame.remove();}
}
