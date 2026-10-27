/**
 * 曲库服务（core/music.js）
 * 双曲库：
 *  1. 本地曲库：public/songs/songs.json（下载到本地的免版权音乐）
 *  2. 在线曲库：三级链路
 *     ① 项目自带 NetEase API 服务（/api/online/*，本地 npm run dev 时由 Vite 代理，同源无跨域）
 *     ② GD Studio 公共音乐 API（HTTPS + CORS，纯前端静态部署也能直连，见 https://music-api.gdstudio.xyz）
 *     ③ 旧公共实例（仅 http，HTTPS 页面下会被浏览器拦截，作最后兜底）
 *     三者均不可用时回退本地曲库。
 */

import { EMOTION_VA } from './recommend.js'

/** 静态资源前缀（兼容 GitHub Pages 子路径部署） */
const BASE = import.meta.env.BASE_URL

/**
 * 静态托管标记（GitHub Pages 等无 Node 后端的环境）
 * 构建时传入 VITE_STATIC_DEPLOY=1 即跳过 /api 与 http 明文兜底，避免无谓的 404 与混合内容拦截
 */
const STATIC_DEPLOY = import.meta.env.VITE_STATIC_DEPLOY === '1'

/** 页面是否为 HTTPS：HTTP 明文接口在 HTTPS 页面下会被浏览器拦截 */
const IS_HTTPS = typeof location !== 'undefined' && location.protocol === 'https:'

/** ② GD Studio 公共 API：HTTPS + CORS( * )，静态托管环境的主力通道 */
const GDSTUDIO = 'https://music-api.gdstudio.xyz/api.php'

/** ③ 旧公共实例（http 明文，仅本地/HTTP 环境可用） */
const PUBLIC_API = 'http://iwenwiki.com:3000'

/** 最近一次在线搜索实际使用的通道，供 UI 展示 */
let lastEngine = ''
export function getOnlineEngine() { return lastEngine }

/** 加载本地曲库 */
export async function loadLocalSongs() {
  const res = await fetch(`${BASE}songs/songs.json`)
  if (!res.ok) throw new Error('本地曲库加载失败')
  const data = await res.json()
  return data.songs.map(s => ({ ...s, url: `${BASE}songs/${encodeURIComponent(s.file)}`, source: 'local' }))
}

function pickSongs(json) {
  return json?.result?.songs || json?.songs || []
}

/** 关键词词典：为在线歌曲启发式推断 VA 坐标 */
const VA_LEXICON = [
  { kw: ['治愈', '温柔', '安静', '钢琴', '轻音乐', '舒缓', '睡前', '助眠', '白噪音', '冥想'], dv: 0.22, da: -0.28 },
  { kw: ['欢快', '愉快', '快乐', '开心', '阳光', '活力', '动感', '节奏', '电子', '派对', '嗨', 'DJ'], dv: 0.18, da: 0.35 },
  { kw: ['伤感', '悲伤', '失恋', '眼泪', '哭', '孤独', '分手', '雨', '遗憾', '失望'], dv: -0.35, da: -0.15 },
  { kw: ['愤怒', '暴躁', '重金属', '燃', '炸', '摇滚', '说唱'], dv: -0.28, da: 0.38 },
  { kw: ['放松', '平静', '大自然', '森林', '海边', '散步', '下午茶'], dv: 0.15, da: -0.30 },
  { kw: ['甜蜜', '恋爱', '浪漫', '告白', '心动'], dv: 0.35, da: 0.05 }
]

/** 由歌名/歌手/专辑文本推断 VA 与情绪标签（启发式） */
export function guessVA(text = '') {
  const t = text.toLowerCase()
  let v = 0.55
  let a = 0.50
  for (const rule of VA_LEXICON) {
    if (rule.kw.some(k => t.includes(k.toLowerCase()))) { v += rule.dv; a += rule.da }
  }
  v = Math.max(0.05, Math.min(0.95, v))
  a = Math.max(0.05, Math.min(0.95, a))
  let tag = 'neutral'
  let best = Infinity
  for (const [emo, va] of Object.entries(EMOTION_VA)) {
    const d = (va.v - v) ** 2 + (va.a - a) ** 2
    if (d < best) { best = d; tag = emo }
  }
  return { v: +v.toFixed(3), a: +a.toFixed(3), tags: [tag] }
}

