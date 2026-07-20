export async function startOtel() {
  const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  const DASH0_AUTH_TOKEN = process.env.DASH0_AUTH_TOKEN

  if (!OTEL_ENDPOINT) {
    console.log('[OTel] OTEL_EXPORTER_OTLP_ENDPOINT not set — telemetry disabled')
    return
  }

  const { diag, DiagConsoleLogger, DiagLogLevel } = await import('@opentelemetry/api')
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
  const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http')
  const { OTLPLogExporter } = await import('@opentelemetry/exporter-logs-otlp-http')
  const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics')
  const { BatchLogRecordProcessor, LoggerProvider } = await import('@opentelemetry/sdk-logs')
  const { logs } = await import('@opentelemetry/api-logs')
  const { resourceFromAttributes } = await import('@opentelemetry/resources')
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions')

  console.log('[OTel] Endpoint:', OTEL_ENDPOINT)
  console.log('[OTel] Auth:', DASH0_AUTH_TOKEN ? 'configured' : 'missing')

  const exporterHeaders: Record<string, string> = {}
  if (DASH0_AUTH_TOKEN) {
    exporterHeaders['Authorization'] = `Bearer ${DASH0_AUTH_TOKEN}`
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'journal-app',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
    'deployment.environment.name': process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    'service.criticality': 'medium',
  })

  const logExporter = new OTLPLogExporter({
    url: `${OTEL_ENDPOINT}/v1/logs`,
    headers: exporterHeaders,
  })

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor({ exporter: logExporter })],
  })
  logs.setGlobalLoggerProvider(loggerProvider)

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
      headers: exporterHeaders,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${OTEL_ENDPOINT}/v1/metrics`,
        headers: exporterHeaders,
      }),
      exportIntervalMillis: 10000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  })

  sdk.start()

  const shutdown = async () => {
    await loggerProvider.forceFlush()
    await Promise.allSettled([sdk.shutdown(), loggerProvider.shutdown()])
  }

  process.on('SIGTERM', () => shutdown().finally(() => process.exit(0)))
  process.on('SIGINT', () => shutdown().finally(() => process.exit(0)))
}
