define(['jquery','require'],function($,require){
 'use strict';
 return function(){
  var self=this,cleanup=null,requests=[],generation=0,menuObserver=null;
  // Native left_menu/widget_page is documented as public-integration only.
  // Private integrations get a browser UI link to the existing settings page.
  function ensureMenuLink(){
   var settings=self.get_settings(),code=settings&&settings.widget_code;
   if(!code)return;
   var menu=document.querySelector('#nav_menu');
   if(!menu)return;
   var list=menu.matches('ul,ol')?menu:(menu.querySelector('ul,ol')||menu);
   var existing=document.getElementById('f5-result-menu-item');
   if(existing){existing.querySelector('a').href='/settings/widgets/'+encodeURIComponent(code);return;}
   var item=document.createElement(list.matches('ul,ol')?'li':'div');
   item.id='f5-result-menu-item';item.className='nav__item';
   var link=document.createElement('a');
   link.className='nav__link';link.href='/settings/widgets/'+encodeURIComponent(code);
   link.title='Результат F5';link.setAttribute('aria-label','Результат F5');
   var icon=document.createElement('span');icon.className='f5-menu-icon';icon.setAttribute('aria-hidden','true');icon.textContent='F5';
   var label=document.createElement('span');label.className='nav__item__title f5-menu-title';label.textContent='Результат F5';
   link.appendChild(icon);link.appendChild(label);item.appendChild(link);list.appendChild(item);
   if(!document.getElementById('f5-menu-styles')){
    var style=document.createElement('style');style.id='f5-menu-styles';
    style.textContent='#f5-result-menu-item .nav__link{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px 3px;color:inherit;text-decoration:none;cursor:pointer}#f5-result-menu-item .f5-menu-icon{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border:2px solid currentColor;border-radius:50%;font:700 17px/1 sans-serif}#f5-result-menu-item .f5-menu-title{font:12px/1.25 sans-serif;text-align:center;white-space:normal;overflow-wrap:anywhere}#f5-result-menu-item a:hover,#f5-result-menu-item a:focus-visible{background:rgba(255,255,255,.12)}';
    document.head.appendChild(style);
   }
  }
  function watchMenu(){
   ensureMenuLink();
   if(!menuObserver&&typeof MutationObserver!=='undefined'&&document.body){
    menuObserver=new MutationObserver(function(){if(!document.getElementById('f5-result-menu-item'))ensureMenuLink();});
    menuObserver.observe(document.body,{childList:true,subtree:true});
   }
  }
  function read(path){
   if(!/^\/api\/v4\/(account|users|events|tasks|leads(?:\/pipelines)?)(\?|$)/.test(path))return Promise.reject(new Error('Запрещённый путь'));
   return new Promise(function(resolve,reject){var request=$.ajax({url:path,method:'GET',dataType:'json',timeout:20000});requests.push(request);request.done(function(body,status,xhr){if(xhr.status===204)resolve(null);else if(body&&typeof body==='object')resolve(body);else reject(new Error('API вернул ответ не в формате JSON'));}).fail(function(xhr){var error=new Error('HTTP '+xhr.status);error.status=xhr.status;error.retryAfter=xhr.getResponseHeader('Retry-After');reject(error);}).always(function(){requests=requests.filter(function(r){return r!==request;});});});
  }
  function clear(){generation++;requests.forEach(function(r){r.abort();});requests=[];if(cleanup)cleanup();cleanup=null;$('#f5-root').remove();}
  function start(container){
   clear();var current=generation,path=self.params&&self.params.path;
   if(!path){$(container).append($('<p>').text('Не найден путь ресурсов виджета. Проверьте загрузку архива.'));return;}
   path=path.replace(/\/$/,'');
   if(!document.getElementById('f5-styles'))$('<link>',{id:'f5-styles',rel:'stylesheet',href:path+'/styles.css'}).appendTo('head');
   var host=$('<main>',{id:'f5-root'}).appendTo(container);
   require([path+'/core.js',path+'/app.js',path+'/api.js'],function(Core,App,Api){
    if(current!==generation)return;
    var abort=new AbortController(),progress=function(){};
    var api=Api.create(read,{signal:abort.signal,origin:window.location.origin,progress:function(key,count,pages){progress(key,count,pages);}});
    cleanup=App.mount(host[0],Core,{snapshot:api.snapshot,events:api.events,setProgress:function(callback){progress=callback;},dispose:function(){abort.abort();}},{implementationDate:self.get_settings().implementation_date});
   },function(){if(current===generation)host.text('Не удалось загрузить ресурсы виджета. Проверьте ZIP и консоль браузера.');});
  }
  this.callbacks={
   render:function(){return true;},init:function(){watchMenu();return true;},bind_actions:function(){return true;},
   settings:function(body){if(body&&body.length)start(body);return true;},
   advancedSettings:function(){var target=$('#work_area');if(target.length)start(target);return true;},
   onSave:function(){return true;},destroy:function(){if(menuObserver)menuObserver.disconnect();menuObserver=null;var item=document.getElementById('f5-result-menu-item');if(item)item.remove();var style=document.getElementById('f5-menu-styles');if(style)style.remove();clear();$('#f5-styles').remove();return true;}
  };
 };
});