/**
 * 归一化：兼容两种数据源
 *  - NetEase 原生结构：{ id, name, artists:[{name}], album:{ picUrl }, ... }
 *  - GD Studio 结构：  { id, name, artist:['x'], album:'专辑名', pic_id, url_id }
 */
function normalize(songs) {
  return songs.slice(0, 20).map(s => {
    const rawArtist = s.artists || s.artist || []
    const artist = (Array.isArray(rawArtist) ? rawArtist : [rawArtist])
      .map(x => (typeof x === 'string' ? x : x?.name))
      .filter(Boolean).join(' / ') || '未知歌手'
    const albumName = typeof s.album === 'string' ? s.album : (s.album?.name || '')
    const va = guessVA(`${s.name || ''} ${artist} ${albumName}`)
    return {
      id: 'ne_' + s.id,
      urlId: s.url_id || s.id,
      title: s.name || '未知曲目',
      artist,
      // GD Studio 的封面接口返回 JSON 而非图片二进制，无法直接作为 <img src>，故留空走渐变色块兜底
      cover: s.album?.picUrl || s.album?.artist?.img1v1Url || '',
      v: va.v, a: va.a, tags: va.tags,
      quality: 0.7,
      source: 'online'
    }
  })
}

/** 在线搜索：① 自带服务 → ② GD Studio → ③ 旧公共实例 */
export async function onlineSearch(keywords, limit = 15) {
  const kw = keywords || ''
  const q = encodeURIComponent(kw)

  // ① 项目自带 API 服务（npm run dev 时经 Vite 代理访问，同源无跨域）
  if (!STATIC_DEPLOY) {
    try {
      const r = await fetch(`/api/online/search?keywords=${q}&limit=${limit}`)
      if (r.ok) {
        const songs = pickSongs(await r.json())
        if (songs.length) { lastEngine = '本地 NetEase API 服务'; return normalize(songs) }
      }
    } catch (e) { /* 静态部署无该服务，继续兜底 */ }
  }

  // ② GD Studio 公共 API（HTTPS + CORS，纯静态站点可用）
  try {
    const r = await fetch(`${GDSTUDIO}?types=search&source=netease&name=${q}&count=${limit}&pages=1`)
    if (r.ok) {
      const list = await r.json()
      const songs = Array.isArray(list) ? list : pickSongs(list)
      if (songs.length) { lastEngine = 'GD Studio 公共 API'; return normalize(songs) }
    }
  } catch (e) { /* 继续兜底 */ }

  // ③ 旧公共实例（http，HTTPS 页面下会被 mixed-content 拦截）
  if (!IS_HTTPS) {
    try {
      const r = await fetch(`${PUBLIC_API}/search?keywords=${q}&limit=${limit}`)
      if (r.ok) {
        const songs = pickSongs(await r.json())
        if (songs.length) { lastEngine = '公共 NetEase 实例'; return normalize(songs) }
      }
    } catch (e) { /* 继续兜底 */ }
  }

  throw new Error('在线音乐服务暂不可用，可切换到本地曲库')
}

/** 解析在线歌曲播放地址（三级兜底，结果由调用方缓存） */
export async function resolveOnlineUrl(song) {
  const id = song.urlId || song.id

  // ① 自带服务
  if (!STATIC_DEPLOY) {
    try {
      const r = await fetch(`/api/online/url?id=${id}&br=320000`)
      if (r.ok) {
        const u = (await r.json())?.data?.[0]?.url
        if (u) return u
      }
    } catch (e) { /* 继续兜底 */ }
  }

  // ② GD Studio
  try {
    const r = await fetch(`${GDSTUDIO}?types=url&source=netease&id=${id}&br=320000`)
    if (r.ok) {
      const j = await r.json()
      if (j?.url) return j.url
    }
  } catch (e) { /* 继续兜底 */ }

  // ③ 旧公共实例
  if (!IS_HTTPS) {
    try {
      const r = await fetch(`${PUBLIC_API}/song/url?id=${id}&br=320000`)
      if (r.ok) {
        const u = (await r.json())?.data?.[0]?.url
        if (u) return u
      }
    } catch (e) { /* 继续兜底 */ }
  }

  throw new Error('该歌曲暂无播放地址（可能受版权限制或已下架）')
}
