// Fast in-page canvas pixel probe (works because preserveDrawingBuffer is now true).
// Usage: window.__px(0.5,0.5) -> Promise<{r,g,b}>, window.__pxRow(0.5,0.5,0.2) -> Promise<[avg,variance]>
(function(){
  function ctx(){
    var cs = document.querySelectorAll('canvas');
    for (var i=0;i<cs.length;i++){
      var g = cs[i].getContext('webgl2') || cs[i].getContext('webgl');
      if (g) return {c:cs[i], g:g};
    }
    return null;
  }
  function nextFrame(){ return new Promise(function(r){ requestAnimationFrame(function(){ r(); }); }); }
  window.__px = async function(fx, fy){
    var o = ctx(); if(!o) return null;
    await nextFrame();
    var w=o.c.width, h=o.c.height;
    var x=Math.min(w-1,Math.max(0,Math.round(fx*w)));
    var y=Math.min(h-1,Math.max(0,Math.round(fy*h)));
    var p=new Uint8Array(4);
    o.g.readPixels(x,y,1,o.g.RGBA,o.g.UNSIGNED_BYTE,p);
    return {r:p[0],g:p[1],b:p[2],w:w,h:h,x:x,y:y};
  };
  // sample a horizontal band; returns {mean, variance, nonblack}
  window.__pxRow = async function(fx, fy, fw){
    var o = ctx(); if(!o) return null;
    await nextFrame();
    var w=o.c.width, h=o.c.height;
    var x=Math.round(fx*w), y=Math.round(fy*h), n=Math.max(1,Math.round(fw*w));
    x=Math.min(Math.max(0,x),w-1); y=Math.min(Math.max(0,y),h-1); n=Math.min(n,w-x);
    var buf=new Uint8Array(n*4);
    o.g.readPixels(x,y,n,o.g.RGBA,o.g.UNSIGNED_BYTE,buf);
    var sum=0,sum2=0,nb=0;
    for(var i=0;i<n;i++){ var v=(buf[i*4]+buf[i*4+1]+buf[i*4+2])/3; sum+=v; sum2+=v*v; if(v>12) nb++; }
    var mean=sum/n;
    return {mean:mean, variance:Math.max(0,sum2/n-mean*mean), nonblack:nb/n, w:w,h:h,x:x,y:y,n:n};
  };
  // 2-D region stats
  window.__pxBox = async function(fx, fy, fw, fh){
    var o = ctx(); if(!o) return null;
    await nextFrame();
    var w=o.c.width, h=o.c.height;
    var x=Math.round(fx*w), y=Math.round(fy*h), n=Math.max(1,Math.round(fw*w)), m=Math.max(1,Math.round(fh*h));
    x=Math.min(Math.max(0,x),w-1); y=Math.min(Math.max(0,y),h-1); n=Math.min(n,w-x); m=Math.min(m,h-y);
    var buf=new Uint8Array(n*m*4);
    o.g.readPixels(x,y,n,m,o.g.RGBA,o.g.UNSIGNED_BYTE,buf);
    var sum=0,sum2=0,nb=0,cnt=n*m;
    for(var i=0;i<cnt;i++){ var v=(buf[i*4]+buf[i*4+1]+buf[i*4+2])/3; sum+=v; sum2+=v*v; if(v>12) nb++; }
    var mean=sum/cnt;
    return {mean:mean, variance:Math.max(0,sum2/cnt-mean*mean), nonblack:nb/cnt, w:w,h:h,x:x,y:y,n:n,m:m};
  };
})();

// Detect GUI button rectangles by scanning for flat gray fills (r~g~b, 105<v<215).
// Returns list of {x,y,w,h,cx,cy} in SCREEN (top-left origin) coordinates, sorted by cy.
window.__findButtons = async function(){
  function nx(){ var cs=document.querySelectorAll('canvas'); for(var i=0;i<cs.length;i++){var g=cs[i].getContext('webgl2')||cs[i].getContext('webgl'); if(g) return {c:cs[i],g:g};} return null; }
  await new Promise(function(r){ requestAnimationFrame(function(){ r(); }); });
  var o=nx(); if(!o) return [];
  var g=o.g, w=o.c.width, h=o.c.height;
  var buf=new Uint8Array(w*h*4);
  g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,buf);   // origin BOTTOM-left
  var step=4, gw=Math.ceil(w/step), gh=Math.ceil(h/step);
  var mask=new Uint8Array(gw*gh);
  for(var gy=0;gy<gh;gy++) for(var gx=0;gx<gw;gx++){
    var x=Math.min(w-1,gx*step+2), y=Math.min(h-1,gy*step+2), i=(y*w+x)*4;
    var r=buf[i],gg=buf[i+1],b=buf[i+2], v=(r+gg+b)/3;
    if(Math.abs(r-gg)<14 && Math.abs(gg-b)<14 && v>105 && v<215) mask[gy*gw+gx]=1;
  }
  var seen=new Uint8Array(gw*gh), rects=[];
  for(var s=0;s<gw*gh;s++){
    if(!mask[s]||seen[s]) continue;
    var stack=[s]; seen[s]=1;
    var minx=1e9,maxx=-1,miny=1e9,maxy=-1,cnt=0;
    while(stack.length){
      var cur=stack.pop(), cy=cur/gw|0, cx=cur%gw; cnt++;
      if(cx<minx)minx=cx; if(cx>maxx)maxx=cx; if(cy<miny)miny=cy; if(cy>maxy)maxy=cy;
      if(cx>0   && mask[cur-1] && !seen[cur-1]){seen[cur-1]=1;stack.push(cur-1);}
      if(cx<gw-1&& mask[cur+1] && !seen[cur+1]){seen[cur+1]=1;stack.push(cur+1);}
      if(cy>0   && mask[cur-gw]&& !seen[cur-gw]){seen[cur-gw]=1;stack.push(cur-gw);}
      if(cy<gh-1&& mask[cur+gw]&& !seen[cur+gw]){seen[cur+gw]=1;stack.push(cur+gw);}
    }
    var bw=(maxx-minx+1)*step, bh=(maxy-miny+1)*step, fill=cnt/((maxx-minx+1)*(maxy-miny+1));
    if(bw>=120 && bh>=28 && bh<=90 && fill>0.45){
      var yTop=h-(maxy+1)*step;
      rects.push({x:minx*step, y:yTop, w:bw, h:bh, cx:minx*step+bw/2, cy:yTop+bh/2});
    }
  }
  rects.sort(function(a,b){return a.cy-b.cy;});
  return rects;
};
