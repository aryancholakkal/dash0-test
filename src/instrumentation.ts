export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  // .env.local isn't loaded until register() runs, and Node-only OTel code
  // must stay out of the edge bundle — both are why this is a dynamic import.
  const { startOtel } = await import('@/lib/otel-node')
  await startOtel()
}
