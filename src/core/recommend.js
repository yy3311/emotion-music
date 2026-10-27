/**
 * 歌曲推荐算法（core/recommend.js）
 *
 * 理论模型：Russell 情绪环状模型（Valence-Arousal 效价-唤醒度二维空间）
 *   1. 将 7 类情绪映射到 VA 平面上的坐标；
 *   2. 按“音乐治疗”策略为每种情绪设定目标 VA（共鸣/提振/平复/安抚…）；
 *   3. 每首歌曲拥有 VA 坐标与情绪标签；
 *   4. 综合评分 = VA距离匹配 + 情绪标签匹配 + 唤醒度匹配 + 质量分 + 多样性抖动；
 *   5. 生成“情绪旅程”歌单：从当前情绪 VA 沿插值路径平滑过渡到目标 VA。
 */

/** 7 类情绪的 VA 坐标（v=愉悦度 0~1，a=唤醒度 0~1） */
export const EMOTION_VA = {
  happy:     { v: 0.85, a: 0.75 },
  surprised: { v: 0.55, a: 0.85 },
  angry:     { v: 0.18, a: 0.85 },
  fearful:   { v: 0.15, a: 0.55 },
  disgusted: { v: 0.25, a: 0.50 },
  sad:       { v: 0.12, a: 0.20 },
  neutral:   { v: 0.50, a: 0.45 }
}

/** 每种情绪的推荐策略与目标 VA */
export const STRATEGIES = {
  happy:      { name: '共鸣增效', target: { v: 0.85, a: 0.80 },
                desc: '你正处于高愉悦高唤醒状态，用明朗、高能量的歌曲延续并放大好心情。' },
  sad:        { name: '渐进提振', target: { v: 0.72, a: 0.35 },
                desc: '悲伤宜疏不宜堵：先安排一首“共鸣曲”接纳情绪，再沿情绪旅程逐步抬升愉悦度、降低唤醒，实现温和提振。' },
  angry:      { name: '平复疏导', target: { v: 0.55, a: 0.25 },
                desc: '高唤醒负面情绪需要出口：先以强节奏适度共鸣，再切换到低唤醒、中愉悦的曲子为情绪降温。' },
  fearful:    { name: '安全安抚', target: { v: 0.62, a: 0.28 },
                desc: '不安时人最需要可控感：用温暖、稳定、慢节奏的音乐逐步重建安全感。' },
  disgusted:  { name: '清新切换', target: { v: 0.75, a: 0.55 },
                desc: '心理不适时转移注意最有效：用轻快、有趣的旋律刷新心情。' },
  surprised:  { name: '顺势探索', target: { v: 0.62, a: 0.50 },
                desc: '高唤醒的惊喜状态：保持探索感与新鲜感，同时让节奏平稳落地。' },
  neutral:    { name: '探索发现', target: { v: 0.68, a: 0.55 },
                desc: '情绪平稳正是发现好音乐的时刻：推荐中高能量、口碑好的曲目激发愉悦。' }
}

/** 情绪象限（用于标签部分匹配） */
const QUADRANT = {
  happy: 'HA', surprised: 'HA', angry: 'LHA', fearful: 'LMA',
  disgusted: 'LMA', sad: 'LLA', neutral: 'MID'
}

/** VA 平面归一化欧氏距离 ∈ [0,1] */
export function vaDistance(a, b) {
  const dv = a.v - b.v
  const da = a.a - b.a
  return Math.min(1, Math.sqrt(dv * dv + da * da) / Math.SQRT2)
}

/** VA 线性插值 */
export function lerpVA(a, b, t) {
  return { v: a.v + (b.v - a.v) * t, a: a.a + (b.a - a.a) * t }
}

/** 伪随机抖动（同 seed 可复现，用于“换一批”） */
function seededRand(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

/**
 * 单曲综合评分
 *  score = 0.45·VA距离匹配 + 0.25·情绪标签匹配 + 0.15·唤醒度匹配 + 0.10·质量分 + 0.05·随机抖动
 */
export function scoreSong(song, targetVA, emotion, rand = Math.random) {
  const sVa = 1 - vaDistance({ v: song.v, a: song.a }, targetVA)
  const tags = song.tags || []
  const sTag = tags.includes(emotion) ? 1 : (tags.some(t => QUADRANT[t] === QUADRANT[emotion]) ? 0.5 : 0)
  const sEnergy = 1 - Math.abs((song.a ?? 0.5) - targetVA.a)
  const sQuality = song.quality ?? 0.7
  const jitter = rand() * 0.05
  return 0.45 * sVa + 0.25 * sTag + 0.15 * sEnergy + 0.10 * sQuality + jitter
}

/**
 * 情绪旅程推荐
 * @param songs 候选曲库（本地或在线）
 * @param emotion 识别出的情绪
 * @param opts { size, seed }
 * @returns { emotion, strategy, current, target, songs:[{...song, matchScore, waypoint, stage}] }
 */
export function recommend(songs, emotion, opts = {}) {
  const size = opts.size || 5
  const seed = opts.seed ?? Date.now() % 100000
  const rand = seededRand(seed)
  const cur = EMOTION_VA[emotion] || EMOTION_VA.neutral
  const tgt = (STRATEGIES[emotion] || STRATEGIES.neutral).target
  const used = new Set()
  const journey = []

  for (let i = 0; i < size; i++) {
    // 第 1 首锚定当前情绪（共鸣曲），后续沿 VA 插值路径推进，末首贴近目标
    const t = size === 1 ? 1 : Math.min(1, (i + 0.4) / size)
    const waypoint = i === 0 ? cur : lerpVA(cur, tgt, t)
    let best = null
    let bestScore = -1
    for (const s of songs) {
      if (used.has(s.id)) continue
      const sc = scoreSong(s, waypoint, emotion, rand)
      if (sc > bestScore) { bestScore = sc; best = s }
    }
    if (!best) break
    used.add(best.id)
    journey.push({
      ...best,
      matchScore: Math.round(Math.min(1, bestScore) * 100),
      waypoint,
      stage: i === 0 ? '共鸣曲' : (i === size - 1 ? '目标曲' : '过渡曲')
    })
  }
  return { emotion, strategy: STRATEGIES[emotion] || STRATEGIES.neutral, current: cur, target: tgt, songs: journey }
}

/** 情绪 → 在线搜索关键词（在线曲库模式；网易云搜索对空格分词支持差，使用无空格复合词） */
export const EMOTION_KEYWORDS = {
  happy: '欢快歌曲',
  sad: '治愈钢琴',
  angry: '平静轻音乐',
  fearful: '舒缓钢琴曲',
  disgusted: '活力歌曲',
  surprised: '电子音乐',
  neutral: '热歌榜'
}
