function pdfText(value:string){
  const cp1252:Record<string,number>={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
  return [...value].map(ch=>{let n=cp1252[ch]??ch.codePointAt(0)!;if(n>255)n=63;const c=String.fromCharCode(n);return c==='('||c===')'||c==='\\'?`\\${c}`:n<32||n>126?`\\${n.toString(8).padStart(3,'0')}`:c;}).join('');
}

export function makePdf(title:string, lines:string[]){
  const pages:string[][]=[];for(let i=0;i<lines.length;i+=52)pages.push(lines.slice(i,i+52));if(!pages.length)pages.push([]);
  const objects:string[]=[];objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  const kids=pages.map((_,i)=>`${4+i*2} 0 R`).join(' ');objects[2]=`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  pages.forEach((page,i)=>{const pageId=4+i*2,streamId=pageId+1;const rows=[title,...page];const stream=`BT\n/F1 11 Tf\n50 790 Td\n14 TL\n${rows.map((line,j)=>`${j?'T*\n':''}(${pdfText(line)}) Tj`).join('\n')}\nET`;
    objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId]=`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`;
  });
  const parts:Buffer[]=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','latin1')];const offsets=[0];let length=parts[0].length;
  for(let id=1;id<objects.length;id++){offsets[id]=length;const b=Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`,'latin1');parts.push(b);length+=b.length;}
  const xrefOffset=length;let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)xref+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,'latin1'));
  return Buffer.concat(parts);
}
