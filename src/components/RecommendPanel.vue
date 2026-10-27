<template>
  <div class="panel recommend-panel">
    <div class="panel-title">
      🎧 情绪歌单推荐 <span class="tag">VA 环状模型 · 情绪旅程算法</span>
    </div>

    <div class="lib-switch">
      <span class="lib-label">曲库：</span>
      <button :class="{ active: library === 'local' }" @click="$emit('switch', 'local')">💾 本地曲库（{{ localCount }}）</button>
      <button :class="{ active: library === 'online' }" @click="$emit('switch', 'online')">☁️ 在线曲库 · 网易云</button>
      <span v-if="onlineLoading" class="online-state">在线搜索中…</span>
      <span v-else-if="onlineError" class="online-error">{{ onlineError }}</span>
    </div>

    <div v-if="!rec" class="empty">
      <div class="empty-icon">🎵</div>
      <p>完成情绪识别后，这里将生成专属情绪歌单</p>
    </div>

    <template v-else>
      <div class="strategy-head">
        <span class="strategy-chip">{{ rec.strategy.name }}</span>
        <span class="strategy-text">{{ rec.strategy.desc }}</span>
      </div>

      <div class="rec-body">
        <div class="va-plane">
          <svg viewBox="0 0 240 240">
            <rect x="30" y="30" width="90" height="90" fill="#5b8def" opacity="0.06" />
            <rect x="120" y="30" width="90" height="90" fill="#f5b942" opacity="0.06" />
            <rect x="30" y="120" width="90" height="90" fill="#8b93a7" opacity="0.06" />
            <rect x="120" y="120" width="90" height="90" fill="#4fbf8b" opacity="0.06" />
            <line x1="30" y1="120" x2="210" y2="120" stroke="#2a3352" stroke-width="1" />
            <line x1="120" y1="30" X2="120" y2="210" stroke="#2a3352" stroke-width="1" />
            <text x="115" y="222" fill="#97a1c2" font-size="10">愉悦度 V →</text>
            <text x="6" y="36" fill="#97a1c2" font-size="10">唤醒度 A ↑</text>
            <polyline :points="pathPoints" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.8" />
            <circle :cx="tgt.x" :cy="tgt.y" r="6" fill="#34d399" />
            <text :x="tgt.x + 9" :y="tgt.y + 4" fill="#34d399" font-size="10">目标</text>
            <circle :cx="cur.x" :cy="cur.y" r="6" fill="#ffffff" />
            <text :x="cur.x + 9" :y="cur.y + 4" fill="#ffffff" font-size="10">当前</text>
            <g v-for="(s, i) in rec.songs" :key="s.id + i">
              <circle :cx="wp(s).x" :cy="wp(s).y" r="8" fill="#22d3ee" opacity="0.9" />
              <text :x="wp(s).x" :y="wp(s).y + 3.5" fill="#06222b" font-size="9" font-weight="bold" text-anchor="middle">{{ i + 1 }}</text>
            </g>
          </svg>
        </div>

        <div class="song-list">
          <div v-for="(s, i) in rec.songs" :key="s.id + i" class="song-card" :class="{ playing: i === index }">
            <div class="song-cover" :style="coverStyle(s)">
              <img v-if="s.source === 'online' && s.cover" :src="s.cover" alt="" />
              <span v-else>🎵</span>
            </div>
            <div class="song-info">
              <div class="song-title">{{ s.title }}</div>
              <div class="song-artist">{{ s.artist }}</div>
              <div class="song-tags">
                <span class="stage-chip" :class="s.stage">{{ s.stage }}</span>
                <span class="match-chip">匹配 {{ s.matchScore }}%</span>
                <span class="src-chip" :class="s.source">{{ s.source === 'online' ? '在线' : '本地' }}</span>
              </div>
            </div>
            <button class="play-btn" @click="$emit('play', i)">▶</button>
          </div>
          <button class="refresh-btn" @click="$emit('refresh')">🔄 换一批推荐</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { EMOTION_VA } from '../core/recommend'

const props = defineProps({
  rec: { type: Object, default: null },
  library: { type: String, default: 'local' },
  localCount: { type: Number, default: 0 },
  onlineLoading: { type: Boolean, default: false },
  onlineError: { type: String, default: '' },
  index: { type: Number, default: 0 }
})
defineEmits(['play', 'refresh', 'switch'])

const PAD = 30
const IN = 180
function pos(v, a) { return { x: PAD + v * IN, y: 210 - a * IN } }
const cur = computed(() => pos(props.rec?.current?.v ?? 0.5, props.rec?.current?.a ?? 0.45))
const tgt = computed(() => pos(props.rec?.target?.v ?? 0.7, props.rec?.target?.a ?? 0.55))
function wp(s) { return pos(s.waypoint?.v ?? s.v ?? 0.5, s.waypoint?.a ?? s.a ?? 0.5) }
const pathPoints = computed(() =>
  [cur.value, ...props.rec.songs.map(wp), tgt.value].map(p => `${p.x},${p.y}`).join(' ')
)

function coverStyle(s) {
  if (s.source === 'online' && s.cover) return {}
  const hue = Math.round((s.v ?? 0.5) * 160 + 190)
  return { background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${hue + 40}, 70%, 30%))` }
}
</script>

<style scoped>
.recommend-panel { min-height: 420px; }
.lib-switch { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.lib-label { font-size: 13px; color: var(--muted); }
.lib-switch button.active { border-color: var(--accent); background: rgba(139, 92, 246, .18); }
.online-state { font-size: 12px; color: var(--accent2); }
.online-error { font-size: 12px; color: var(--red); }
.empty { text-align: center; padding: 60px 0; color: var(--muted); }
.empty-icon { font-size: 42px; margin-bottom: 10px; }
.strategy-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 14px; }
.strategy-chip {
  background: linear-gradient(135deg, var(--accent), #6d28d9);
  padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; white-space: nowrap;
}
.strategy-text { font-size: 13px; color: var(--muted); line-height: 1.6; }
.rec-body { display: grid; grid-template-columns: 250px 1fr; gap: 16px; align-items: start; }
@media (max-width: 760px) { .rec-body { grid-template-columns: 1fr; } }
.va-plane svg { width: 100%; background: rgba(8, 11, 20, .6); border: 1px solid var(--line); border-radius: 12px; }
.song-list { display: flex; flex-direction: column; gap: 10px; }
.song-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--card2); border: 1px solid var(--line); border-radius: 12px; padding: 10px;
  transition: border-color .2s;
}
.song-card:hover, .song-card.playing { border-color: var(--accent2); }
.song-cover {
  width: 52px; height: 52px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 22px; overflow: hidden;
}
.song-cover img { width: 100%; height: 100%; object-fit: cover; }
.song-info { flex: 1; min-width: 0; }
.song-title { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.song-artist { font-size: 12px; color: var(--muted); margin-top: 2px; }
.song-tags { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.stage-chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(139, 92, 246, .2); color: #c4b5fd; }
.stage-chip.目标曲 { background: rgba(52, 211, 153, .18); color: #6ee7b7; }
.match-chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(34, 211, 238, .15); color: #67e8f9; }
.src-chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(255, 255, 255, .07); color: var(--muted); }
.src-chip.online { background: rgba(245, 185, 66, .15); color: var(--gold); }
.play-btn {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--accent), #6d28d9); border: none; font-size: 15px;
}
.refresh-btn { margin-top: 4px; width: 100%; }
</style>
