const H={'User-Agent':'KarachifyDemo/0.1 (city portal research)'};
const t='File:PK_Karachi_asv2020-02_img36_Empress_Market.jpg';
const u=`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(t)}&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&iiextmetadatafilter=LicenseShortName%7CArtist%7CCopyrighted&iiurlwidth=1280&format=json`;
const d=await (await fetch(u,{headers:H})).json();
const p=Object.values(d.query.pages)[0], i=p.imageinfo&&p.imageinfo[0];
if(!i){console.log('NO IMAGEINFO',JSON.stringify(p).slice(0,300));}
else console.log(JSON.stringify({thumb:i.thumburl,w:i.width,h:i.height,lic:i.extmetadata&&i.extmetadata.LicenseShortName&&i.extmetadata.LicenseShortName.value,artist:(i.extmetadata&&i.extmetadata.Artist&&i.extmetadata.Artist.value||'').replace(/<[^>]*>/g,'').trim()},null,1));
// test widths availability for this file
for(const w of [320,500,640,800,1024,1280,2048]){
  const r=await fetch(i.thumburl.replace('/1280px-','/'+w+'px-'),{headers:H});
  console.log(w, r.status, (await r.arrayBuffer()).byteLength);
}
