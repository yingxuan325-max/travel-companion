(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const STORAGE = "littleTrip.v1";
  let state = loadState();
  let selectedDate = window.TRIP_DAYS[0].date;
  let foodFilter = "全部";
  let toastTimer;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}");
      return {stops: saved.stops || {}, expenses: saved.expenses || [], foods: saved.foods || [...window.FOOD_STARTERS], completed: saved.completed || {}, checks: saved.checks || {}};
    } catch { return {stops:{},expenses:[],foods:[...window.FOOD_STARTERS],completed:{},checks:{}}; }
  }
  function saveState() { localStorage.setItem(STORAGE, JSON.stringify(state)); updateSpent(); }
  function toast(message) {
    const el=$("#toast"); el.textContent=message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
  }
  function dayStops(day) { return [...day.stops, ...(state.stops[day.date] || [])].sort((a,b)=>String(a.time).localeCompare(String(b.time))); }
  function formatDate(iso, year=false) {
    const d=new Date(iso+"T12:00:00");
    return `${year?d.getFullYear()+"年":""}${d.getMonth()+1}月${d.getDate()}日`;
  }
  function weekday(iso) { return ["日","一","二","三","四","五","六"][new Date(iso+"T12:00:00").getDay()]; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  function renderDayStrip() {
    $("#day-strip").innerHTML=window.TRIP_DAYS.map((d,i)=>`<button class="day-chip ${d.date===selectedDate?"active":""}" data-date="${d.date}"><small>DAY ${i+1}</small><strong>${d.date.slice(8)}</strong><em>${d.city}</em></button>`).join("");
    $("#stop-date").innerHTML=window.TRIP_DAYS.map(d=>`<option value="${d.date}" ${d.date===selectedDate?"selected":""}>${formatDate(d.date)} · ${d.city}</option>`).join("");
  }
  function renderTimeline() {
    const day=window.TRIP_DAYS.find(d=>d.date===selectedDate); if(!day)return;
    $("#selected-date-title").textContent=`${formatDate(day.date)} · 星期${weekday(day.date)}`;
    $("#selected-city").textContent=`${day.city} · ${day.label}`;
    $("#day-note").textContent=day.note;
    const stops=dayStops(day);
    $("#day-summary").innerHTML=`<span class="summary-pill">📍 ${stops.length} 个安排</span><span class="summary-pill">🚇 交通时间仅供参考</span><span class="summary-pill">☁️ 留一点自由时间</span>`;
    $("#timeline").innerHTML=stops.length?stops.map((s,i)=>{
      const key=`${day.date}|${s.time}|${s.name}`;
      const done=!!state.completed[key];
      const maps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name+" "+s.area)}`;
      return `<article class="stop"><div class="stop-time">${escapeHtml(s.time)}</div><div class="timeline-pin"><span class="pin-dot"></span></div><div class="stop-card"><div class="stop-title-row"><span class="stop-title">${escapeHtml(s.name)}</span><span class="city-tag">${escapeHtml(s.area||day.city)}</span></div><div class="stop-meta">${escapeHtml(s.transport||"交通待定")}　·　${escapeHtml(s.duration||"时间待定")}<br>${escapeHtml(s.detail||"")}</div><div class="stop-actions"><button class="mini-btn ${done?"done":""}" data-done="${escapeHtml(key)}">${done?"✓ 已完成":"○ 标记完成"}</button><a class="mini-btn" href="${maps}" target="_blank" rel="noopener noreferrer">查看地图 ↗</a>${s.custom?`<button class="mini-btn" data-delete-stop="${escapeHtml(key)}">删除</button>`:""}</div></div></article>`;
    }).join(""):`<div class="empty-state">今天还没有安排，点击「添加行程」吧 🌷</div>`;
  }
  function renderTransport() {
    $("#transport-list").innerHTML=window.TRANSPORT_GUIDE.map(t=>`<article class="transport-card"><div class="transport-icon">${t.icon}</div><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.desc)}</p><div class="transport-route">↗ ${escapeHtml(t.route)}</div><p style="margin-top:10px">💡 ${escapeHtml(t.tip)}</p></article>`).join("");
  }
  function updateSpent() {
    const total=state.expenses.reduce((n,e)=>n+Number(e.amount||0),0);
    $("#spent-stat").textContent=`RM ${total.toFixed(2)}`;
    if($("#budget-total"))$("#budget-total").textContent=`RM ${total.toFixed(2)}`;
  }
  function renderBudget() {
    const categories=["交通","美食","门票","住宿","购物","其他"];
    const total=state.expenses.reduce((n,e)=>n+Number(e.amount||0),0);
    $("#category-bars").innerHTML=categories.map(cat=>{
      const amount=state.expenses.filter(e=>e.category===cat).reduce((n,e)=>n+Number(e.amount||0),0);
      const width=total?amount/total*100:0;
      return `<div class="category-row"><span>${cat}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><strong>RM ${amount.toFixed(2)}</strong></div>`;
    }).join("");
    $("#expense-list").innerHTML=state.expenses.length?[...state.expenses].reverse().map((e,idx)=>`<div class="expense-row"><div><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.category)} · ${escapeHtml(e.payer||"未填写")} · ${escapeHtml(e.date||"")}</small></div><span class="expense-amount">RM ${Number(e.amount).toFixed(2)} <button class="delete-btn" data-delete-expense="${state.expenses.length-1-idx}" title="删除">×</button></span></div>`).join(""):`<div class="empty-state">还没有花费记录。第一杯奶茶也值得记下来 🧋</div>`;
    updateSpent();
  }
  function renderFood() {
    const foods=state.foods.filter(f=>foodFilter==="全部"||f.city===foodFilter);
    $("#food-grid").innerHTML=foods.length?foods.map((f)=>`<article class="food-card"><div class="food-art">${escapeHtml(f.emoji||"🍡")}</div><h3>${escapeHtml(f.name)}</h3><p>${escapeHtml(f.address||"地址待补充")}<br>${escapeHtml(f.note||"")}</p><div class="food-bottom"><span class="food-tag">${escapeHtml(f.city)} · ${escapeHtml(f.type)}</span><button class="delete-btn" data-delete-food="${escapeHtml(f.name)}" title="删除收藏">×</button></div></article>`).join(""):`<div class="empty-state">这个城市还没有收藏，添加一个吧 ✨</div>`;
  }
  function renderAll() { renderDayStrip(); renderTimeline(); renderTransport(); renderBudget(); renderFood(); }
  function showView(name) {
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
    $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  $$(".nav-btn").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  $("#day-strip").addEventListener("click",e=>{const b=e.target.closest("[data-date]");if(!b)return;selectedDate=b.dataset.date;renderDayStrip();renderTimeline();});
  $("#add-stop-btn").addEventListener("click",()=>{$("#stop-date").value=selectedDate;$("#stop-dialog").showModal();});
  $("#stop-form").addEventListener("submit",e=>{
    e.preventDefault(); const date=$("#stop-date").value;
    const stop={time:$("#stop-time").value,name:$("#stop-name").value.trim(),area:$("#stop-area").value.trim(),transport:$("#stop-transport").value.trim()||"交通待定",duration:$("#stop-duration").value.trim()||"时间待定",detail:"同行者添加的行程",custom:true};
    if(!stop.name)return;
    state.stops[date]=state.stops[date]||[];state.stops[date].push(stop);selectedDate=date;saveState();$("#stop-dialog").close();e.target.reset();renderAll();toast("行程添加成功 ✨");
  });
  $("#timeline").addEventListener("click",e=>{
    const done=e.target.closest("[data-done]");
    if(done){state.completed[done.dataset.done]=!state.completed[done.dataset.done];saveState();renderTimeline();return;}
    const del=e.target.closest("[data-delete-stop]");
    if(del){const key=del.dataset.deleteStop;const [date,time,...rest]=key.split("|");const name=rest.join("|");state.stops[date]=(state.stops[date]||[]).filter(s=>!(s.time===time&&s.name===name));saveState();renderTimeline();toast("已删除自定义行程");}
  });
  $$(".check-row input").forEach(input=>{input.checked=!!state.checks[input.dataset.check];input.addEventListener("change",()=>{state.checks[input.dataset.check]=input.checked;saveState();});});
  $("#add-expense-btn").addEventListener("click",()=>{$("#expense-name").focus();$("#expense-name").scrollIntoView({behavior:"smooth",block:"center"});});
  $("#expense-form").addEventListener("submit",e=>{
    e.preventDefault();state.expenses.push({name:$("#expense-name").value.trim(),amount:Number($("#expense-amount").value),category:$("#expense-category").value,payer:$("#expense-payer").value.trim()||"未填写",date:formatDate(selectedDate)});
    saveState();renderBudget();e.target.reset();toast("花费已保存 💰");
  });
  $("#expense-list").addEventListener("click",e=>{const b=e.target.closest("[data-delete-expense]");if(!b)return;state.expenses.splice(Number(b.dataset.deleteExpense),1);saveState();renderBudget();toast("已删除花费记录");});
  $$(".filter-chip").forEach(b=>b.addEventListener("click",()=>{foodFilter=b.dataset.foodFilter;$$(".filter-chip").forEach(x=>x.classList.toggle("active",x===b));renderFood();}));
  $("#add-food-btn").addEventListener("click",()=>$("#food-dialog").showModal());
  $("#food-form").addEventListener("submit",e=>{
    e.preventDefault();state.foods.unshift({name:$("#food-name").value.trim(),city:$("#food-city").value,type:$("#food-type").value,address:$("#food-address").value.trim()||"地址待补充",emoji:$("#food-type").value==="美食"?"🍜":"📍",note:"同行者添加的收藏"});
    saveState();renderFood();$("#food-dialog").close();e.target.reset();toast("已加入收藏 ♡");
  });
  $("#food-grid").addEventListener("click",e=>{const b=e.target.closest("[data-delete-food]");if(!b)return;const item=state.foods.find(f=>f.name===b.dataset.deleteFood);if(!item)return;if(!confirm(`删除「${item.name}」？`))return;state.foods.splice(state.foods.indexOf(item),1);saveState();renderFood();});
  $("#share-help").addEventListener("click",()=>$("#share-dialog").showModal());
  $("#export-btn").addEventListener("click",()=>$("#export-dialog").showModal());
  $("#download-json").addEventListener("click",()=>{
    const payload={tripDays:window.TRIP_DAYS,state,exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="little-trip-backup.json";a.click();URL.revokeObjectURL(a.href);$("#export-dialog").close();toast("备份文件已生成");
  });
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.close).close()));
  // Cross-tab changes on the same browser profile are reflected automatically.
  window.addEventListener("storage",e=>{if(e.key===STORAGE){state=loadState();renderAll();}});
  $("#sync-status").textContent="本机预览模式";
  renderAll();
})();