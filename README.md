# Little Trip · Travel Companion（第一版）

一个可直接运行的手机友好旅行攻略网站。路线根据你上传的攻略截图整理；所有交通时间都是参考信息，出发前必须核对实际车票、开放时间和路线。

## 1. 文件放在哪里

把 `travel-companion` 整个文件夹放到：

`C:\xampp\htdocs\travel-companion\`

文件结构：

```text
travel-companion/
├── index.html
├── README.md
├── css/
│   └── style.css
└── js/
    ├── config.js
    ├── data.js
    └── app.js
```

## 2. 在本机运行

1. 安装并打开 VS Code。
2. 在 VS Code 选择 **File → Open Folder**，打开 `C:\xampp\htdocs\travel-companion`。
3. 若使用 XAMPP，打开 XAMPP Control Panel，启动 Apache。
4. 在 Chrome 打开 `http://localhost/travel-companion/`。
5. 修改代码后刷新浏览器即可看到变化。

这个第一版是静态网站，不需要启动 MySQL。也可以用 VS Code 的 Live Server 预览，但本地地址只在你的电脑上可用。

## 3. 第一版目前包含什么

- 2026/10/25–11/2 每日行程和日期切换
- 行程卡片、地图搜索链接、标记已完成
- 自定义添加/删除行程
- 交通指南（非实时数据）
- 记录旅行花费、分类汇总、删除记录
- 美食和景点收藏、按城市筛选、添加/删除
- 本地旅行清单
- 导出 JSON 备份
- 手机响应式布局

## 4. 重要：本机保存 ≠ 多人共享

默认模式将新增行程、花费、收藏保存在浏览器 `localStorage`。这适合先预览和单机使用；不同朋友的手机不会自动同步。公开部署后，也不会自动变成多人共享。

若需要跨设备共享，需接入云端数据库。下面给出 Supabase 的可选接入准备，但当前第一版的写入逻辑仍是本地模式；不要误以为填写 key 就已经完成同步。下一阶段需要把行程、费用和收藏的读写改为 Supabase API，并配置数据库权限（RLS）。

### 建议的 Supabase 数据表（下一阶段）

先到 Supabase 创建一个项目，再在 SQL Editor 执行：

```sql
create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null default 'greater-bay-2026',
  item_type text not null check (item_type in ('stop','expense','food')),
  item_date date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_items enable row level security;
```

**不要直接开放匿名读写给所有互联网用户。** 共享行程应使用 Supabase Auth、只允许已加入旅行的成员访问的 RLS policy；如果只是短期小组原型，也应至少限制成员并避免存放护照号码、航班证件信息等敏感数据。下一阶段可协助你完整实现登录、成员邀请和 RLS。

将 Supabase Project URL 和 anon/publishable key 放入 `js/config.js` 仅是配置步骤，不会自动连接数据库。绝对不要把 `service_role` key 放到前端。

## 5. 发布成朋友都能打开的网址

### 先发布静态版本（最简单）

1. 注册 GitHub，把项目文件上传到一个 repository。
2. 在 GitHub 仓库进入 **Settings → Pages**。
3. 选择从 `main` 分支的根目录部署并保存。
4. 等待 GitHub Pages 给出公开网址。
5. 用手机流量和 Wi-Fi 测试网址、各页面与地图链接。

也可使用其他静态网站托管平台。不同平台的政策、可用性和免费额度可能变化，请以其官方说明为准。

### 中国大陆访问要求（重要）

- 海外静态托管、字体 CDN、地图服务和海外数据库在中国大陆可能访问缓慢或无法连接；公开网址并不等于在大陆一定稳定。
- CSS 当前使用 Google Fonts 的远程字体；若无法加载，会自动退回本地系统字体。若要更稳，可移除 `style.css` 顶部的 `@import`。
- 核心行程文字直接打包在 `js/data.js`，即使外部字体加载失败，主要行程仍可显示。
- 地图按钮当前使用 Google Maps 搜索链接；大陆环境下可能打不开，用户可复制地点中文名称到当地可用地图应用。
- 若要在中国大陆稳定运营，考虑合规的大陆云服务、域名与备案要求，并在出发前用大陆网络实测。不要把未测试的海外服务当作可靠的旅行关键功能。

## 6. 关于你截图里的行程

我已将截图可辨认的 10/25–11/2 行程整理成初始数据。截图中部分时间、路线和酒店地址不完整，所以保留了“约”“待确认”等提示。截图概览提到珠海，但详细日程目前没有明确珠海日期；珠海先作为可添加城市和美食收藏类别，并未虚构具体一日游路线。

## 7. 建议开发顺序

1. 先确认本机显示正常、行程和预算交互正常。
2. 补齐珠海具体行程、酒店准确地址、车票班次和门票信息。
3. 发布静态网址，所有同行者先测试打开。
4. 下一阶段接 Supabase Auth + 数据表 + RLS，真正实现多人共享和同步。
5. 出发前测试中国大陆网络、地图、登录、同步和离线备份。
