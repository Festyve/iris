// The library stores outlines separately so page plugin data only needs their ids.
const Websites = (() => {
  function artwork(key) {
    if (typeof key !== 'string') return null;
    const [id,version,index] = key.split('/');
    if (!index) {
      const old = typeof LegacyOutlines!=='undefined' && Object.prototype.hasOwnProperty.call(LegacyOutlines,id) && LegacyOutlines[id][Number(version)];
      return old ? {w:old[0],h:old[1],path:old[2]} : null;
    }
    if(version!=='v2')return null;
    const row = Object.prototype.hasOwnProperty.call(ReferenceSites,id) && ReferenceSites[id].shapes[Number(index)];
    return row && row[5] ? {w:row[2]/3,h:row[3]/3,path:row[5]} : null;
  }
  const match=CodeSites.match;
  function titleOf(note) {
    const quoted=note.match(/["“]([^"”]{1,260})["”]/);
    const named=quoted || note.match(/\b(?:called|named)\s+(.{1,260})/i);
    if(named)return named[1].trim();
    const subject = note.replace(/^(?:(?:please|can you|i want|make|design|create|build|me|a|an|the)\s+)+/i,'')
      .replace(/^(?:website|landing page|site|homepage)\s+(?:(?:for|about|selling)\s+)?/i,'').replace(/\s+(?:website|site|landing page|homepage)\b.*$/i,'');
    const title = (subject || note).trim().slice(0,55);
    return title.charAt(0).toUpperCase()+title.slice(1);
  }
  function brandOf(note,m) {
    const named=/called|named|["“]/i.test(note);
    const sourceName=m.site.source.toLowerCase();
    if(!named && (note.toLowerCase().includes(sourceName) || /^(?:recreate|clone|copy)\b/i.test(note)))return m.site.title;
    return titleOf(note);
  }
  function shapeNodes(source,parent) {
    return RasterLayouts[source].shapes.map(([x,y,w,h,fill,image,name],i)=>({
      id:parent+'-s'+i,parent,type:'shape',name,x,y,w,h,fill,...(image?{art:source+'/v3/'+i}:{})
    }));
  }
  function build(note,m=match(note),measured) {
    const brand=brandOf(note,m);
    return CodeSites.build(brand,m,measured);
  }
  return {match,build,brandOf,artwork,shapeNodes};
})();
