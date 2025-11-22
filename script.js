async function extractTextFromPDF(file){
  const pdf=await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  let text="";
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    text+=content.items.map(it=>it.str).join(" ");
  }
  return text;
}

function extractOriginalGroups(text){
  const specialMatches=text.match(/\b\d{2}[A-Z]\s\d{5}\b/g)||[];
  const specials=[...new Set(specialMatches)];
  const special5s=specials.map(s=>s.split(" ")[1]);
  let nums5=text.match(/\b\d{5}\b/g)||[];
  nums5=nums5.filter(n=>!special5s.includes(n));
  let nums4=text.match(/\b\d{4}\b/g)||[];
  nums4=[...new Set(nums4.map(Number))].sort((a,b)=>a-b);
  return{specials,nums5:[...new Set(nums5)],nums4};
}

function extractRelevantNumbers(text){
  let nums4=text.match(/\b\d{4}\b/g)||[];
  let nums5=text.match(/\b\d{5}\b/g)||[];
  let last4of5=nums5.map(n=>n.slice(1));
  let all=nums4.concat(last4of5).map(Number);
  all=[...new Set(all.filter(n=>n>=1000&&n<=9999))];
  return all.slice(0,100);
}

function randomizeNumbers(base){
  let result=base.slice();
  for(let i=0;i<5;i++){
    result=result.map(n=>{
      let s=n.toString().padStart(4,'0');
      let last2=s.slice(2);
      let prefix=Math.floor(Math.random()*90+10);
      return Number(prefix+last2);
    });
  }
  return [...new Set(result)].slice(0,100).sort((a,b)=>a-b);
}

function compareNumbers(randomNums,newNums){
  let matches=[];
  for(let r of randomNums){
    for(let n of newNums){
      const diff=n-r;
      if(Math.abs(diff)<=7){
        const sameHouse=Math.floor(r/10)===Math.floor(n/10);
        matches.push({random:r,close:n,diff,sameHouse});
      }
    }
  }
  return matches.sort((a,b)=>{
    const rank=(m)=>(m.diff===0?1:Math.abs(m.diff)<=3?2:3);
    return rank(a)-rank(b)||a.close-b.close;
  });
}

function extractDateTimeFromFilename(name){
  const match=name.match(/([MDE])([A-Z])(\d{2})(\d{2})(\d{2})/i);
  if(!match)return{date:"Unknown",time:"Unknown"};
  const[,prefix,,day,month,year]=match;
  const map={M:"1 PM",D:"6 PM",E:"8 PM"};
  const monthNames=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return{date:`${day} ${monthNames[parseInt(month)-1]} 20${year}`,time:map[prefix]||"Unknown"};
}

let expectedNums=[],originalGroups;
document.getElementById('pdfBase').addEventListener('change',async e=>{
  const file=e.target.files[0];
  if(!file)return;
  const text=await extractTextFromPDF(file);
  originalGroups=extractOriginalGroups(text);

  const content=document.getElementById('originalContent');
  content.innerHTML=`
    <div class='sectionLabel'>Special Number(s):</div>
    <div class='specialNum'>${originalGroups.specials.length?originalGroups.specials.join(", "):"None"}</div>
    <div class='sectionLabel'>5-Digit Numbers:</div>
    <div class='fiveDigit'>${originalGroups.nums5.join(", ")||"None"}</div>
    <div class='sectionLabel'>4-Digit Numbers (Sorted):</div>
    <div class='fourDigit'>${originalGroups.nums4.slice(0,100).join(", ")||"None"}</div>`;
  document.getElementById('originalSection').style.display='block';

  expectedNums=randomizeNumbers(extractRelevantNumbers(text));
  const box=document.getElementById('expectedBox');
  document.getElementById('expectedSection').style.opacity='1';
  document.getElementById('expectedSection').style.pointerEvents='auto';
  box.innerHTML=expectedNums.join(", ");
  document.getElementById('compareBtn').style.display='inline-block';
});

document.getElementById('toggleOriginal').addEventListener('click',()=>{
  const c=document.getElementById('originalContent');const b=document.getElementById('toggleOriginal');
  if(c.classList.contains('collapsed')){c.classList.remove('collapsed');b.textContent='🔽';}
  else{c.classList.add('collapsed');b.textContent='🔼';}
});

document.getElementById('compareBtn').addEventListener('click',()=>{document.getElementById('compareSection').style.display='block';});

document.getElementById('pdfNext').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  const info=extractDateTimeFromFilename(file.name);
  const text=await extractTextFromPDF(file);
  const newNums=extractRelevantNumbers(text);
  const matches=compareNumbers(expectedNums,newNums);

  const fourSection=document.querySelector('.fourDigit');
  if(fourSection){
    let html=originalGroups.nums4.map(num=>{
      let matched=false, sameRange=false;
      for(let m of matches){
        if(Math.abs(m.random-num)<=7){matched=true;break;}
        if(Math.floor(num/100)===Math.floor(m.random/100)){sameRange=true;}
      }
      if(matched)return `<span class='blueFill'>${num}</span>`;
      if(sameRange)return `<span class='blueFill' style='opacity:0.6;'>${num}</span>`;
      return num;
    }).join(", ");
    fourSection.innerHTML=html;
  }

  const matchedSet=new Set(matches.map(m=>m.random));
  document.getElementById('expectedBox').innerHTML =
  expectedNums.map(n => {
    const exact = matches.some(m => m.random === n && m.diff === 0);
    if (exact)
      return `<span style="
        background:linear-gradient(90deg,#a6ff80,#fff97a);
        border-radius:3px;
        font-weight:bold;
        box-shadow:0 0 4px rgba(0,0,0,0.2);
      ">${n}</span>`;
    else if (matchedSet.has(n))
      return `<span style='background:#a6f5a6;border-radius:3px;'>${n}</span>`;
    return n;
  }).join(", ");
  document.getElementById('matchCount').textContent=matches.length>0?`✅ Total Matched: ${matches.length}`:"❌ No matches found.";

  const output=document.getElementById('compareOutput');
  const old=output.querySelectorAll('.matched-grid');old.forEach(g=>g.classList.add('faded'));

  const dateBox=document.createElement('div');
  dateBox.className='dateBox';
  dateBox.textContent=`📅 ${info.date} | 🕒 ${info.time}`;

  const grid=document.createElement('div');
  grid.className='matched-grid';
  matches.forEach(m=>{
    const cell=document.createElement('div');
    let color='gray',extra='';
    if(m.diff===0){color='green';extra=`<div class='win'>🏆 WIN</div>`;}
    else if(Math.abs(m.diff)<=3)color='yellow';
    if(m.diff!==0&&m.sameHouse)extra+=`<div class='extra'>🏠 same house</div>`;
    const diffText=m.diff===0?'':(m.diff>0?`+${m.diff}`:m.diff);
    cell.className=`match-cell ${color}`;
    cell.innerHTML=`
      <div class='number-pair'>
        <div class='expected-box'>${m.random}</div>
        <div class='matched-box'>${m.close}</div>
      </div>
      <div class='diff'>${diffText}</div>${extra}`;
    grid.appendChild(cell);
  });

  const wrap=document.createElement('div');
  wrap.appendChild(dateBox);
  wrap.appendChild(grid);
  output.prepend(wrap);
});