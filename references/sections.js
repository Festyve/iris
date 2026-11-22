// Native Figma presentation of a website. The tagged working frame remains the source for edits.
const VaultSections = (() => {
  const PAGE = 'iris-vault-page', SITE = 'iris-vault-entry', OWNER = 'iris-section-design';
  const margin = 64, gap = 72, heading = 38;
  let importPage = null;
  const keys = Object.keys(ReferenceBrands).sort();
  const cellWidth = 3280, cellHeight = 1880;
  const panels = page => page.children.filter(n => n.type === 'SECTION' && n.getPluginData(SITE));
  function taggedFrames(page) {
    const out=[];
    for (const n of page.children) {
      if(n.type==='FRAME') out.push(n);
      if(n.type==='SECTION' && n.getPluginData(OWNER)) out.push(...n.children.filter(f=>f.type==='FRAME'));
    }
    return out;
  }
  function position(index) {
    return {x:(index%3)*cellWidth,y:Math.floor(index/3)*cellHeight};
  }
  async function openLibrary() {
    if (run) throw Error('Finish or cancel the current run first.');
    importPage=figma.root.children.find(p=>p.getPluginData(PAGE)==='1');
    if(!importPage) {
      importPage=figma.createPage(); importPage.name='Iris · Website library'; importPage.setPluginData(PAGE,'1');
    }
    await figma.setCurrentPageAsync(importPage);
    next();
  }
  function next() {
    if(!importPage || figma.currentPage.id!==importPage.id){importPage=null;post({kind:'library-error',text:'Open the library again to resume.'});return;}
    const sections=panels(importPage);
    const done=new Set(sections.map(n=>n.getPluginData(SITE)));
    const id=keys.find(k=>!done.has(k));
    if (id) {post({kind:'library-next',id,done:done.size,total:keys.length});return;}
    figma.currentPage.selection=[];
    figma.viewport.scrollAndZoomIntoView(sections);
    post({kind:'library-done',total:sections.length,page:importPage.id});
    figma.notify('Website library ready · '+sections.length+' sections');
    importPage=null;
  }
  function checkImport(id) {
    if(!importPage || importPage.id!==figma.currentPage.id || !keys.includes(id)) throw Error('Open the website library first.');
    return keys.indexOf(id);
  }
  function caption(section,name,x,y,font) {
    const label=figma.createText();label.fontName={family:'Inter',style:font};label.fontSize=20;
    label.characters=name;label.fills=[solid('#C9CED6')];label.name=name+' label';
    section.appendChild(label);label.x=x;label.y=y;label.setPluginData('iris-detail','1');
  }
  function detail(source,name,box) {
    const frame=figma.createFrame();frame.name=name;frame.resize(box.w,box.h);frame.clipsContent=true;frame.fills=source.fills;
    for(const node of source.children) {
      if(node.x+node.width<=box.x || node.x>=box.x+box.w || node.y+node.height<=box.y || node.y>=box.y+box.h)continue;
      const cloned=node.clone();frame.appendChild(cloned);cloned.x=node.x-box.x;cloned.y=node.y-box.y;
    }
    frame.setPluginData('iris-detail','1');return frame;
  }
  function organize(r,frames) {
    if(!r.doc?.reference || !frames.length) return null;
    const source=frames[0], current=source.parent;
    let section=current.type==='SECTION' && current.getPluginData(OWNER)===r.design ? current:null;
    const origin=source.absoluteTransform;
    if(!section) {
      section=figma.createSection();section.name=r.doc.name;
      const point=r.libraryId?position(keys.indexOf(r.libraryId)):{x:origin[0][2]-margin,y:origin[1][2]-margin-heading};
      section.x=point.x;section.y=point.y;section.setPluginData(OWNER,r.design);
      section.fills=[solid('#26292F')];
    }
    for(const n of [...section.children]) if(n.getPluginData('iris-detail')) n.remove();
    let sample=section.children.find(n=>n.getPluginData('iris-capture'));
    if(!sample && r.captureHash) {
      sample=figma.createFrame();sample.name='Desktop reference';sample.resize(1440,900);
      sample.fills=[{type:'IMAGE',imageHash:r.captureHash,scaleMode:'FILL'}];
      sample.setPluginData('iris-capture','1');
    }
    function place(panel,title,x,y) {
      caption(section,title,x,y,r.fonts[600]);section.appendChild(panel);panel.x=x;panel.y=y+heading;
    }
    let x=margin;
    if(sample){place(sample,'Desktop reference · 1:1',x,margin);x+=sample.width+gap;}
    for(const f of frames){place(f,f===source?'Editable desktop':f.name,x,margin);x+=f.width+gap;}
    const rowY=margin+heading+Math.max(sample?.height||0,...frames.map(f=>f.height))+gap;
    const header=detail(source,'Navigation',{x:0,y:0,w:source.width,h:Math.min(150,source.height)});
    const hero=detail(source,'Hero detail',{x:Math.round(source.width*.08),y:Math.round(source.height*.20),w:Math.round(source.width*.84),h:Math.round(source.height*.52)});
    place(header,'Navigation',margin,rowY);place(hero,'Hero detail',margin+header.width+gap,rowY);
    const wide=Math.max(x-gap,margin+header.width+gap+hero.width)+margin;
    section.resizeWithoutConstraints(wide,rowY+heading+Math.max(header.height,hero.height)+margin);
    if(r.libraryId)section.setPluginData(SITE,r.libraryId);
    return section;
  }
  return {openLibrary,next,organize,checkImport,taggedFrames,position};
})();
