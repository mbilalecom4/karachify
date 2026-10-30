const files = [
 ['Mazar-e-Quaid','wikipedia/commons/thumb/4/47/PK_Karachi_asv2020-02_img52_Mazar-e-Quaid.jpg','PK_Karachi_asv2020-02_img52_Mazar-e-Quaid.jpg'],
 ['Frere-Hall','wikipedia/commons/thumb/1/14/Frere_Hall%2C_Karachi.jpg','Frere_Hall%2C_Karachi.jpg'],
 ['Empress-Market','wikipedia/commons/thumb/f/f2/Empress_Market%2C_Karachi%2C_Pakistan.jpg','Empress_Market%2C_Karachi%2C_Pakistan.jpg'],
];
const widths=[320,500,640,800,1024,1280];
for (const [name,base,f] of files){
  const line=[];
  for(const w of widths){
    const u=`https://upload.wikimedia.org/${base}/${w}px-${f}`;
    try{ const r=await fetch(u,{method:'GET',headers:{'User-Agent':'KarachifyDemo/0.1 (research)'} }); const n=(await r.arrayBuffer()).byteLength; line.push(`${w}:${r.status}/${n}`);}catch(e){line.push(`${w}:ERR`)}
    await new Promise(r=>setTimeout(r,1500));
  }
  console.log(name.padEnd(16), line.join('  '));
}
