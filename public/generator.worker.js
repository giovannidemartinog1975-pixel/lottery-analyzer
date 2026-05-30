// Web Worker per generazione sestine SuperEnalotto
// Gira in thread separato — non blocca mai il browser

const POOL = 90;
const PICK = 6;
const DECINE = [
  {a:1,b:9},{a:10,b:19},{a:20,b:29},{a:30,b:39},{a:40,b:49},
  {a:50,b:59},{a:60,b:69},{a:70,b:79},{a:80,b:90}
];

const sm = a => a.reduce((s,v)=>s+v,0);

self.onmessage = function(e) {
  const { minSum, maxSum, parity, dec, minFreq, maxRit, freq, last, total } = e.data;

  let parEv=-1, parOd=-1;
  if(parity!=="any") { const p=parity.split("-").map(Number); parEv=p[0]; parOd=p[1]; }

  const decArr = Object.entries(dec||{}).map(([k,v])=>([parseInt(k),v]));

  function passes(nums) {
    const ev=nums.filter(n=>n%2===0).length;
    if(parEv>=0&&(ev!==parEv||(PICK-ev)!==parOd)) return false;
    if(decArr.length>0) for(const [idx,cnt] of decArr){if(nums.filter(n=>n>=DECINE[idx].a&&n<=DECINE[idx].b).length!==cnt)return false;}
    if(minFreq>0){if(nums.filter(n=>(freq[n]||0)>=3).length<minFreq)return false;}
    if(maxRit>0){const ar=nums.reduce((s,n)=>s+(total-1-(last[n]??-1)),0)/PICK;if(ar>maxRit)return false;}
    return true;
  }

  function enrich(nums) {
    const ev=nums.filter(n=>n%2===0).length;
    const fq=nums.reduce((s,n)=>s+(freq[n]||0),0);
    const ar=nums.reduce((s,n)=>s+(total-1-(last[n]??-1)),0)/PICK;
    const dc=DECINE.map(d=>nums.filter(n=>n>=d.a&&n<=d.b).length);
    return {nums,sum:sm(nums),ev,od:PICK-ev,dc,fq,ar:Math.round(ar)};
  }

  const result = [];
  let scanned = 0;
  let lastReport = Date.now();

  for(let a=1;a<=POOL-5;a++) {
    for(let b=a+1;b<=POOL-4;b++) {
      const ab=a+b;
      if(ab+(b+1)+(b+2)+(b+3)+(b+4)>maxSum) break;
      for(let c=b+1;c<=POOL-3;c++) {
        const abc=ab+c;
        if(abc+(c+1)+(c+2)+(c+3)>maxSum) break;
        for(let d=c+1;d<=POOL-2;d++) {
          const abcd=abc+d;
          if(abcd+(d+1)+(d+2)>maxSum) break;
          for(let e=d+1;e<=POOL-1;e++) {
            const abcde=abcd+e;
            if(abcde+(e+1)>maxSum) break;
            const fMin=Math.max(e+1,minSum-abcde);
            const fMax=Math.min(POOL,maxSum-abcde);
            for(let f=fMin;f<=fMax;f++) {
              scanned++;
              const nums=[a,b,c,d,e,f];
              if(passes(nums)) result.push(enrich(nums));
            }
          }
        }
      }
    }
    // Manda aggiornamento ogni 200ms
    const now=Date.now();
    if(now-lastReport>200) {
      const pct=Math.round((a-1)/(POOL-5)*100);
      self.postMessage({type:"progress",found:result.length,scanned,pct});
      lastReport=now;
    }
  }

  self.postMessage({type:"done",result,scanned});
};
