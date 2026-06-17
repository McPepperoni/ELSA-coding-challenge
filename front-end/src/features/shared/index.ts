// AI Generated code <PURPOSE> calculate visual-only countdown values
type VisualSecondsRemainingOptions = Readonly<{
  endsAt: string
  now: () => number
}>

export const getVisualSecondsRemaining = (
  options: VisualSecondsRemainingOptions,
): number => {
  const remainingMilliseconds = new Date(options.endsAt).getTime() - options.now()
  return Math.max(0, Math.ceil(remainingMilliseconds / 1000))
}
