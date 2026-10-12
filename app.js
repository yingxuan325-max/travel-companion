(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const STORAGE = "littleTrip.v1";
  let state = loadState();
  let selectedDate = window.TRIP_DAYS[0].date;
  let supabaseClient = null;
  let cloudReady = false;
  let applyingCloudUpdate = false;
  let cloudSaveTimer = null;
  const TRIP_ID = window.TRAVEL_CONFIG?.tripId || "china-trip-2026";
  let foodFilter = "全部";
  let currentEdit = null;
  let lang = "zh";
  let toastTimer;
  let myrToCnyRate = null;
  let exchangeRateUpdatedAt = "";
  const FALLBACK_MYR_TO_CNY = 4.85;
  const i18n = {
    zh:{itinerary:"每日行程",budget:"旅行花费",food:"美食 & 收藏",itineraryHeading:"每日行程",budgetHeading:"旅行花费",foodHeading:"美食 & 收藏",addStop:"＋ 添加行程",addExpense:"＋ 记录花费",addFood:"＋ 添加收藏",markDone:"○ 标记完成",done:"✓ 已完成",edit:"编辑 ✎",remove:"删除 ×",map:"高德地图 ↗",all:"全部",noStops:"今天还没有安排，点击「添加行程」吧 🌷",noExpenses:"还没有花费记录。第一杯奶茶也值得记下来 🧋",noFoods:"这个城市还没有收藏，添加一个吧 ✨",saved:"修改已保存 ♡",cancelDelete:"确定删除这项内容吗？",deleted:"已删除",expenseAdded:"花费已保存 💰",foodAdded:"已加入收藏 ♡",stopAdded:"行程添加成功 ✨",addTitle:"添加行程 ✨",editStop:"编辑行程 ✎",editFood:"编辑收藏 ✎",editExpense:"编辑花费 ✎",name:"名称",date:"日期",time:"时间",city:"城市",area:"区域 / 备注",transport:"交通方式",duration:"预计时间",address:"地址 / 备注",type:"类型",note:"补充说明",amount:"金额",currency:"货币",category:"分类",payer:"付款人",save:"保存修改",rm:"马币支出 · MYR",rmb:"人民币支出 · CNY",mapHint:"高德地图可能需要在中国大陆网络环境中测试。",language:"中文 / EN",expenseDateFilter:"日期筛选",allDates:"全部日期",filteredTotal:"筛选期间总花费"},
    en:{itinerary:"Itinerary",budget:"Travel Expenses",food:"Food & Saves",itineraryHeading:"Itinerary",budgetHeading:"Travel Expenses",foodHeading:"Food & Saves",addStop:"+ Add stop",addExpense:"+ Add expense",addFood:"+ Add save",markDone:"○ Mark done",done:"✓ Done",edit:"Edit ✎",remove:"Delete ×",map:"Amap ↗",all:"All",noStops:"No plans yet. Add a stop! 🌷",noExpenses:"No expenses recorded yet.",noFoods:"No saved places in this city yet.",saved:"Changes saved ♡",cancelDelete:"Are you sure you want to delete this item?",deleted:"Deleted",expenseAdded:"Expense saved 💰",foodAdded:"Place saved ♡",stopAdded:"Stop added ✨",addTitle:"Add a stop ✨",editStop:"Edit itinerary ✎",editFood:"Edit saved place ✎",editExpense:"Edit expense ✎",name:"Name",date:"Date",time:"Time",city:"City",area:"Area / notes",transport:"Transport",duration:"Duration",address:"Address / notes",type:"Type",note:"Additional notes",amount:"Amount",currency:"Currency",category:"Category",payer:"Paid by",save:"Save changes",rm:"MYR expenses",rmb:"CNY expenses",mapHint:"Amap links should be tested on a mainland China network.",language:"EN / 中文"}
  };
  const tr = k => (i18n[lang] && i18n[lang][k]) || i18n.zh[k] || k;
  function loadState(){
    try{const s=JSON.parse(localStorage.getItem(STORAGE)||"{}");return {stops:s.stops||{},expenses:(s.expenses||[]).map(e=>({...e,currency:e.currency||"RM"})),foods:s.foods||[...window.FOOD_STARTERS],completed:s.completed||{},removedStops:s.removedStops||[],stopEdits:s.stopEdits||{}}}
    catch{return {stops:{},expenses:[],foods:[...window.FOOD_STARTERS],completed:{},removedStops:[],stopEdits:{}}}
  }
  function setCloudStatus(message, connected=false){
    const el = $("#cloud-status");
    if(el) el.textContent = message;
    if(el) el.style.color = connected ? "#4f8060" : "#8c7a6b";
  }
  function saveState(){
    localStorage.setItem(STORAGE,JSON.stringify(state));
    if(!supabaseClient || !cloudReady || applyingCloudUpdate) return;
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(async () => {
      try {
        const { error } = await supabaseClient
          .from("trip_shared_state")
          .upsert({
            trip_id: TRIP_ID,
            payload: state,
            updated_at: new Date().toISOString()
          }, { onConflict: "trip_id" });
        if(error) throw error;
        setCloudStatus("云端已同步", true);
      } catch(error) {
        console.error("Supabase save failed:", error);
        setCloudStatus("云端同步失败（本机仍已保存）");
        toast("云端同步失败，请检查 Supabase 配置与 SQL 权限");
      }
    }, 350);
  }
  async function initSupabase(){
    const cfg = window.TRAVEL_CONFIG || {};
    if(!window.supabase?.createClient ||
       !cfg.supabaseUrl || !cfg.supabaseAnonKey ||
       cfg.supabaseUrl.includes("YOUR_SUPABASE") ||
       cfg.supabaseAnonKey.includes("YOUR_SUPABASE")){
      setCloudStatus("尚未连接 Supabase");
      return;
    }
    try {
      supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      setCloudStatus("正在连接云端…");
      const { data, error } = await supabaseClient
        .from("trip_shared_state")
        .select("payload, updated_at")
        .eq("trip_id", TRIP_ID)
        .maybeSingle();
      if(error) throw error;
      if(data && data.payload && typeof data.payload === "object"){
        applyingCloudUpdate = true;
        state = normalizeState(data.payload);
        localStorage.setItem(STORAGE, JSON.stringify(state));
        applyingCloudUpdate = false;
        renderAll();
        setCloudStatus("已载入云端资料", true);
      } else {
        // First connected browser seeds the shared row with its current local data.
        const { error: seedError } = await supabaseClient
          .from("trip_shared_state")
          .insert({ trip_id: TRIP_ID, payload: state, updated_at: new Date().toISOString() });
        if(seedError && seedError.code !== "23505") throw seedError;
        if(seedError?.code === "23505"){
          const retry = await supabaseClient.from("trip_shared_state").select("payload").eq("trip_id", TRIP_ID).single();
          if(retry.error) throw retry.error;
          applyingCloudUpdate = true;
          state = normalizeState(retry.data.payload);
          localStorage.setItem(STORAGE, JSON.stringify(state));
          applyingCloudUpdate = false;
          renderAll();
        }
        setCloudStatus("云端已连接", true);
      }

      // Enable cloud writes only after the initial cloud read/seed has completed.
      cloudReady = true;

      // Keep other open devices in sync. The trip is intentionally a single shared state row.
      supabaseClient.channel("trip-shared-" + TRIP_ID)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "trip_shared_state", filter: "trip_id=eq." + TRIP_ID
        }, payload => {
          if(payload.new?.payload && typeof payload.new.payload === "object"){
            applyingCloudUpdate = true;
            state = normalizeState(payload.new.payload);
            localStorage.setItem(STORAGE, JSON.stringify(state));
            renderAll();
            applyingCloudUpdate = false;
            setCloudStatus("已同步其他设备更新", true);
          }
        }).subscribe(status => {
          if(status === "SUBSCRIBED") setCloudStatus("云端已连接", true);
          if(status === "CHANNEL_ERROR" || status === "TIMED_OUT") setCloudStatus("实时同步暂不可用");
        });
    } catch(error) {
      applyingCloudUpdate = false;
      console.error("Supabase connection failed:", error);
      setCloudStatus("连接失败：请检查 URL、Key、SQL");
    }
  }
  function normalizeState(s){
    return {
      stops: s?.stops || {},
      expenses: (s?.expenses || []).map(e => ({...e, currency:e.currency || "RM"})),
      foods: Array.isArray(s?.foods) ? s.foods : [...window.FOOD_STARTERS],
      completed: s?.completed || {},
      removedStops: s?.removedStops || [],
      stopEdits: s?.stopEdits || {}
    };
  }
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2400)}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function formatDate(iso,year=false){const d=new Date(iso+"T12:00:00");return `${year?d.getFullYear()+"年":""}${d.getMonth()+1}月${d.getDate()}日`}
  function weekday(iso){return ["日","一","二","三","四","五","六"][new Date(iso+"T12:00:00").getDay()]}
  function dayStops(day){const original=day.stops.map((s,i)=>{const key=`${day.date}|base|${i}`;return {...s,...(state.stopEdits[key]||{}),_key:key,_base:true}}).filter(s=>!state.removedStops.includes(s._key));const custom=(state.stops[day.date]||[]).map((s,i)=>({...s,_key:`${day.date}|custom|${s.id||i}`, _base:false})).filter(s=>!state.removedStops.includes(s._key));return [...original,...custom].sort((a,b)=>String(a.time).localeCompare(String(b.time)))}
  function renderDayStrip(){
    $("#day-strip").innerHTML=window.TRIP_DAYS.map((d,i)=>`<button class="day-chip ${d.date===selectedDate?"active":""}" data-date="${d.date}"><small>DAY ${i+1}</small><strong>${d.date.slice(8)}</strong><em>${esc(d.city)}</em></button>`).join("");
    $("#stop-date").innerHTML=window.TRIP_DAYS.map(d=>`<option value="${d.date}" ${d.date===selectedDate?"selected":""}>${formatDate(d.date)} · ${esc(d.city)}</option>`).join("");
  }
  function renderTimeline(){
    const day=window.TRIP_DAYS.find(d=>d.date===selectedDate);if(!day)return;
    $("#selected-date-title").textContent=`${formatDate(day.date)} · 星期${weekday(day.date)}`;$("#selected-city").textContent=`${day.city} · ${day.label}`;
    const stops=dayStops(day);$("#day-summary").innerHTML=`<span class="summary-pill">📍 ${stops.length} 个安排</span><span class="summary-pill">🚇 交通时间仅供参考</span>`;
    $("#timeline").innerHTML=stops.length?stops.map(s=>{const key=s._key;const done=!!state.completed[key];const maps=`https://uri.amap.com/search?keyword=${encodeURIComponent((s.name||"")+" "+(s.area||day.city))}&city=${encodeURIComponent(day.city)}`;return `<article class="stop"><div class="stop-time">${esc(s.time)}</div><div class="timeline-pin"><span class="pin-dot"></span></div><div class="stop-card"><div class="stop-title-row"><span class="stop-title">${esc(s.name)}</span><span class="city-tag">${esc(s.area||day.city)}</span></div><div class="stop-meta">${esc(s.transport||"交通待定")}　·　${esc(s.duration||"时间待定")}<br>${esc(s.detail||"")}</div><div class="stop-actions"><button class="mini-btn ${done?"done":""}" data-done="${esc(key)}">${done?tr("done"):tr("markDone")}</button><a class="mini-btn" href="${maps}" target="_blank" rel="noopener noreferrer">${tr("map")}</a><button class="mini-btn" data-edit-stop="${esc(key)}">${tr("edit")}</button><button class="mini-btn delete-action" data-delete-stop="${esc(key)}">${tr("remove")}</button></div></div></article>`}).join(""):`<div class="empty-state">${tr("noStops")}</div>`;
  }
  function updateTotals(){
    const sum=cur=>state.expenses.filter(e=>(e.currency||"RM")===cur).reduce((n,e)=>n+Number(e.amount||0),0);const rm=sum("RM"),rmb=sum("RMB");
    if($("#budget-total-rm"))$("#budget-total-rm").textContent=`RM ${rm.toFixed(2)}`;if($("#budget-total-rmb"))$("#budget-total-rmb").textContent=`RMB ${rmb.toFixed(2)}`;
  }
  function expenseDateISO(value){
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return value;
    const m=String(value||"").match(/(\d{1,2})月(\d{1,2})日/);
    if(m)return `2026-${String(m[1]).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}`;
    return "";
  }
  function todayISO(){
    const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function currentTime(){const d=new Date();return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
  function displayExpenseDateTime(item){const iso=expenseDateISO(item.date);const dateText=iso?formatDate(iso,true):(item.date||"日期未记录");const timeText=item.time||"时间未记录";return `${dateText} · ${timeText}`;}
  function renderBudget(){
    const cats=["交通","美食","门票","住宿","购物","其他"];
    const select=$("#expense-date-filter");
    const old=select?.value||"all";
    const tripDates=window.TRIP_DAYS.map(d=>d.date);
    const extraDates=[...new Set(state.expenses.map(e=>expenseDateISO(e.date)).filter(Boolean))].filter(d=>!tripDates.includes(d));
    const dates=[...tripDates,...extraDates.sort().reverse()];
    if(select){
      select.innerHTML=`<option value="all">${tr("allDates")}</option>`+dates.map(d=>{
        const tripDay=window.TRIP_DAYS.find(x=>x.date===d);
        const dateLabel=d===todayISO()?"今天":formatDate(d,true);
        return `<option value="${d}">${dateLabel}${tripDay?` · ${esc(tripDay.city)}`:""}</option>`;
      }).join("");
      select.value=(old==="all"||dates.includes(old))?old:"all";
    }
    const dateFilter=select?.value||"all";
    const currencyFilter=$("#expense-currency-filter")?.value||"all";
    // Date filter applies to totals and category bars. Currency filter is deliberately excluded from totals.
    const dateExpenses=state.expenses.filter(e=>dateFilter==="all"||expenseDateISO(e.date)===dateFilter);
    const sum=(list,currency)=>list.filter(e=>(e.currency||"RM")===currency).reduce((n,e)=>n+Number(e.amount||0),0);
    const rmOriginal=sum(dateExpenses,"RM"),rmbOriginal=sum(dateExpenses,"RMB");
    const rate=myrToCnyRate||FALLBACK_MYR_TO_CNY;
    const totalRM=rmOriginal+(rmbOriginal/rate);
    const totalRMB=(rmOriginal*rate)+rmbOriginal;
    const totalRMEl=$("#filtered-total-rm"),totalRMBEl=$("#filtered-total-rmb");
    if(totalRMEl)totalRMEl.textContent=`RM ${totalRM.toFixed(2)}`;
    if(totalRMBEl)totalRMBEl.textContent=`RMB ${totalRMB.toFixed(2)}`;
    const detail=$("#filtered-total-detail");
    if(detail)detail.textContent=`已将 RM ${rmOriginal.toFixed(2)} 与 RMB ${rmbOriginal.toFixed(2)} 自动换算合计`;
    const rateNote=$("#exchange-rate-note");
    if(rateNote){
      rateNote.textContent=myrToCnyRate
        ? `参考汇率：RM 1 ≈ RMB ${myrToCnyRate.toFixed(4)}${exchangeRateUpdatedAt?` · 数据更新时间 ${exchangeRateUpdatedAt}`:""}。数据源发布新汇率后会自动更新。`
        : `暂时无法获取最新汇率，当前暂用参考汇率 RM 1 ≈ RMB ${FALLBACK_MYR_TO_CNY.toFixed(2)}；联网后会自动重试。`;
    }
    const categoryValues=cats.map(cat=>{
      const entries=dateExpenses.filter(e=>e.category===cat);
      const rm=sum(entries,"RM"),rmb=sum(entries,"RMB");
      const amount=currencyFilter==="RM"?rm:currencyFilter==="RMB"?rmb:(rm+rmb/rate);
      const label=currencyFilter==="RM"?`RM ${rm.toFixed(2)}`:currencyFilter==="RMB"?`RMB ${rmb.toFixed(2)}`:`RM ${(rm+rmb/rate).toFixed(2)}`;
      return {cat,rm,rmb,amount,label};
    });
    const maxValue=Math.max(1,...categoryValues.map(x=>x.amount));
    $("#category-bars").innerHTML=categoryValues.map(({cat,amount,label})=>
      `<div class="category-row"><span>${cat}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,(amount/maxValue)*100)}%"></div></div><strong>${label}</strong></div>`
    ).join("");
    const list=$("#expense-list");
    list.innerHTML=dateExpenses.length?[...dateExpenses].map(e=>({...e,_index:state.expenses.indexOf(e)})).sort((a,b)=>`${expenseDateISO(a.date)||""} ${a.time||""}`.localeCompare(`${expenseDateISO(b.date)||""} ${b.time||""}`)).reverse().map(e=>{
      const shownDateTime=displayExpenseDateTime(e);
      return `<div class="expense-row"><div><strong>${esc(e.name)}</strong><small>${esc(e.category)} · ${esc(e.payer||"未填写")}<br><span class="expense-datetime">${esc(shownDateTime)}</span></small></div><span class="expense-amount">${e.currency||"RM"} ${Number(e.amount).toFixed(2)} <span class="card-actions"><button class="mini-btn" data-edit-expense="${e._index}">${tr("edit")}</button><button class="delete-btn" data-delete-expense="${e._index}" title="删除">×</button></span></span></div>`;
    }).join(""):`<div class="empty-state">${tr("noExpenses")}</div>`;
  }
  async function refreshExchangeRate(){
    const note=$("#exchange-rate-note");
    try{
      // Open ER API provides the latest published daily rates; this is not a tick-by-tick forex feed.
      const response=await fetch("https://open.er-api.com/v6/latest/MYR",{cache:"no-store"});
      if(!response.ok)throw new Error("Exchange rate request failed");
      const data=await response.json();
      const rate=Number(data?.rates?.CNY);
      if(!data||data.result!=="success"||!Number.isFinite(rate)||rate<=0)throw new Error("Invalid exchange rate");
      myrToCnyRate=rate;
      exchangeRateUpdatedAt=data.time_last_update_utc?new Date(data.time_last_update_utc).toLocaleString(lang==="zh"?"zh-MY":"en-MY",{dateStyle:"medium",timeStyle:"short"}):"";
      renderBudget();
    }catch(error){
      // Keep the dashboard usable when the API is blocked or the device is offline.
      if(note)note.textContent=`暂时无法获取最新汇率，暂用参考汇率 RM 1 ≈ RMB ${FALLBACK_MYR_TO_CNY.toFixed(2)}。联网后会自动尝试更新；换算金额仅供参考。`;
    }
  }
  function foodImageForType(type){const files={"美食":"美食.png","景点":"景点.png","购物":"购物.png","其他":"其他.png"};return `assets/images/${files[type]||files["其他"]}`;}
  function renderFood(){const foods=state.foods.map((f,i)=>({...f,_index:i})).filter(f=>foodFilter==="全部"||f.city===foodFilter);const typeClass={"美食":"food-type-food","景点":"food-type-attraction","购物":"food-type-shopping","其他":"food-type-other"};$("#food-grid").innerHTML=foods.length?foods.map(f=>`<article class="food-card ${typeClass[f.type]||typeClass["其他"]}"><div class="food-art"><img src="${foodImageForType(f.type)}" alt="${esc(f.type||"其他")}" loading="lazy"></div><h3>${esc(f.name)}</h3><p>${esc(f.address||"地址待补充")}<br>${esc(f.note||"")}</p><div class="food-bottom"><span class="food-tag">${esc(f.city)} · ${esc(f.type)}</span><div class="card-actions"><button class="mini-btn" data-edit-food="${f._index}">${tr("edit")}</button><button class="delete-btn" data-delete-food="${f._index}" title="删除收藏">×</button></div></div></article>`).join(""):`<div class="empty-state">${tr("noFoods")}</div>`}
  function renderAll(){renderDayStrip();renderTimeline();renderBudget();renderFood();applyLanguageLabels()}
  function showView(name){$$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));$$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));window.scrollTo({top:0,behavior:"smooth"})}
  function applyLanguageLabels(){
    const labels={itinerary:tr("itinerary"),budget:tr("budget"),food:tr("food")};$$('.nav-btn').forEach(b=>{const k=b.dataset.view;if(labels[k]){const img=b.querySelector('.nav-image');b.innerHTML='';if(img)b.appendChild(img);const label=document.createElement('span');label.textContent=labels[k];b.appendChild(label)}});
    $("#add-stop-btn").textContent=tr("addStop");$("#add-expense-btn").textContent=tr("addExpense");$("#add-food-btn").textContent=tr("addFood");$("#language-toggle").textContent=tr("language");
    const headings={"view-itinerary":["itineraryHeading","每日行程.png"],"view-budget":["budgetHeading","旅行预算.png"],"view-food":["foodHeading","美食&收藏.png"]};Object.entries(headings).forEach(([id,[key,file]])=>{const h=document.querySelector(`#${id} .section-heading h2`);if(h){const img=h.querySelector('.page-title-image');h.innerHTML='';if(img)h.appendChild(img);h.appendChild(document.createTextNode(tr(key)))}});
    $$("[data-food-filter]").forEach(b=>{const v=b.dataset.foodFilter;b.textContent=v==="全部"?tr("all"):v});
    const expenseFilterLabel=$(".expense-filter-label");if(expenseFilterLabel)expenseFilterLabel.childNodes[0].textContent=tr("expenseDateFilter");const dateFilter=$("#expense-date-filter");if(dateFilter&&dateFilter.options.length)dateFilter.options[0].textContent=tr("allDates");
  }
  function field(label,id,value,type='text',options=null){let control;if(options){control=`<select id="${id}">${options.map(o=>`<option ${String(o.value)===String(value)?'selected':''} value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`}else control=`<input id="${id}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0.01" step="0.01"':''} required>`;return `<label>${esc(label)}${control}</label>`}
  function openEdit(kind,index){
    currentEdit={kind,index};let title='',fields='';
    if(kind==='stop'){const day=window.TRIP_DAYS.find(d=>d.date===selectedDate);const item=dayStops(day).find(s=>s._key===index);if(!item)return;title=tr('editStop');fields=field(tr('time'),'ed-time',item.time,'text')+field(tr('name'),'ed-name',item.name)+field(tr('city'),'ed-city',item.city||day.city,'text',[{value:'深圳',label:'深圳'},{value:'广州',label:'广州'},{value:'香港',label:'香港'}])+field(tr('area'),'ed-area',item.area||'')+field(tr('transport'),'ed-transport',item.transport||'')+field(tr('duration'),'ed-duration',item.duration||'')+field(tr('note'),'ed-note',item.detail||'');}
    if(kind==='food'){const item=state.foods[index];if(!item)return;title=tr('editFood');fields=field(tr('name'),'ed-name',item.name)+field(tr('city'),'ed-city',item.city,'text',[{value:'深圳',label:'深圳'},{value:'广州',label:'广州'},{value:'香港',label:'香港'}])+field(tr('type'),'ed-type',item.type,'text',['美食','景点','购物','其他'].map(x=>({value:x,label:x})))+field(tr('address'),'ed-address',item.address||'')+field(tr('note'),'ed-note',item.note||'');}
    if(kind==='expense'){const item=state.expenses[index];if(!item)return;title=tr('editExpense');fields=field(tr('name'),'ed-name',item.name)+field(tr('amount'),'ed-amount',item.amount,'number')+field(tr('currency'),'ed-currency',item.currency||'RM','text',[{value:'RM',label:'RM · 马币'},{value:'RMB',label:'RMB · 人民币'}])+field(tr('category'),'ed-category',item.category,'text',['交通','美食','门票','住宿','购物','其他'].map(x=>({value:x,label:x})))+field(tr('date'),'ed-date',expenseDateISO(item.date)||todayISO(),'date')+field(tr('time'),'ed-time',item.time||currentTime(),'time')+field(tr('payer'),'ed-payer',item.payer||'');}
    $('#edit-dialog-title').textContent=title;$('#edit-fields').innerHTML=fields;$('#edit-dialog').showModal();
  }
  $('#edit-form').addEventListener('submit',e=>{e.preventDefault();if(!currentEdit)return;const get=id=>$('#'+id)?.value||'';const {kind,index}=currentEdit;
    if(kind==='stop'){const day=window.TRIP_DAYS.find(d=>d.date===selectedDate);const original=dayStops(day).find(s=>s._key===index);if(original){const updated={time:get('ed-time'),name:get('ed-name').trim(),city:get('ed-city'),area:get('ed-area').trim(),transport:get('ed-transport').trim(),duration:get('ed-duration').trim(),detail:get('ed-note').trim()};if(original._base)state.stopEdits[index]=updated;else{const arr=state.stops[selectedDate]||[];const pos=arr.findIndex(s=>` ${selectedDate}|custom|${s.id||arr.indexOf(s)}`.trim()===index);if(pos>=0)arr[pos]={...arr[pos],...updated};}if(updated.city&&day.city!==updated.city){/* the date's main city remains unchanged */}}
    }else if(kind==='food'){state.foods[index]={...state.foods[index],name:get('ed-name').trim(),city:get('ed-city'),type:get('ed-type'),address:get('ed-address').trim(),note:get('ed-note').trim()}}
    else if(kind==='expense'){state.expenses[index]={...state.expenses[index],name:get('ed-name').trim(),amount:Number(get('ed-amount')),currency:get('ed-currency'),category:get('ed-category'),payer:get('ed-payer').trim(),date:get('ed-date')||todayISO(),time:get('ed-time')||currentTime()}}
    saveState();$('#edit-dialog').close();renderAll();toast(tr('saved'));currentEdit=null;
  });
  $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('#language-toggle').addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';renderAll()});
  $('#day-strip').addEventListener('click',e=>{const b=e.target.closest('[data-date]');if(!b)return;selectedDate=b.dataset.date;renderDayStrip();renderTimeline()});
  $('#add-stop-btn').addEventListener('click',()=>{$('#stop-date').value=selectedDate;$('#stop-dialog').showModal()});
  $('#stop-form').addEventListener('submit',e=>{e.preventDefault();const date=$('#stop-date').value;const stop={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),time:$('#stop-time').value,name:$('#stop-name').value.trim(),area:$('#stop-area').value.trim(),transport:$('#stop-transport').value.trim()||'交通待定',duration:$('#stop-duration').value.trim()||'时间待定',detail:'同行者添加的行程',custom:true};if(!stop.name)return;state.stops[date]=state.stops[date]||[];state.stops[date].push(stop);selectedDate=date;saveState();$('#stop-dialog').close();e.target.reset();renderAll();toast(tr('stopAdded'))});
  $('#timeline').addEventListener('click',e=>{const done=e.target.closest('[data-done]');if(done){state.completed[done.dataset.done]=!state.completed[done.dataset.done];saveState();renderTimeline();return}const edit=e.target.closest('[data-edit-stop]');if(edit){openEdit('stop',edit.dataset.editStop);return}const del=e.target.closest('[data-delete-stop]');if(del){if(!confirm(tr('cancelDelete')))return;const key=del.dataset.deleteStop;if(key.includes('|base|'))state.removedStops.push(key);else{const day=window.TRIP_DAYS.find(d=>d.date===selectedDate);state.stops[selectedDate]=(state.stops[selectedDate]||[]).filter(s=>`${selectedDate}|custom|${s.id||''}`!==key&&!key.endsWith(`|${(state.stops[selectedDate]||[]).indexOf(s)}`));}saveState();renderTimeline();toast(tr('deleted'))}});
  $('#add-expense-btn').addEventListener('click',()=>{$('#expense-name').focus();$('#expense-name').scrollIntoView({behavior:'smooth',block:'center'})});
  $('#expense-date-filter').addEventListener('change',renderBudget);
  $('#expense-currency-filter').addEventListener('change',renderBudget);
  $('#expense-form').addEventListener('submit',e=>{e.preventDefault();state.expenses.push({id:Date.now(),name:$('#expense-name').value.trim(),amount:Number($('#expense-amount').value),currency:$('#expense-currency').value,category:$('#expense-category').value,payer:$('#expense-payer').value.trim()||'未填写',date:todayISO(),time:currentTime()});saveState();renderBudget();e.target.reset();toast(tr('expenseAdded'))});
  $('#expense-list').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-expense]');if(edit){openEdit('expense',Number(edit.dataset.editExpense));return}const del=e.target.closest('[data-delete-expense]');if(del){if(!confirm(tr('cancelDelete')))return;state.expenses.splice(Number(del.dataset.deleteExpense),1);saveState();renderBudget();toast(tr('deleted'))}});
  $$('.filter-chip').forEach(b=>b.addEventListener('click',()=>{foodFilter=b.dataset.foodFilter;$$('.filter-chip').forEach(x=>x.classList.toggle('active',x===b));renderFood()}));
  $('#add-food-btn').addEventListener('click',()=>$('#food-dialog').showModal());
  $('#food-form').addEventListener('submit',e=>{e.preventDefault();state.foods.unshift({id:Date.now(),name:$('#food-name').value.trim(),city:$('#food-city').value,type:$('#food-type').value,address:$('#food-address').value.trim()||'地址待补充',emoji:$('#food-type').value==='美食'?'🍜':'📍',note:'同行者添加的收藏'});saveState();renderFood();$('#food-dialog').close();e.target.reset();toast(tr('foodAdded'))});
  $('#food-grid').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-food]');if(edit){openEdit('food',Number(edit.dataset.editFood));return}const del=e.target.closest('[data-delete-food]');if(!del)return;if(!confirm(tr('cancelDelete')))return;state.foods.splice(Number(del.dataset.deleteFood),1);saveState();renderFood();toast(tr('deleted'))});
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
  renderAll();
  initSupabase();
  refreshExchangeRate();
  window.setInterval(refreshExchangeRate, 30 * 60 * 1000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshExchangeRate()});
})();