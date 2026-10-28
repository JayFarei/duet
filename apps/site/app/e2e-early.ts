// e2e only (tools/e2e): an inline script for <head> that reports the controls from the first paint, before React
// hydrates and the reporter (./e2e-reporter) takes over. A page loading slowly (?slowjs, ../proxy.ts) shows its
// server-rendered controls for that long, and the reporter, which mounts with the JS, never saw them (#143). Lean
// samples, flagged early: the signals, Duet's navs and their visible slots. Silent unless the tab is an e2e run.
export const e2eEarly = `(function(){try{
if(window.top!==window)return;
var q=new URLSearchParams(location.search),o=null,e=q.get("e2e");
if(e!==null){try{var u=new URL(e);if(/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(u.hostname))o=u.origin}catch(x){}o=o||"http://localhost:3141"}
else o=sessionStorage.getItem("duet-e2e");
if(!o)return;
var s=q.get("s")||sessionStorage.getItem("duet-e2e-s"),E=window.__duetE2E={page:Math.random().toString(36).slice(2,10),stop:0},f=0,p=null;
(function fr(){f=Date.now();if(!E.stop)requestAnimationFrame(fr)})();
var R=function(el){var r=el.getBoundingClientRect();return{x:Math.round(r.left*10)/10,y:Math.round(r.top*10)/10,w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10}};
var V=function(el){var r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;var c=getComputedStyle(el);return c.visibility!=="hidden"&&c.display!=="none"&&Number(c.opacity)>0.01};
var A=function(n,k){return n.getAttribute(k)};
var id=setInterval(function(){
if(E.stop){clearInterval(id);if(p)p.remove();return}
if(!document.body)return;
if(!p||!p.isConnected){p=document.createElement("div");p.setAttribute("data-duet-e2e","");p.style.cssText="position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";document.documentElement.appendChild(p)}
var c=getComputedStyle(p),i=function(v){return parseFloat(v)||0},w=innerWidth>innerHeight,h=document.documentElement,vv=window.visualViewport;
var r={t:Date.now(),early:true,page:E.page,path:location.pathname+location.search,s:s,visible:document.visibilityState,frameAt:f,
sig:{innerWidth:innerWidth,innerHeight:innerHeight,outerWidth:outerWidth,outerHeight:outerHeight,visualHeight:vv?vv.height:innerHeight,
insetTop:i(c.paddingTop),insetBottom:i(c.paddingBottom),insetLeft:i(c.paddingLeft),insetRight:i(c.paddingRight),
screenWidth:w?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height),screenHeight:w?Math.min(screen.width,screen.height):Math.max(screen.width,screen.height),
angle:screen.orientation?screen.orientation.angle:0},
html:{mode:A(h,"data-duet-mode"),pending:h.hasAttribute("data-duet-pending")},
vv:vv?{x:vv.offsetLeft,y:vv.offsetTop,w:vv.width,h:vv.height,scale:vv.scale}:null,
navs:[].slice.call(document.querySelectorAll("nav.duet")).map(function(n){return{mode:A(n,"data-mode"),side:A(n,"data-side"),settling:A(n,"data-settling"),
hidden:A(n,"data-hidden"),confidence:A(n,"data-confidence"),rect:R(n),shown:V(n),
slots:[].slice.call(n.querySelectorAll("[data-duet-slot]")).filter(V).map(function(x){return{slot:A(x,"data-duet-slot"),rect:R(x),icons:[]}})}})};
fetch(o+"/beacon",{method:"POST",body:JSON.stringify(r),headers:{"content-type":"text/plain"},keepalive:true}).catch(function(){});
},40);
}catch(x){}})()`;
