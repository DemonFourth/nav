<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="dialog-overlay" @click="handleCancel">
        <div class="dialog-box" @click.stop>
          <h3 class="dialog-title">{{ title }}</h3>
          <p class="dialog-message">{{ message }}</p>
          <div class="dialog-buttons">
            <button
              v-for="(btn, idx) in buttons"
              :key="idx"
              :class="btn.class || (idx === buttons.length - 1 ? 'btn btn-primary' : 'btn btn-secondary')"
              @click="handleButtonClick(btn.value)"
            >{{ btn.text }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const show = ref(false)
const title = ref('')
const message = ref('')
const buttons = ref([{ text: '取消', value: false }, { text: '确定', value: true }])
let resolvePromise = null

const open = (msg, ttl = '确认操作') => {
  title.value = ttl
  message.value = msg
  buttons.value = [{ text: '取消', value: false }, { text: '确定', value: true }]
  show.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const openWithChoices = (msg, ttl = '确认操作', choices = []) => {
  title.value = ttl
  message.value = msg
  buttons.value = choices.map(c => ({
    text: c.text || c,
    value: c.value !== undefined ? c.value : c,
    class: c.class || (c.primary ? 'btn btn-primary' : 'btn btn-secondary')
  }))
  show.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const handleButtonClick = (value) => {
  show.value = false
  if (resolvePromise) resolvePromise(value)
}

const handleCancel = () => {
  show.value = false
  if (resolvePromise) resolvePromise(false)
}

defineExpose({
  open,
  openWithChoices
})
</script>