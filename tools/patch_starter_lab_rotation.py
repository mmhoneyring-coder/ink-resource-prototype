from pathlib import Path

path = Path('starter-lab.html')
s = path.read_text(encoding='utf-8')

repls = [
(
'''<div class="range-box"><div class="range-row"><strong>島の大きさ</strong><span id="sizeValue">100%</span></div><input id="sizeRange" type="range" min="80" max="120" step="1" value="100"><div class="small">形はそのままで、全体サイズだけを拡大・縮小します。</div></div></div><div class="actions">''',
'''<div class="range-box"><div class="range-row"><strong>島の大きさ</strong><span id="sizeValue">100%</span></div><input id="sizeRange" type="range" min="80" max="120" step="1" value="100"><div class="small">形はそのままで、全体サイズだけを拡大・縮小します。</div></div><div class="range-box"><div class="range-row"><strong>回転</strong><span id="rotationValue">0°</span></div><input id="rotationRange" type="range" min="0" max="359" step="1" value="0"><div class="small">島を回して、どの部分を上30%としてSTART表示するか選びます。</div></div></div><div class="actions">'''
),
(
'''sizeRange:$('sizeRange'),sizeValue:$('sizeValue'),acceptBtn:''',
'''sizeRange:$('sizeRange'),sizeValue:$('sizeValue'),rotationRange:$('rotationRange'),rotationValue:$('rotationValue'),acceptBtn:'''
),
(
'''family,seed,roughness:100,size:100};''',
'''family,seed,roughness:100,size:100,rotation:0};'''
),
(
'''function draw(c){const fc=E.fullCanvas.getContext('2d'),sc=E.startCanvas.getContext('2d'),W=E.fullCanvas.width,H=E.fullCanvas.height,SW=E.startCanvas.width,SH=E.startCanvas.height;grid(fc,W,H);grid(sc,SW,SH);let a=fit(points(c,W,H),W,H);const size=(c.size??100)/100;a=a.map(([x,y])=>[W/2+(x-W/2)*size,H/2+(y-H/2)*size]);if(state.showCore){const b=bounds(a);fc.beginPath();fc.ellipse(W/2,H/2,b.w*.22,b.h*.17,0,0,TAU);fc.fillStyle='rgba(115,138,159,.22)';fc.fill()}path(fc,a);fc.fillStyle='#162129';fc.fill();const cut=H*.30;fc.setLineDash([10,10]);fc.strokeStyle='#93a0a8';fc.beginPath();fc.moveTo(28,cut);fc.lineTo(W-28,cut);fc.stroke();fc.setLineDash([]);fc.fillStyle='#6c675c';fc.font='24px sans-serif';fc.fillText('島全体 / 線より上が30%',24,34);const b=bounds(a),top=a.filter(p=>p[1]<=b.y0+b.h*.30);if(top.length>2){const tb=bounds(top),s=Math.min((SW-40)/tb.w,(SH-30)/Math.max(1,tb.h)),cx=(tb.x0+tb.x1)/2,all=a.map(([x,y])=>[SW/2+(x-cx)*s,10+(y-tb.y0)*s]);sc.save();sc.beginPath();sc.rect(0,0,SW,SH);sc.clip();path(sc,all);sc.fillStyle='#162129';sc.fill();sc.restore()}sc.fillStyle='#6c675c';sc.font='24px sans-serif';sc.fillText('START表示',24,34)}''',
'''function draw(c){const fc=E.fullCanvas.getContext('2d'),sc=E.startCanvas.getContext('2d'),W=E.fullCanvas.width,H=E.fullCanvas.height,SW=E.startCanvas.width,SH=E.startCanvas.height;grid(fc,W,H);grid(sc,SW,SH);let a=fit(points(c,W,H),W,H);const rot=(c.rotation??0)*Math.PI/180,cr=Math.cos(rot),sr=Math.sin(rot);a=a.map(([x,y])=>{const dx=x-W/2,dy=y-H/2;return[W/2+dx*cr-dy*sr,H/2+dx*sr+dy*cr]});const size=(c.size??100)/100;a=a.map(([x,y])=>[W/2+(x-W/2)*size,H/2+(y-H/2)*size]);const b=bounds(a),cut=b.y0+b.h*.30;if(state.showCore){fc.beginPath();fc.ellipse(W/2,H/2,b.w*.22,b.h*.17,rot,0,TAU);fc.fillStyle='rgba(115,138,159,.22)';fc.fill()}path(fc,a);fc.fillStyle='#162129';fc.fill();fc.setLineDash([10,10]);fc.strokeStyle='#93a0a8';fc.beginPath();fc.moveTo(28,cut);fc.lineTo(W-28,cut);fc.stroke();fc.setLineDash([]);fc.fillStyle='#6c675c';fc.font='24px sans-serif';fc.fillText('島全体 / 線より上が30%',24,34);const xShift=(SW-W)/2,yShift=16-b.y0,startCut=16+b.h*.30,all=a.map(([x,y])=>[x+xShift,y+yShift]);sc.save();sc.beginPath();sc.rect(0,0,SW,Math.min(SH,startCut));sc.clip();path(sc,all);sc.fillStyle='#162129';sc.fill();sc.restore();sc.strokeStyle='#93a0a8';sc.setLineDash([10,10]);sc.beginPath();sc.moveTo(20,Math.min(SH-1,startCut));sc.lineTo(SW-20,Math.min(SH-1,startCut));sc.stroke();sc.setLineDash([]);sc.fillStyle='#6c675c';sc.font='24px sans-serif';sc.fillText('START表示',24,34)}'''
),
(
'''E.roughRange.value=c.roughness??100;E.roughValue.textContent=`${c.roughness??100}%`;E.sizeRange.value=c.size??100;E.sizeValue.textContent=`${c.size??100}%`;draw(c)''',
'''E.roughRange.value=c.roughness??100;E.roughValue.textContent=`${c.roughness??100}%`;E.sizeRange.value=c.size??100;E.sizeValue.textContent=`${c.size??100}%`;E.rotationRange.value=c.rotation??0;E.rotationValue.textContent=`${c.rotation??0}°`;draw(c)'''
),
(
'''const rec={id:c.id,family:c.family,seed:c.seed,roughness:c.roughness??100,size:c.size??100,score:c.score,p:c.p,batchNo:state.batchNo};''',
'''const rec={id:c.id,family:c.family,seed:c.seed,roughness:c.roughness??100,size:c.size??100,rotation:c.rotation??0,score:c.score,p:c.p,batchNo:state.batchNo};'''
),
(
'''${x.id} / 凹凸 ${x.roughness??100}% / 大きさ ${x.size??100}% / 評価 ${x.score.toFixed(2)}''',
'''${x.id} / 凹凸 ${x.roughness??100}% / 大きさ ${x.size??100}% / 回転 ${x.rotation??0}° / 評価 ${x.score.toFixed(2)}'''
),
(
'''E.sizeRange.oninput=()=>{const c=state.candidates[state.index];if(!c)return;c.size=Number(E.sizeRange.value);E.sizeValue.textContent=`${c.size}%`;save();draw(c)};E.acceptBtn.onclick''',
'''E.sizeRange.oninput=()=>{const c=state.candidates[state.index];if(!c)return;c.size=Number(E.sizeRange.value);E.sizeValue.textContent=`${c.size}%`;save();draw(c)};E.rotationRange.oninput=()=>{const c=state.candidates[state.index];if(!c)return;c.rotation=Number(E.rotationRange.value);E.rotationValue.textContent=`${c.rotation}°`;save();draw(c)};E.acceptBtn.onclick'''
)
]

for old, new in repls:
    if old not in s:
        raise SystemExit('missing expected fragment: ' + old[:140])
    s = s.replace(old, new, 1)

if 'rotationRange' not in s or '回転' not in s:
    raise SystemExit('rotation controls missing after patch')
if 'const cut=H*.30' in s:
    raise SystemExit('old fixed cut line still present')
if 'const tb=bounds(top)' in s:
    raise SystemExit('old independently scaled START preview still present')

path.write_text(s, encoding='utf-8')
print('patched START size preview and rotation')
