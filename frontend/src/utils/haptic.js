export function hapticFeedback(duration = 50) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(duration)
  }
}

export function hapticSuccess() { hapticFeedback(50) }
export function hapticError() { hapticFeedback([50, 30, 50]) }
