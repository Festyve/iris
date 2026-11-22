import {Doc} from '../designer.mjs';
import Screens from '../screen-spec.cjs';

export function editBrief(raw, instruction) {
  const doc=Doc.clean(raw);
  const replace=instruction.match(/^replace\s+["“](.+?)["”]\s+with\s+["“](.+?)["”]\s*[.!]?$/i);
  const heading=instruction.match(/^(?:set|change|rename)\s+(?:the\s+)?(?:title|headline)\s+to\s+(.+)$/i);
  const color=instruction.match(/^(?:make|set|change)\s+(?:the\s+)?accent(?:\s+color)?(?:\s+to)?\s+(#[a-f0-9]{6})\s*[.!]?$/i);
  const ops=[];
  const accent=doc.nodes.find(n=>n.id.endsWith('-rule'))?.fill;
  for (const n of doc.nodes) {
    if (replace && n.type==='text' && n.text===replace[1]) ops.push({op:'set',id:n.id,node:{text:replace[2].slice(0,260)}});
    if (heading && n.type==='text' && n.id.endsWith('-headline')) ops.push({op:'set',id:n.id,node:{text:heading[1].trim().replace(/^["“]|["”]$/g,'').slice(0,140)}});
    if (color && accent && n.fill===accent) ops.push({op:'set',id:n.id,node:{fill:color[1]}});
  }
  if (!ops.length) return null;
  const result=Doc.apply(doc,ops);
  Screens.checkBoard(Doc.compile(result.doc));
  return {ops,summary:'Updated '+ops.length+' matching layers.',execution:'local'};
}
