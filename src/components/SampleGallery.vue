<template>
  <div class="sample-gallery">
    <p class="gallery-tip">以下是 AI 生成的写实人脸照片（7 种情绪），点击任意一张即可体验完整识别 → 推荐流程：</p>
    <div class="grid">
      <button
        v-for="s in samples"
        :key="s.file"
        class="sample-card"
        :class="{ active: activeFile === s.file }"
        @click="$emit('pick', s)"
      >
        <img :src="s.url" :alt="s.label" loading="lazy" />
        <span class="sample-label" :style="{ background: s.color }">{{ s.emoji }} {{ s.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({ samples: { type: Array, default: () => [] }, activeFile: { type: String, default: '' } })
defineEmits(['pick'])
</script>

<style scoped>
.gallery-tip { color: var(--muted); font-size: 13px; margin-bottom: 12px; line-height: 1.6; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.sample-card {
  position: relative; padding: 0; overflow: hidden;
  border-radius: 12px; border: 2px solid var(--line);
  aspect-ratio: 2 / 3; background: var(--card2);
}
.sample-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.sample-card.active { border-color: var(--accent2); box-shadow: 0 0 0 2px rgba(34, 211, 238, .35); }
.sample-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sample-label {
  position: absolute; left: 6px; bottom: 6px;
  font-size: 12px; font-weight: 700; color: #0b0e17;
  padding: 2px 8px; border-radius: 999px;
}
@media (max-width: 560px) { .grid { grid-template-columns: repeat(3, 1fr); } }
</style>
