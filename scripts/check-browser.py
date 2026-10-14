"""Browser verification against mocked API responses. Never contacts a CRM account.
Requires Playwright + Chromium, and npm start (default URL http://127.0.0.1:8080).
"""
import json,sys
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8080'
sec=lambda s:int(datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp())
lead=lambda i,s,status,manager:{'id':i,'name':'Проверочная сделка '+str(i),'account_id':123,'created_at':sec(s),'status_id':status,'pipeline_id':1,'responsible_user_id':manager,'price':987654,'source_id':2,'_embedded':{'source':{'id':2,'name':'Сайт'}}}
event=lambda i,s:{'id':i,'account_id':123,'entity_id':1,'entity_type':'lead','created_at':sec(s),'type':'lead_status_changed','value_before':[{'lead_status':{'id':10,'pipeline_id':1}}],'value_after':[{'lead_status':{'id':142,'pipeline_id':1}}]}
rows={'leads':[lead(1,'2026-05-10',142,5),lead(2,'2026-06-05',10,6),lead(3,'2026-05-20',10,5)],'users':[{'id':5,'name':'Анна'},{'id':6,'name':'Илья'}],'pipelines':[{'id':1,'account_id':123,'name':'Продажи'}],'tasks':[{'id':77,'account_id':123,'entity_id':3,'entity_type':'leads','is_completed':False,'complete_till':sec('2026-06-15')}],'events':[event('a','2026-05-25'),event('b','2026-06-10')]}
mode={'value':'ok'};requests=[]
def route_handler(route):
 path=urlparse(route.request.url).path;requests.append((route.request.method,path))
 if mode['value']=='deny':route.fulfill(status=403,content_type='application/problem+json',body='{}');return
 if mode['value']=='events-deny' and path.endswith('/events'):route.fulfill(status=403,content_type='application/problem+json',body='{}');return
 if path.endswith('/account'):body={'id':123,'name':'Проверочный аккаунт','_embedded':{'datetime_settings':{'timezone':'Europe/Moscow'}}}
 else:
  key=path.rsplit('/',1)[-1];body={'_embedded':{key:rows[key]},'_links':{}}
 route.fulfill(status=200,content_type='application/hal+json',body=json.dumps(body,ensure_ascii=False))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1100},locale='ru-RU');page.set_default_timeout(10000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/api/v4/**',route_handler)
 page.goto(base);assert page.locator('.f5-card').count()==0;assert 'демонстрационные значения не используются' in page.locator('#f5-status').inner_text()
 page.add_script_tag(url=base+'/api.js')
 def mount():
  page.evaluate('''()=>{const c=new AbortController();const api=F5Api.create(async url=>{const r=await fetch(url,{signal:c.signal});if(r.status===204)return null;if(!r.ok)throw Object.assign(new Error('HTTP '+r.status),{status:r.status});return r.json();},{origin:location.origin,signal:c.signal,interval:0});F5App.mount(document.getElementById('f5-root'),F5Core,{snapshot:api.snapshot,events:api.events,dispose:()=>c.abort()},{implementationDate:'2026-06-01'});}''')
 mount();page.wait_for_function("document.querySelector('#f5-chart-key').options.length > 0 && !document.querySelector('#f5-apply').disabled")
 assert 'Проверочный аккаунт · #123' in page.locator('#f5-account').inner_text()
 assert 'Europe/Moscow' in page.locator('#f5-timezone').inner_text()
 assert page.locator('#f5-cards .f5-card').count()==7
 assert [x.strip() for x in page.locator('#f5-cards .f5-card').first.locator('.f5-values strong').all_text_contents()]==['2','1']
 assert [x.strip() for x in page.locator('#f5-cards .f5-card').nth(1).locator('.f5-values strong').all_text_contents()]==['1','1']
 assert page.locator('#f5-cards .f5-missing').count()==4
 assert page.locator('#f5-current-cards .f5-values strong').all_text_contents()==['1','1']
 page.locator('[data-detail="1"]').click();assert page.locator('dialog a').first.get_attribute('href')=='/leads/detail/1';page.locator('#f5-close').click()
 page.locator('[data-filter=manager]').select_option('6');assert page.locator('#f5-cards .f5-card').first.locator('.f5-values strong').all_text_contents()==['0','1']
 page.locator('[data-filter=manager]').select_option('');page.locator('#f5-a1').fill('2026-06-27');assert page.locator('#f5-report').is_visible();assert page.locator('#f5-cards .f5-card').count()==7;assert set(page.locator('#f5-cards .f5-values strong').all_text_contents())=={'—'};assert 'одинаковой длины' in page.locator('#f5-error').inner_text()
 page.locator('#f5-auto').click();page.locator('#f5-apply').click();page.wait_for_function("document.querySelector('#f5-chart-key').options.length > 0 && !document.querySelector('#f5-apply').disabled")
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 mode['value']='events-deny';page.locator('#f5-apply').click();page.wait_for_function("document.querySelector('#f5-chart-key').options.length > 0 && !document.querySelector('#f5-apply').disabled");assert page.locator('#f5-cards .f5-card').nth(1).locator('.f5-values strong').all_text_contents()==['—','—'];page.wait_for_function("document.querySelector('#f5-status').textContent.includes('403') && !document.querySelector('#f5-apply').disabled");assert '403' in page.locator('#f5-status').inner_text()
 mode['value']='deny';page.locator('#f5-refresh').click();page.wait_for_selector('#f5-load-error:text-matches("403")');assert not page.locator('#f5-report').is_visible();assert not page.locator('#f5-current').is_visible()
 mode['value']='ok'
 rows['leads']=[lead(1,'2026-09-30',142,5),lead(2,'2026-10-07',10,6),lead(3,'2026-10-08',10,5)]
 rows['events']=[event('recent-before','2026-10-02'),event('recent-after','2026-10-09')]
 page.evaluate("Date.now=()=>Date.parse('2026-10-13T07:30:00Z')")
 mount();page.wait_for_function("!document.querySelector('#f5-refresh').disabled")
 page.locator('#f5-implementation').fill('2026-10-06')
 page.wait_for_function("document.querySelector('#f5-status').textContent.includes('История загружена') && !document.querySelector('#f5-apply').disabled")
 assert page.locator('#f5-b0').input_value()=='2026-09-29'
 assert page.locator('#f5-b1').input_value()=='2026-10-05'
 assert page.locator('#f5-a0').input_value()=='2026-10-06'
 assert page.locator('#f5-a1').input_value()=='2026-10-12'
 assert page.locator('#f5-days').inner_text()=='7'
 assert page.locator('#f5-cards .f5-card').count()==7
 assert page.locator('#f5-cards .f5-card').first.locator('.f5-values strong').all_text_contents()==['1','2']
 # amoCRM settings can place the widget inside a form: buttons must not submit it.
 page.evaluate("()=>{const root=document.getElementById('f5-root');const form=document.createElement('form');root.before(form);form.appendChild(root);window.submits=0;form.addEventListener('submit',e=>{e.preventDefault();window.submits++;});}")
 page.locator('#f5-implementation').fill('')
 page.locator('#f5-auto').click()
 assert 'Сначала выберите дату внедрения' in page.locator('#f5-status').inner_text()
 assert page.locator('#f5-implementation').evaluate('(e)=>e===document.activeElement')
 page.locator('#f5-apply').click()
 assert page.evaluate('window.submits')==0
 assert page.locator('button:not([type="button"])').count()==0
 page.locator('#f5-implementation').fill('2026-10-06')
 page.wait_for_function("document.querySelector('#f5-status').textContent.includes('История загружена') && !document.querySelector('#f5-apply').disabled")
 assert page.evaluate('window.submits')==0
 page.set_viewport_size({'width':1440,'height':1000})
 page.evaluate("document.getElementById('f5-root').style.width='860px'")
 assert page.locator('#f5-root').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
 assert page.locator('#f5-root').evaluate("(e)=>getComputedStyle(e).backgroundColor==='rgb(255, 255, 255)'")
 assert page.locator('#f5-apply').evaluate("(e)=>getComputedStyle(e).backgroundColor==='rgb(17, 141, 81)'")
 # A visual reference uses the same explicitly mocked API, never real customer records.
 page.locator('#f5-root').screenshot(path=str(Path(__file__).resolve().parents[1]/'docs/design-0.2.3.png'))
 assert all(method=='GET' for method,path in requests);assert not errors,errors
 print('PASS: no demo fallback; live-shaped mocked API; account/timezone; metrics; current tasks; real-ID links; filters; invalid periods; mobile; 403 events/account; GET only. Not a real-account test.')
 b.close()
