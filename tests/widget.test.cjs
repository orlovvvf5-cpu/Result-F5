const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('widget/script.js','utf8');
function harness(){
 let Widget,disposed=0,options,read;
 const nodes=new Map();const $=selector=>{const key=typeof selector==='string'?selector:'body';if(!nodes.has(key))nodes.set(key,{length:1,0:{},appendTo(){return this},append(){return this},text(){return this},remove(){return this}});return nodes.get(key);};
 const require=(paths,callback)=>callback({}, {mount(host,core,a,o){options=o;return ()=>disposed++;}}, {create(fn){read=fn;return {snapshot(){},events(){}}}});
 vm.runInNewContext(code,{define(deps,factory){Widget=factory($,require)},Promise,AbortController,window:{location:{origin:'https://test.amocrm.ru'}},document:{getElementById(){return null}}});
 const widget=new Widget();widget.params={path:'/widget-assets/f5'};widget.get_settings=()=>({implementation_date:'2026-07-01'});
 return {widget,get options(){return options},get disposed(){return disposed},get read(){return read}};
}
test('AMD widget provides live API adapter and configured initial date',()=>{const h=harness();h.widget.callbacks.advancedSettings();assert.equal(h.options.implementationDate,'2026-07-01');assert.equal(typeof h.read,'function');h.widget.callbacks.destroy();assert.equal(h.disposed,1);});
test('Settings modal uses the same live loader',()=>{const h=harness();h.widget.callbacks.settings({length:1});assert.equal(typeof h.read,'function');});
