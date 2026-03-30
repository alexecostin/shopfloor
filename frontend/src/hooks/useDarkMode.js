import { useState, useEffect } from 'react'

export default function useDarkMode() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    function checkTime() {
      const hour = new Date().getHours()
      const shouldBeDark = hour >= 22 || hour < 6
      setIsDark(shouldBeDark)
      if (shouldBeDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    checkTime()
    const interval = setInterval(checkTime, 60 * 1000) // check every minute
    return () => clearInterval(interval)
  }, [])

  return isDark
}
