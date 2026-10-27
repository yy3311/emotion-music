/**
 * 在线音乐 API 服务（server/api.cjs）
 * 基于 NeteaseCloudMusicApi（网易云音乐 Node.js API），提供：
 *   GET /api/online/search?keywords=xx&limit=15   搜索歌曲
 *   GET /api/online/url?id=123&br=320000          解析播放地址
 *   GET /api/online/detail?ids=1,2,3              歌曲详情
 *   GET /api/health                               健康检查
 * 启动：node server/api.cjs（npm run dev 会一并启动）
 */
const express = require('express')
const cors = require('cors')
const ncm = require('NeteaseCloudMusicApi')

const app = express()
app.use(cors())

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'emotion-music api' }))

app.get('/api/online/search', async (req, res) => {
  try {
    const r = await ncm.search({ keywords: String(req.query.keywords || ''), limit: Number(req.query.limit) || 15 })
    res.json(r.body)
  } catch (e) { res.status(500).json({ code: 500, msg: String(e.message || e) }) }
})

app.get('/api/online/url', async (req, res) => {
  try {
    const r = await ncm.song_url({ id: Number(req.query.id), br: Number(req.query.br) || 320000 })
    res.json(r.body)
  } catch (e) { res.status(500).json({ code: 500, msg: String(e.message || e) }) }
})

app.get('/api/online/detail', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter(Boolean).map(Number)
    const r = await ncm.song_detail({ ids })
    res.json(r.body)
  } catch (e) { res.status(500).json({ code: 500, msg: String(e.message || e) }) }
})

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[emotion-music] 在线音乐 API 服务已启动: http://127.0.0.1:${PORT}`)
})
