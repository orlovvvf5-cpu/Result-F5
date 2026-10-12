(function(root,factory){if(typeof define==='function'&&define.amd)define([],factory);else root.F5App=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function mount(root,C,adapter,options={}){
 if(root.__f5Cleanup)root.__f5Cleanup();
 const controller=new AbortController(),fmt=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
 let data=null,result=null,current=[],destroyed=false,busy=false,chartKey='created',params={implementation:'',before:['',''],after:['',''],filters:{}};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const value=m=>m.value===null?'—':fmt.format(m.value)+(m.unit==='percent'?'%':m.unit==='days'?' дн.':m.unit==='money'?' (валюта аккаунта)':'');
 const filter=(k,label)=>`<label>${label}<select data-filter="${k}"><option value="">Все доступные</option></select></label>`;
 root.innerHTML=`<div class="f5-shell"><header><div class="f5-brand">Ф<span>5</span></div><div><div class="eyebrow">КОМАНДА Ф5 / АНАЛИТИКА ПРОДАЖ</div><h1>Результат F5</h1></div><span class="f5-badge" id="f5-account">Аккаунт не загружен</span></header>
 <section class="f5-intro"><h2>Показатели вашего аккаунта</h2><p>Только данные amoCRM, доступные текущему пользователю. Никаких демонстрационных значений.</p></section>
 <div class="f5-note">События отражают доступную историю, а не гарантированно все события за весь срок работы аккаунта. Удалённые и скрытые карточки могут отсутствовать. Равная длина периодов не гарантирует равного покрытия историей. Рост продаж не доказывает влияние внедрения Ф5.</div>
 <section class="f5-connection"><div><h2>Источник: текущий аккаунт amoCRM</h2><p id="f5-loaded">Данные ещё не получены</p></div><button id="f5-refresh">Обновить данные аккаунта</button><p id="f5-status" role="status" aria-live="polite"></p></section>
 <p id="f5-load-error" role="alert"></p>
 <section class="f5-controls"><div class="f5-periods"><label>Дата внедрения Ф5<input type="date" id="f5-implementation"></label><fieldset><legend><i class="f5-dot before"></i>До внедрения</legend><input aria-label="Начало периода до" type="date" id="f5-b0"><span>—</span><input aria-label="Конец периода до" type="date" id="f5-b1"></fieldset><fieldset><legend><i class="f5-dot after"></i>После внедрения</legend><input aria-label="Начало периода после" type="date" id="f5-a0"><span>—</span><input aria-label="Конец периода после" type="date" id="f5-a1"></fieldset><button id="f5-auto">По 28 дней</button><button id="f5-apply">Рассчитать по событиям</button></div><div class="f5-filters">${filter('pipeline','Воронка сейчас')}${filter('manager','Ответственный сделки сейчас')}${filter('source','Источник сделки сейчас')}<div class="f5-timezone" id="f5-timezone">Часовой пояс: ожидаем API</div></div><p>Фильтры описывают текущий сегмент доступных сделок, а не их назначения в прошлом. События без доступной карточки включены только при выборе «Все доступные».</p></section>
 <p id="f5-error" role="alert"></p><div id="f5-report" hidden><div class="f5-section-title"><h2>Было → стало · доступные данные</h2><span>Равные периоды · <b id="f5-days"></b> дней</span></div><section class="f5-cards" id="f5-cards"></section><section class="f5-chart-panel"><div class="f5-section-title"><div><h2>Динамика по неделям</h2><p>Недели от начала каждого периода; последняя может быть неполной. Успешные сделки учитываются уникально внутри каждой недели; недельные числа могут не складываться в итог периода.</p></div><select id="f5-chart-key" aria-label="Показатель графика"></select></div><div class="f5-legend"><span><i class="f5-dot before"></i>До внедрения</span><span><i class="f5-dot after"></i>После внедрения</span></div><div id="f5-chart"></div></section></div>
 <section id="f5-current" hidden><div class="f5-section-title"><h2>Задачи · текущее состояние</h2></div><p>Эти значения получены сейчас. Они не подставляются в сравнение прошлых периодов. API не обеспечивает атомарный снимок: данные могут изменяться во время выгрузки.</p><div class="f5-cards" id="f5-current-cards"></div></section>
 <section class="f5-history"><div><div class="eyebrow">ПРОВЕРЯЕМЫЙ РАСЧЁТ</div><h2>История важнее текущего состояния</h2><p>Текущие бюджеты и задачи не описывают прошлое. Если восстановление не подтверждено, вместо значения показываем причину.</p></div><div class="f5-history-card"><span class="f5-warning">Недостаточно исторических данных</span><p>Без сервера виджет читает API, пока открыт браузер. Постоянный сбор событий и регулярные снимки при закрытом браузере здесь не выполняются.</p></div></section>
 <footer>Результат F5 · 0.2.0 · только чтение <span>Сумма сделок ≠ оплаты. Права пользователя ограничивают выборку.</span></footer>
 <dialog id="f5-dialog"><div class="f5-dialog-head"><h2 id="f5-dialog-title"></h2><button id="f5-close" aria-label="Закрыть">✕</button></div><div id="f5-dialog-body"></div></dialog></div>`;
 const q=s=>root.querySelector(s);
 function setBusy(v){busy=v;root.querySelectorAll('input,select,button').forEach(el=>{if(el.id!=='f5-close')el.disabled=v;});}
 function status(text){if(!destroyed)q('#f5-status').textContent=text;}
 function readParams(){params.implementation=q('#f5-implementation').value;params.before=[q('#f5-b0').value,q('#f5-b1').value];params.after=[q('#f5-a0').value,q('#f5-a1').value];}
 function presets(){const t=C.date(q('#f5-implementation').value);if(!Number.isFinite(t))return;q('#f5-b0').value=C.iso(t-28*C.DAY);q('#f5-b1').value=C.iso(t-C.DAY);q('#f5-a0').value=C.iso(t);q('#f5-a1').value=C.iso(t+27*C.DAY);readParams();}
 function invalidate(){result=null;q('#f5-report').hidden=true;readParams();q('#f5-error').textContent=C.validate(params,data)||'Периоды изменены. Нажмите «Рассчитать по событиям».';}
 function populate(){const dict=C.dictionaries(data);for(const k of ['pipeline','manager','source']){const sel=q('[data-filter="'+k+'"]');sel.innerHTML='<option value="">Все доступные</option>'+dict[k].map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');if(dict[k].some(([id])=>id===params.filters[k]))sel.value=params.filters[k];else params.filters[k]='';}}
 function drawCurrent(){if(!data)return;current=C.current(data,params.filters);q('#f5-current').hidden=false;q('#f5-current-cards').innerHTML=current.map((m,i)=>`<article class="f5-card"><h3>${esc(m.title)}</h3><div class="f5-values"><strong>${value(m)}</strong></div><p>${m.value===null?esc(m.reason):`${m.count??m.rows.length} ${m.key==='currentOverdue'?'задач':'сделок'} в расчёте`}</p><button data-current="${i}">Формула и сделки ↗</button></article>`).join('');}
 function draw(){
  result=C.compare(data,params);q('#f5-error').textContent=result.error||'';q('#f5-report').hidden=!!result.error;if(result.error)return;
  q('#f5-days').textContent=(C.date(params.before[1])-C.date(params.before[0]))/C.DAY+1;
  q('#f5-cards').innerHTML=result.before.map((b,i)=>{const a=result.after[i],delta=a.value===null||b.value===null?null:a.value-b.value,good=delta!==null&&(b.lower?delta<0:delta>0);let change='Нет базы для сравнения';if(delta!==null)change=b.unit==='percent'?`${delta>0?'+':''}${fmt.format(delta)} п.п.`:b.value===0?(a.value===0?'Без изменений':'База равна нулю'):`${delta>0?'+':''}${fmt.format(delta/b.value*100)}%`;
   return `<article class="f5-card"><div class="f5-card-heading"><h3>${esc(b.title)}</h3><span class="f5-number">0${i+1}</span></div><div class="f5-values"><div><small>БЫЛО</small><strong>${value(b)}</strong></div><span class="f5-arrow">→</span><div><small>СТАЛО</small><strong>${value(a)}</strong></div></div>${b.value===null||a.value===null?`<p class="f5-missing">Недостаточно исторических данных</p>`:''}<div class="f5-card-foot"><span class="f5-delta ${good?'good':delta===0||delta===null?'neutral':'bad'}">${change}</span><button data-detail="${i}">Расчёт и сделки ↗</button></div><small>${b.rows.length} → ${a.rows.length} доступных сделок в расчёте</small>${b.notice?`<p class="f5-scope">${esc(b.notice)}</p>`:''}</article>`;
  }).join('');
  const available=result.before.filter(m=>m.value!==null&&result.after.find(a=>a.key===m.key).value!==null);if(!available.some(m=>m.key===chartKey))chartKey=available[0]?.key;
  q('#f5-chart-key').innerHTML=available.map(m=>`<option value="${m.key}" ${m.key===chartKey?'selected':''}>${esc(m.title)}</option>`).join('');drawChart();
 }
 function drawChart(){
  if(!chartKey){q('#f5-chart').textContent='Нет подтверждённых данных для графика.';return;}
  const b=C.weeks(data,params.before,params.filters,chartKey),a=C.weeks(data,params.after,params.filters,chartKey),max=Math.max(1,...b.concat(a).map(w=>w.value||0));
  q('#f5-chart').innerHTML=`<div class="f5-bars">${b.map((w,i)=>`<div class="f5-week"><div class="f5-bar-pair">${[w,a[i]].map((v,j)=>`<div class="f5-bar-column"><span>${v.value===null?'—':fmt.format(v.value)}</span><div class="f5-bar ${j?'after':'before'}" style="height:${v.value===null?0:Math.max(2,v.value/max*140)}px"></div></div>`).join('')}</div><strong>Неделя ${i+1}${w.days<7?' · '+w.days+' дн.':''}</strong><small>${esc(w.label)} / ${esc(a[i].label)}</small></div>`).join('')}</div>`;
 }
 function show(title,html){q('#f5-dialog-title').textContent=title;q('#f5-dialog-body').innerHTML=html;q('#f5-dialog').showModal();}
 function table(m){return `<p>${esc(m.formula)}</p>${m.reason?`<p class="f5-missing">${esc(m.reason)}</p>`:''}${m.notice?`<p>${esc(m.notice)}</p>`:''}<p>${m.rows.length} доступных сделок${m.count!==undefined?' · '+m.count+' задач':''}</p><div class="f5-table-scroll"><table><thead><tr><th>Сделка</th><th>Создана</th><th>Наблюдаемый успех</th></tr></thead><tbody>${m.rows.map(l=>`<tr><td><a href="/leads/detail/${Number(l.id)}" target="_blank" rel="noopener">${esc(l.name||'Сделка #'+l.id)} · #${Number(l.id)}</a>${l.unavailable?' (карточка недоступна)':''}</td><td>${l.created_at?esc(C.localDate(l.created_at*1000,data.timezone)):'Неизвестно'}</td><td>${l.success_at?esc(C.localDate(l.success_at*1000,data.timezone)):'—'}</td></tr>`).join('')||'<tr><td colspan="3">Нет подтверждённых записей</td></tr>'}</tbody></table></div>`;}
 async function calculate(){
  if(!data||!adapter)return;if(busy)return;readParams();const error=C.validate(params,data);if(error){q('#f5-error').textContent=error;q('#f5-report').hidden=true;return;}
  setBusy(true);q('#f5-report').hidden=true;status('Загружаем события выбранных периодов…');
  const from=C.boundary(params.before[0],data.timezone),to=C.boundary(C.addDays(params.after[1],1),data.timezone);
  try{const events=await adapter.events(data,from,to);if(destroyed)return;data.events=events;data.eventFrom=from;data.eventTo=to;data.eventError='';status(`История загружена: ${events.length} доступных событий смены этапа. Полнота старой истории не гарантирована.`);}
  catch(e){if(destroyed)return;data.events=null;data.eventError='События недоступны: '+e.message;status(data.eventError);}
  finally{if(!destroyed){setBusy(false);draw();}}
 }
 async function load(){
  if(busy)return;if(!adapter){status('Откройте установленный виджет внутри amoCRM. Вне аккаунта данные недоступны; демонстрационные значения не используются.');return;}
  setBusy(true);result=null;data=null;q('#f5-report').hidden=true;q('#f5-current').hidden=true;q('#f5-load-error').textContent='';q('#f5-account').textContent='Загрузка аккаунта…';status('Читаем API текущего аккаунта…');
  try{const snapshot=await adapter.snapshot();if(destroyed)return;data=snapshot;populate();q('#f5-account').textContent=data.account.name+' · #'+data.account.id;q('#f5-timezone').textContent='Часовой пояс: '+data.timezone;
   const times=new Intl.DateTimeFormat('ru-RU',{timeZone:data.timezone,dateStyle:'short',timeStyle:'short'});q('#f5-loaded').textContent=`Выгрузка ${times.format(data.startedAt)} — ${times.format(data.loadedAt)} · ${data.leads.length} доступных сделок`;
   drawCurrent();status(data.warnings.length?data.warnings.join(' · '):'Данные аккаунта загружены. Укажите дату внедрения и периоды.');
  }catch(e){if(!destroyed){q('#f5-account').textContent='Аккаунт не загружен';q('#f5-load-error').textContent='Не удалось загрузить данные: '+e.message;status('Расчёты остановлены. Проверьте доступ к API и повторите обновление.');}}
  finally{if(!destroyed)setBusy(false);}
  if(data&&!destroyed){readParams();if(!C.validate(params,data))await calculate();else invalidate();}
 }
 root.addEventListener('change',e=>{
  if(e.target.id==='f5-chart-key'){chartKey=e.target.value;drawChart();return;}
  if(e.target.dataset.filter){params.filters[e.target.dataset.filter]=e.target.value;drawCurrent();if(result&&!result.error)draw();return;}
  if(e.target.id==='f5-implementation')presets();invalidate();
 },{signal:controller.signal});
 root.addEventListener('click',e=>{
  const detail=e.target.closest('[data-detail]'),now=e.target.closest('[data-current]');
  if(detail&&result&&!result.error){const i=Number(detail.dataset.detail);show(result.before[i].title,'<h3>До</h3>'+table(result.before[i])+'<h3>После</h3>'+table(result.after[i]));}
  if(now&&current.length){const m=current[Number(now.dataset.current)];show(m.title,table(m));}
  if(e.target.id==='f5-close')q('#f5-dialog').close();if(e.target.id==='f5-auto'){presets();invalidate();}
  if(e.target.id==='f5-apply')calculate();if(e.target.id==='f5-refresh')load();
 },{signal:controller.signal});
 if(Number.isFinite(C.date(options.implementationDate))){q('#f5-implementation').value=options.implementationDate;presets();}
 if(adapter&&adapter.setProgress)adapter.setProgress((key,count,pages)=>status(`Загрузка ${key}: ${count} записей, страниц ${pages}…`));
 root.__f5Cleanup=()=>{destroyed=true;controller.abort();if(adapter&&adapter.dispose)adapter.dispose();root.innerHTML='';delete root.__f5Cleanup;};
 load();return root.__f5Cleanup;
}
return {mount};
});
