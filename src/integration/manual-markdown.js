// Small, safe reader for the project's authored Markdown. HTML is never executed.
export function splitManualTable(line){
  const cells=[];let value='',code=false,escaped=false;
  for(const char of line.trim().replace(/^\|/,'').replace(/\|$/,'')){
    if(escaped){value+=char;escaped=false;continue;}
    if(char==='\\'){escaped=true;continue;}
    if(char==='`')code=!code;
    if(char==='|'&&!code){cells.push(value.trim());value='';}else value+=char;
  }
  cells.push(value.trim());return cells;
}
export function parseManualMarkdown(source){
  const lines=source.replace(/\r\n/g,'\n').split('\n'),nodes=[];let pendingAnchor=null;
  const special=line=>/^\s*$|^#{1,6}\s|^```|^<a\s+id=|^\s*(?:[-*]|\d+\.)\s|^>\s?|^!\[/.test(line);
  for(let i=0;i<lines.length;){
    const line=lines[i];if(!line.trim()){i++;continue;}
    const anchor=line.match(/^<a\s+id="([\w-]+)"><\/a>\s*$/);if(anchor){pendingAnchor=anchor[1];i++;continue;}
    if(line.startsWith('```')){const language=line.slice(3).trim(),body=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))body.push(lines[i++]);i++;nodes.push({type:'code',language,text:body.join('\n')});continue;}
    const heading=line.match(/^(#{1,6})\s+(.+)$/);if(heading){nodes.push({type:'heading',level:heading[1].length,text:heading[2],id:pendingAnchor??`heading-${nodes.length}`});pendingAnchor=null;i++;continue;}
    const image=line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);if(image){nodes.push({type:'image',alt:image[1],target:image[2]});i++;continue;}
    if(line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]??'')){
      const headers=splitManualTable(line),rows=[];i+=2;while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows.push(splitManualTable(lines[i++]));nodes.push({type:'table',headers,rows});continue;
    }
    const list=line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);if(list){const ordered=/\d/.test(list[2]),items=[];while(i<lines.length){const item=lines[i].match(/^\s*([-*]|\d+\.)\s+(.+)$/);if(!item||/\d/.test(item[1])!==ordered)break;items.push(item[2]);i++;}nodes.push({type:'list',ordered,items});continue;}
    if(line.startsWith('>')){const text=[];while(i<lines.length&&lines[i].startsWith('>'))text.push(lines[i++].replace(/^>\s?/,''));nodes.push({type:'quote',text:text.join('\n')});continue;}
    const text=[line];i++;while(i<lines.length&&!special(lines[i])&&!(lines[i].includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]??'')))text.push(lines[i++]);nodes.push({type:'paragraph',text:text.join('\n')});
  }
  return nodes;
}
