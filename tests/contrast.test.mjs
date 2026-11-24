import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../src/theme.css',import.meta.url),'utf8');
const base={},dark={};for(const [,selector,block] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){const target=selector.includes('[data-theme=dark]')?dark:selector.includes('@theme')||selector.includes(':root')?base:null;if(target)for(const [,key,value]of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g))target[key]=value.trim()}
function resolve(tokens,key){let value=tokens[key];if(!value)throw Error(key);if(value.startsWith('var('))return resolve(tokens,value.match(/var\((--[^)]+)\)/)[1]);return value}
function luminance(hex){const rgb=hex.replace('#','').match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
for(const [name,tokens]of [['light',base],['dark',{...base,...dark}]])test(`${name} theme text and interactive indicators meet AA contrast`,()=>{
 const pairs=[['--ink','--page-bg',4.5],['--ink','--panel',4.5],['--muted','--page-bg',4.5],['--muted','--panel',4.5],['--ink','--color-primary-soft',4.5],['--on-primary','--color-primary',4.5],['--on-danger','--color-danger',4.5],['--color-danger','--panel',4.5],['--control-border','--panel',3],['--control-border','--page-bg',3],['--color-primary','--page-bg',3],['--color-timer-ok','--page-bg',3],['--color-timer-warn','--page-bg',3],['--color-timer-late','--page-bg',3]];
 for(const[a,b,min]of pairs){const measured=ratio(resolve(tokens,a),resolve(tokens,b));assert.ok(measured>=min,`${a} on ${b}: ${measured.toFixed(2)} < ${min}`)}
});
