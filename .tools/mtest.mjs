const H={'User-Agent':'KarachifyDemo/0.1 (city portal research)','Accept':'application/json'};
const r=await fetch('https://en.wikipedia.org/api/rest_v1/page/media-list/Empress_Market',{headers:H});
const d=await r.json();
console.log('status',r.status,'items',d.items.length);
for(const it of d.items.slice(0,3)){
  console.log('TITLE:',it.title);
  console.log('TYPE:',it.type);
  const s=it.srcset||(it.items&&it.items[0]&&it.items[0].srcset);
  console.log('SRCSET:',JSON.stringify(s).slice(0,600));
  console.log('ATTR:',JSON.stringify(it.attribution).slice(0,300));
  console.log('---');
}
