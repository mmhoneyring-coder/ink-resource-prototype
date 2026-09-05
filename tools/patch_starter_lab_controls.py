from pathlib import Path

path = Path('starter-lab.html')
s = path.read_text(encoding='utf-8')

repls = [
(".range-box{display:grid;gap:8px;padding:12px 14px;flex:1 1 280px}.range-row{display:flex;justify-content:space-between;gap:10px}",
 ".range-col{display:grid;gap:10px;flex:1 1 380px}.range-box{display:grid;gap:8px;padding:12px 14px}.range-row{display:flex;justify-content:space-between;gap:10px}"),
("<div class=\"controls\"><div class=\"range-box\"><div class=\"range-row\"><strong>巻き具合</strong><span id=\"wrapValue\">100%</span></div><input id=\"wrapRange\" type=\"range\" min=\"88\" max=\"100\" step=\"1\" value=\"100\"><div class=\"small\">採用傾向を踏まえて高巻き中心です。</div></div><div class=\"actions\">",
 "<div class=\"controls\"><div class=\"range-col\"><div class=\"range-box\"><div class=\"range-row\"><strong>凹凸の強さ</strong><span id=\"roughValue\">100%</span></div><input id=\"roughRange\" type=\"range\" min=\"70\" max=\"130\" step=\"1\" value=\"100\"><div class=\"small\">突起・膨らみ・凹みの強さだけを変えます。位置はずれません。</div></div><div class=\"range-box\"><div class=\"range-row\"><strong>島の大きさ</strong><span id=\"sizeValue\">100%</span></div><input id=\"sizeRange\" type=\"range\" min=\"80\" max=\"120\" step=\"1\" value=\"100\"><div class=\"small\">形はそのままで、全体サイズだけを拡大・縮小します。</div></div></div><div class=\"actions\">"),
("const STORE='starter-shape-lab-v3', RAW=120, SHOW=12, TAU=Math.PI*2;",
 "const STORE='starter-shape-lab-v4', RAW=120, SHOW=12, TAU=Math.PI*2;"),
("fullCanvas:$('fullCanvas'),startCanvas:$('startCanvas'),wrapRange:$('wrapRange'),wrapValue:$('wrapValue'),acceptBtn:",
 "fullCanvas:$('fullCanvas'),startCanvas:$('startCanvas'),roughRange:$('roughRange'),roughValue:$('roughValue'),sizeRange:$('sizeRange'),sizeValue:$('sizeValue'),acceptBtn:"),
("const r=rng32(seed),base={id:`b${state.batchNo}-${n}-${family}-${seed.toString(36)}`,family,seed,wrap:ri(r,96,100)};",
 "const r=rng32(seed),base={id:`b${state.batchNo}-${n}-${family}-${seed.toString(36)}`,family,seed,roughness:100,size:100};"),
("function points(c,W,H){const f=radial(c),wrap=c.wrap/100,cx=W/2,cy=H*.54,rx=W*.22*c.p.rx,ry=H*.20*c.p.ry,out=[];for(let i=0;i<280;i++){const t=i/280,th=t*TAU,rd=f(th),xa=cx+Math.cos(th)*rx*rd,ya=cy+Math.sin(th)*ry*rd,xf=cx+(t-.5)*W*.56,yf=cy+Math.sin(th)*ry*.9-Math.max(0,Math.sin(th))*42*rd;out.push([lerp(xf,xa,wrap),lerp(yf,ya,wrap)])}return out}",
 "function points(c,W,H){const f=radial(c),rough=(c.roughness??100)/100,cx=W/2,cy=H*.54,rx=W*.22*c.p.rx,ry=H*.20*c.p.ry,out=[];for(let i=0;i<280;i++){const th=i/280*TAU,raw=f(th),rd=1+(raw-1)*rough;out.push([cx+Math.cos(th)*rx*rd,cy+Math.sin(th)*ry*rd])}return out}"),
("let a=fit(points(c,W,H),W,H);if(state.showCore)",
 "let a=fit(points(c,W,H),W,H);const size=(c.size??100)/100;a=a.map(([x,y])=>[W/2+(x-W/2)*size,H/2+(y-H/2)*size]);if(state.showCore)"),
("${x.id} / 巻き ${x.wrap}% / 評価 ${x.score.toFixed(2)}",
 "${x.id} / 凹凸 ${x.roughness??100}% / 大きさ ${x.size??100}% / 評価 ${x.score.toFixed(2)}"),
("E.wrapRange.value=c.wrap;E.wrapValue.textContent=`${c.wrap}%`;draw(c)",
 "E.roughRange.value=c.roughness??100;E.roughValue.textContent=`${c.roughness??100}%`;E.sizeRange.value=c.size??100;E.sizeValue.textContent=`${c.size??100}%`;draw(c)"),
("const rec={id:c.id,family:c.family,seed:c.seed,wrap:c.wrap,score:c.score,p:c.p,batchNo:state.batchNo};",
 "const rec={id:c.id,family:c.family,seed:c.seed,roughness:c.roughness??100,size:c.size??100,score:c.score,p:c.p,batchNo:state.batchNo};"),
("E.wrapRange.oninput=()=>{const c=state.candidates[state.index];if(!c)return;c.wrap=Number(E.wrapRange.value);E.wrapValue.textContent=`${c.wrap}%`;save();draw(c)};",
 "E.roughRange.oninput=()=>{const c=state.candidates[state.index];if(!c)return;c.roughness=Number(E.roughRange.value);E.roughValue.textContent=`${c.roughness}%`;save();draw(c)};E.sizeRange.oninput=()=>{const c=state.candidates[state.index];if(!c)return;c.size=Number(E.sizeRange.value);E.sizeValue.textContent=`${c.size}%`;save();draw(c)};")
]

for old, new in repls:
    if old not in s:
        raise SystemExit(f'missing expected fragment: {old[:100]}')
    s = s.replace(old, new, 1)

if 'wrapRange' in s or '巻き具合' in s:
    raise SystemExit('old wrap control still present')
if 'roughRange' not in s or 'sizeRange' not in s:
    raise SystemExit('new controls missing')

path.write_text(s, encoding='utf-8')
print('patched starter-lab.html')
