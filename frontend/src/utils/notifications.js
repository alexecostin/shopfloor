export function sendNotification(title, body, priority = 'normal') {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') {
    Notification.requestPermission()
    return
  }

  const options = { body, tag: `sf-${Date.now()}` }

  if (priority === 'critical' || priority === 'urgent') {
    options.requireInteraction = true
    // Vibrate pattern: urgent
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
  } else {
    if (navigator.vibrate) navigator.vibrate(100)
  }

  new Notification(title, options)
}
