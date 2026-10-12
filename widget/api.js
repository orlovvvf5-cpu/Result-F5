(function(root,factory){if(typeof define==='function'&&define.amd)define([],factory);else if(typeof module==='object'&&module.exports)module.exports=factory();else root.F5Api=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function create(read,options={}){
 const signal=options.signal,origin=options.origin||location.origin,interval=options.interval??400,maxPages=options.maxPages??1000;
 let last=0,queue=Promise.resolve();
 function cancelled(){if(signal&&signal.aborted)throw new Error('Загрузка отменена');}
 function delay(ms){return new Promise((resolve,reject)=>{cancelled();const stop=()=>{clearTimeout(timer);reject(new Error('Загрузка отменена'));};const timer=setTimeout(()=>{if(signal)signal.removeEventListener('abort',stop);resolve();},ms);if(signal)signal.addEventListener('abort',stop,{once:true});});}
 function path(value){const url=new URL(value,origin);if(url.origin!==origin||!/^\/api\/v4\/(account|users|events|tasks|leads(?:\/pipelines)?)(?:\?|$)/.test(url.pathname+url.search))throw new Error('API вернул ссылку вне разрешённых методов текущего аккаунта');return url.pathname+url.search;}
 function request(value){const task=queue.then(async()=>{
  const url=path(value);for(let attempt=0;attempt<4;attempt++){
   cancelled();await delay(Math.max(0,interval-(Date.now()-last)));cancelled();last=Date.now();
   try{return await read(url);}catch(err){if(signal&&signal.aborted)throw err;if(![429,502,503,504].includes(err.status)||attempt===3)throw err;
    const raw=err.retryAfter,seconds=Number(raw),date=Date.parse(raw);const wait=raw&&Number.isFinite(seconds)?seconds*1000:raw&&Number.isFinite(date)?date-Date.now():1000*2**attempt;
    if(wait>120000)throw new Error('API запросил ожидание больше двух минут. Повторите обновление позже.');await delay(Math.max(1000,wait));
   }
  }
 });queue=task.catch(()=>{});return task;}
 async function list(url,key,accountId){
  const rows=new Map(),visited=new Set();let next=path(url),pages=0;
  while(next){cancelled();if(visited.has(next)||++pages>maxPages)throw new Error('Не удалось завершить пагинацию '+key+'. Частичная выборка не используется.');visited.add(next);
   const body=await request(next);if(body===null||body===undefined)break;
   const batch=body._embedded&&body._embedded[key];if(!Array.isArray(batch))throw new Error('Неожиданный ответ API: нет коллекции '+key);
   for(const row of batch){if(row.id===undefined||row.id===null)throw new Error('В '+key+' отсутствует ID');if(accountId!==undefined&&Number(row.account_id)!==Number(accountId))throw new Error('Данные '+key+' принадлежат другому аккаунту или не содержат account_id');rows.set(String(row.id),row);}
   if(options.progress)options.progress(key,rows.size,pages);
   const link=body._links&&body._links.next&&body._links.next.href;
   if(link)next=path(link);
   else {const u=new URL(next,origin),limit=Number(u.searchParams.get('limit')||250);if(batch.length===limit){u.searchParams.set('page',Number(u.searchParams.get('page')||1)+1);next=path(u.href);}else next=null;}
  }
  return [...rows.values()];
 }
 async function snapshot(){
  const startedAt=Date.now(),account=await request('/api/v4/account?with=datetime_settings');
  if(!account||!Number.isSafeInteger(account.id)||account.id<=0)throw new Error('API не вернул ID текущего аккаунта');
  const timezone=account._embedded&&account._embedded.datetime_settings&&account._embedded.datetime_settings.timezone;
  if(!timezone)throw new Error('API не вернул часовой пояс аккаунта. Расчёт по дням остановлен.');new Intl.DateTimeFormat('ru-RU',{timeZone:timezone}).format();
  const warnings=[];let users=[],pipelines=[],tasks=null;
  try{pipelines=await list('/api/v4/leads/pipelines','pipelines',account.id);}catch(e){warnings.push('Названия воронок недоступны: '+e.message);}
  try{users=await list('/api/v4/users?limit=250','users');}catch(e){warnings.push('Названия менеджеров недоступны: '+e.message);}
  const leads=await list('/api/v4/leads?with=source,source_id&limit=250&order[id]=asc','leads',account.id);
  for(const l of leads)if(!Number.isSafeInteger(l.id)||l.id<=0||!Number.isFinite(l.created_at)||l.created_at<=0||!Number.isFinite(l.status_id)||!Number.isFinite(l.pipeline_id)||!Number.isFinite(l.responsible_user_id))throw new Error('Неполная модель сделки '+l.id+'. Расчёт остановлен.');
  let taskError='';try{tasks=await list('/api/v4/tasks?filter[is_completed]=0&filter[entity_type]=leads&limit=250','tasks',account.id);
   for(const t of tasks)if(!Number.isSafeInteger(t.id)||!Number.isSafeInteger(t.entity_id)||t.entity_id<=0||typeof t.is_completed!=='boolean'||!Number.isFinite(t.complete_till))throw new Error('Неполная модель задачи '+t.id);
  }catch(e){taskError=e.message;tasks=null;warnings.push('Текущие задачи недоступны: '+e.message);}
  cancelled();return {account,timezone,leads:leads.filter(l=>!l.is_deleted),tasks,taskError,users,pipelines,warnings,startedAt,loadedAt:Date.now(),events:null,eventError:'События ещё не загружены'};
 }
 async function events(snapshot,from,to){
  const query=new URLSearchParams({'limit':'100','filter[entity]':'lead','filter[type]':'lead_status_changed','filter[created_at][from]':String(Math.floor(from/1000)),'filter[created_at][to]':String(Math.floor((to-1)/1000))});
  const events=await list('/api/v4/events?'+query,'events',snapshot.account.id);
  for(const e of events){const b=e.value_before&&e.value_before[0]&&e.value_before[0].lead_status,a=e.value_after&&e.value_after[0]&&e.value_after[0].lead_status;
   if(e.type!=='lead_status_changed'||e.entity_type!=='lead'||!Number.isSafeInteger(e.entity_id)||e.entity_id<=0||!Number.isFinite(e.created_at)||e.created_at*1000<from||e.created_at*1000>=to||!a||!b||!Number.isFinite(a.id)||!Number.isFinite(b.id))throw new Error('Некорректное событие этапа '+e.id+'. Исторические показатели не вычислены.');
  }
  return events;
 }
 return {snapshot,events,list,request};
}
return {create};
});
