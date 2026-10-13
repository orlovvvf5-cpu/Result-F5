(function(root,factory){if(typeof define==='function'&&define.amd)define([],factory);else if(typeof module==='object'&&module.exports)module.exports=factory();else root.F5Core=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DAY=86400000,iso=t=>new Date(t).toISOString().slice(0,10);
function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return NaN;const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&iso(t)===s?t:NaN;}
const formatters=new Map();
function localDate(t,tz){if(!formatters.has(tz))formatters.set(tz,new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}));const p=Object.fromEntries(formatters.get(tz).formatToParts(t).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;}
function addDays(s,n){return iso(date(s)+n*DAY);}
function boundary(s,tz){const t=date(s);if(!Number.isFinite(t))throw new Error('Некорректная дата');let lo=Math.floor((t-2*DAY)/1000),hi=Math.floor((t+2*DAY)/1000);while(lo<hi){const m=Math.floor((lo+hi)/2);if(localDate(m*1000,tz)<s)lo=m+1;else hi=m;}if(localDate(lo*1000,tz)!==s)throw new Error('Эта дата отсутствует в часовом поясе аккаунта');return lo*1000;}
function validate(p,data){
 if([...p.before,...p.after,p.implementation].some(x=>!Number.isFinite(date(x))))return 'Укажите дату внедрения и оба периода.';
 if(p.before[0]>p.before[1]||p.after[0]>p.after[1])return 'Начало периода должно предшествовать окончанию.';
 if(p.before[1]>=p.implementation||p.after[0]<p.implementation)return 'Период «до» должен завершиться до внедрения, период «после» — начаться не раньше внедрения.';
 if(date(p.before[1])-date(p.before[0])!==date(p.after[1])-date(p.after[0]))return 'Для сопоставимости выберите периоды одинаковой длины.';
 if(data&&p.after[1]>=localDate(data.loadedAt,data.timezone))return 'Выберите завершённые дни: конец периода должен быть раньше сегодняшней даты в аккаунте.';
 if(p.before[0]<'1970-01-02')return 'Выберите даты после 01.01.1970.';
 return '';
}
function sourceId(l){return String(l.source_id??(l._embedded&&l._embedded.source&&l._embedded.source.id)??'none');}
function matches(l,f){return (!f.pipeline||String(l.pipeline_id)===f.pipeline)&&(!f.manager||String(l.responsible_user_id)===f.manager)&&(!f.source||sourceId(l)===f.source);}
function dictionaries(data){const u=new Map(data.users.map(x=>[String(x.id),x.name])),p=new Map(data.pipelines.map(x=>[String(x.id),x.name])),sources=new Map();for(const l of data.leads){u.set(String(l.responsible_user_id),u.get(String(l.responsible_user_id))||'Менеджер #'+l.responsible_user_id);p.set(String(l.pipeline_id),p.get(String(l.pipeline_id))||'Воронка #'+l.pipeline_id);sources.set(sourceId(l),(l._embedded&&l._embedded.source&&l._embedded.source.name)||(sourceId(l)==='none'?'Источник не указан':'Источник #'+sourceId(l)));}return {manager:[...u],pipeline:[...p],source:[...sources]};}
function spec(key,title,unit,formula,lower=false){return {key,title,unit,formula,lower,rows:[],value:null,reason:'Недостаточно исторических данных'};}
function definitions(){
 return [
  spec('created','Новые сделки','count','Количество доступных, неудалённых сделок, созданных в периоде (created_at). Это полная выгрузка доступных карточек, не всех когда-либо существовавших сделок.'),
  spec('won','Успешные сделки','count','Количество уникальных сделок с переходом из другого статуса в «Успешно реализовано» (142) в доступных событиях периода. Повторные переходы одной сделки в периоде считаются один раз. Это не утверждение о первом успехе за всё время.'),
  spec('conversion','Конверсия за 28 дней','percent','Предполагаемое правило: доля созданных в периоде сделок, успешно закрытых в течение 28 суток. Требуется полная история когорты, включая удалённые сделки, и последующее наблюдение. Отношение успешных к новым не используется.'),
  spec('revenue','Сумма успешных сделок','money','Сумма бюджетов на момент успешного перехода, не оплаты. Текущие price не подставляются в исторический показатель.'),
  spec('duration','До наблюдаемого успеха','days','Среднее число суток от created_at до самого раннего доступного успешного перехода ВНУТРИ выбранного периода для каждой сделки. После переоткрытий это может отличаться от первого успеха за всё время.',true),
  spec('overdue','Просроченные задачи','count','Количество незавершённых задач с прошедшим сроком на конец исторического периода. Текущий список задач не является историческим снимком.',true),
  spec('noTask','Активные без следующей задачи','count','Активные сделки без незавершённой задачи на конец исторического периода. Требуется состояние сделок и задач на ту дату.',true)
 ];
}
function suggestPeriods(implementation,data,maxDays=28){
 if(!Number.isFinite(date(implementation))||!data)return null;
 const today=localDate(data.loadedAt,data.timezone),days=Math.min(maxDays,Math.round((date(today)-date(implementation))/DAY));
 if(days<1)return null;
 return {implementation,before:[addDays(implementation,-days),addDays(implementation,-1)],after:[implementation,addDays(implementation,days-1)],days};
}
function period(data,range,f={}){
 const start=boundary(range[0],data.timezone),end=boundary(addDays(range[1],1),data.timezone),byId=new Map(data.leads.map(l=>[l.id,l]));
 const filtered=data.leads.filter(l=>matches(l,f)),created=filtered.filter(l=>l.created_at*1000>=start&&l.created_at*1000<end);
 const winRows=new Map();const eventReady=Array.isArray(data.events)&&start>=data.eventFrom&&end<=data.eventTo;
 if(eventReady)for(const e of data.events){const a=e.value_after[0].lead_status,b=e.value_before[0].lead_status,t=e.created_at*1000,l=byId.get(e.entity_id);
  if(t<start||t>=end||a.id!==142||b.id===142)continue;
  if((f.pipeline||f.manager||f.source)&&(!l||!matches(l,f)))continue;
  if(!winRows.has(e.entity_id)||e.created_at<winRows.get(e.entity_id).success_at)winRows.set(e.entity_id,{...(l||{id:e.entity_id,name:'Карточка недоступна',unavailable:true}),success_at:e.created_at});
 }
 const wins=[...winRows.values()],durationRows=wins.filter(l=>Number.isFinite(l.created_at)&&l.created_at>0&&l.created_at<=l.success_at);
 const metrics=definitions();
 Object.assign(metrics[0],{value:created.length,rows:created,reason:''});
 if(eventReady){Object.assign(metrics[1],{value:wins.length,rows:wins,reason:'',notice:'По доступным событиям API; сроки хранения и полнота старой истории не гарантированы.'});
  if(wins.length&&durationRows.length===wins.length)Object.assign(metrics[4],{value:durationRows.reduce((s,l)=>s+(l.success_at-l.created_at)/86400,0)/wins.length,rows:durationRows,reason:''});
  else metrics[4].reason=wins.length?'Нет даты создания для части успешных сделок. Среднее по неполной выборке не показано.':'Нет доступных успешных переходов для расчёта среднего.';
 }else{metrics[1].reason=data.eventError||'События выбранного периода не загружены';metrics[4].reason=metrics[1].reason;}
 metrics[2].reason='Полнота истории 28-дневной когорты не подтверждена.';
 metrics[3].reason='Бюджет на момент закрытия не восстановлен из истории.';
 metrics[5].reason='Нет исторического снимка задач на конец периода.';
 metrics[6].reason='Нет исторического состояния сделок и задач на конец периода.';
 return metrics;
}
function compare(data,p){const error=validate(p,data);return error?{error}:{before:period(data,p.before,p.filters),after:period(data,p.after,p.filters)};}
function weeks(data,range,f,key){const out=[];for(let s=range[0];s<=range[1];s=addDays(s,7)){const e=addDays(s,6)>range[1]?range[1]:addDays(s,6);const m=period(data,[s,e],f).find(x=>x.key===key);out.push({label:s,days:(date(e)-date(s))/DAY+1,value:m.value});}return out;}
function current(data,f={}){
 const leads=data.leads.filter(l=>matches(l,f)),byId=new Map(data.leads.map(l=>[l.id,l])),active=leads.filter(l=>![142,143].includes(l.status_id));
 const result=[spec('currentOverdue','Просроченные задачи сейчас','count','Доступные незавершённые задачи сделок с complete_till раньше начала выгрузки. Фильтр менеджера — текущий ответственный сделки, не исполнитель задачи.',true),spec('currentNoTask','Активные без доступной задачи сейчас','count','Текущие активные сделки (статус не 142/143), для которых API не вернул ни одной незавершённой задачи. Просроченная задача тоже считается следующей. При ограниченных правах скрытые задачи не видны.',true)];
 if(!Array.isArray(data.tasks)){for(const m of result)m.reason=data.taskError||'Задачи недоступны';return result;}
 const tasks=data.tasks.filter(t=>!t.is_completed&&t.entity_type==='leads'),overdue=tasks.filter(t=>t.complete_till>0&&t.complete_till*1000<data.startedAt&&(!(f.pipeline||f.manager||f.source)||(byId.has(t.entity_id)&&matches(byId.get(t.entity_id),f))));
 const taskLeadIds=new Set(tasks.map(t=>t.entity_id)),noTask=active.filter(l=>!taskLeadIds.has(l.id));
 const rows=[...new Set(overdue.map(t=>t.entity_id))].map(id=>byId.get(id)||{id,name:'Карточка недоступна',unavailable:true});
 Object.assign(result[0],{value:overdue.length,count:overdue.length,rows,reason:''});Object.assign(result[1],{value:noTask.length,rows:noTask,reason:''});return result;
}
return {definitions,suggestPeriods,DAY,iso,date,addDays,localDate,boundary,validate,sourceId,matches,dictionaries,period,compare,weeks,current};
});
