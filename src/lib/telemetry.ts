import { trace, context, SpanStatusCode, metrics } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

const SERVICE = 'journal-app'

export function getTracer() {
  return trace.getTracer(SERVICE)
}

export function getMeter() {
  return metrics.getMeter(SERVICE)
}

export function getLogger() {
  return logs.getLogger(SERVICE)
}

export function getTraceContext() {
  const span = trace.getSpan(context.active())
  if (!span) return {}
  const ctx = span.spanContext()
  return { trace_id: ctx.traceId, span_id: ctx.spanId }
}

export const logger = {
  info(message: string, attributes: Record<string, unknown> = {}) {
    getLogger().emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: message,
      attributes: { ...getTraceContext(), ...attributes },
    })
  },
  error(message: string, attributes: Record<string, unknown> = {}) {
    getLogger().emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: message,
      attributes: { ...getTraceContext(), ...attributes },
    })
  },
}

/**
 * Wraps a server action in a span. Only pass opaque IDs / counts / booleans as
 * attributes — never journal content, titles, or photo bytes (personal data).
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
): Promise<T> {
  return getTracer().startActiveSpan(name, async (span) => {
    try {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value)
      })
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      // Next.js redirect() throws a NEXT_REDIRECT error as control flow —
      // it is not a real failure. Pass it through without marking the span
      // as errored or emitting an error log.
      if (isRedirectError(error)) {
        throw error
      }
      const err = error instanceof Error ? error : new Error(String(error))
      span.setStatus({ code: SpanStatusCode.ERROR, message: `${err.name}: ${err.message}` })
      logger.error(`${name}.failed`, {
        'exception.type': err.name,
        'exception.message': err.message,
        'exception.stacktrace': err.stack,
      })
      throw error
    } finally {
      span.end()
    }
  })
}
