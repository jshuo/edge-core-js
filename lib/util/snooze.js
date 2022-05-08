// 

export function snooze(ms) {
  return new Promise(resolve => setTimeout(() => resolve(ms), ms))
}
