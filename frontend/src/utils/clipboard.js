// 复制文本：安全上下文用 Clipboard API；非 https 或旧浏览器回退到隐藏 textarea。

function legacyCopy(value) {
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied) throw new Error('execCommand copy failed')
}

/**
 * @param {string} text 要复制的文本
 * @returns {Promise<void>} 失败时抛出异常，由调用方决定提示文案
 */
export async function copyText(text) {
  const value = String(text ?? '')
  if (!value) throw new Error('没有可复制的内容')

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  legacyCopy(value)
}
