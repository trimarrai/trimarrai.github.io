// 장면별로 30fps 프레임을 캡처: node render.js <html> <초> <출력폴더>
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
(async()=>{const [,,html,sec,out]=process.argv;fs.mkdirSync(out,{recursive:true})
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}})
await p.goto('file://'+path.resolve(html));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300)
const n=Math.round(sec*30),el=p.locator('#frame')
for(let i=0;i<n;i++){await p.evaluate(t=>seek(t),i/30);await p.screenshot({path:`${out}/${String(i).padStart(4,'0')}.png`,clip:{x:0,y:0,width:1080,height:1920}})}
await b.close()})();
