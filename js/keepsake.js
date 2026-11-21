// Same-origin artwork and native text keep the displayed proof identical to the saved PNG.
let ticketPaper;
function loadTicketPaper() {
  if (location.protocol === 'file:') return Promise.resolve(null);
  if (!ticketPaper) {
    ticketPaper = new Promise(resolve => {
      const image = new Image();
      const timer = setTimeout(() => resolve(null), 3200);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.src = 'assets/images/keepsake.webp';
    });
  }
  return ticketPaper;
}

async function composeTicket({from, to, date, venue, food}) {
  const paper = await loadTicketPaper();
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas unavailable');
  const serif = 'Georgia, "Songti SC", serif', mono = 'monospace';
  function wrap(text,width,font) {
    c.font=font;
    const lines=[]; let line='';
    for (const char of text) {
      if (line && c.measureText(line+char).width>width) { lines.push(line); line=''; }
      line+=char;
    }
    lines.push(line); return lines;
  }
  const names=wrap(from+' × '+to,1285,'italic 90px '+serif);
  const fields=[['晚餐日期',date],['餐厅',venue],['点选口味',food]].map(([label,value])=>[label,wrap(value,956,'45px '+serif)]);
  const fieldY=350+names.length*106;
  const height=fieldY+fields.reduce((n,[,rows])=>n+38+rows.length*60,0)+145;
  canvas.height=height;
  const ink='#402f38', rose='#855763', bronze='#785e41';
  function type(text,x,y,font,color) {c.fillStyle=color;c.font=font;c.fillText(text,x,y);}
  function line(x,y,xx,yy,color) {c.strokeStyle=color;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
  const base=c.createLinearGradient(0,0,1920,height);base.addColorStop(0,'#f4e8d8');base.addColorStop(.72,'#f2ddd1');base.addColorStop(1,'#d7aaa8');c.fillStyle=base;c.fillRect(0,0,1920,height);
  if (paper) { c.globalAlpha=.74;c.drawImage(paper,0,0,1920,height);c.globalAlpha=1; }
  c.fillStyle='#f5e7d776';c.fillRect(0,0,1450,height);
  c.strokeStyle='#a68c6e';c.lineWidth=2;c.strokeRect(23,23,1874,height-46);
  c.strokeRect(32,32,1856,height-64);
  type('R I C K Y   R E C O R D S',90,110,'32px '+mono,bronze);
  type('SIDE B',1200,110,'32px '+mono,bronze);line(90,145,1360,145,'#a58b78');
  type('The Unreleased Track',83,276,'104px '+serif,ink);
  names.forEach((name,i)=>type(name,88,382+i*106,'italic 90px '+serif,rose));
  let y=fieldY;
  for (const [label,rows] of fields) {
    line(90,y-21,1360,y-21,'#bea894');
    type(label,92,y+30,'31px '+serif,bronze);
    rows.forEach((row,j)=>type(row,345,y+33+j*60,'45px '+serif,ink));y+=38+rows.length*60;
  }
  type('PRIVATE DINNER PRESSING',90,height-74,'28px '+mono,bronze);
  c.setLineDash([10,9]);line(1450,32,1450,height-32,bronze);c.setLineDash([]);
  c.textAlign='center';const x=1684,cy=height*.46;
  type('ONE OF ONE',x,122,'32px '+mono,ink);
  for (let i=0;i<10;i++) {c.beginPath();c.arc(x,cy,119-i*5,0,2*Math.PI);c.strokeStyle=i%2?rose:bronze;c.lineWidth=i%3?1:2;c.stroke();}
  c.fillStyle=rose;c.beginPath();c.arc(x,cy,46,0,2*Math.PI);c.fill();c.fillStyle='#f2ddc9';c.beginPath();c.arc(x,cy,6,0,2*Math.PI);c.fill();
  type('NO. 0013',x,height-156,'49px '+serif,ink);
  let bx=x-119;c.fillStyle=ink;
  for(let i=0;i<48;i++){const w=1+i*13%5;c.fillRect(bx,height-127,w,38);bx+=w+2;}
  return canvas.toDataURL('image/png');
}
