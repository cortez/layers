import { useEffect, useState } from 'react'

/**
 * `value`, once it has stopped changing for `ms`. A fast sweep across the
 * dial settles once at the end instead of churning everything it passes.
 */
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}
