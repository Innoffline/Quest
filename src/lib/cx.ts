/** Join conditional class names. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
