import axios from 'axios'

export async function getGoogleFitSteps(accessToken: string, startDate: Date, endDate: Date) {
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Split into 7-day chunks to stay under Google Fit limit
  const chunkDays = 7
  const chunks: { start: number; end: number }[] = []
  let currentEnd = endDate.getTime()
  const startTime = startDate.getTime()

  while (currentEnd > startTime) {
    const currentStart = Math.max(currentEnd - chunkDays * 24 * 60 * 60 * 1000, startTime)
    chunks.push({ start: currentStart, end: currentEnd })
    currentEnd = currentStart - 1
  }
  chunks.reverse()

  const stepsByDate: Record<string, number> = {}

  for (const chunk of chunks) {
    const body = {
      aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
      bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
      startTimeMillis: chunk.start,
      endTimeMillis: chunk.end
    }

    try {
      const res = await axios.post(
        'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
        body,
        { headers }
      )
      const buckets = res.data.bucket || []

      buckets.forEach((bucket: any) => {
        const bucketStart = new Date(parseInt(bucket.startTimeMillis))
        const dateKey = bucketStart.toLocaleDateString('en-CA')
        let totalSteps = 0

        if (bucket.dataset && Array.isArray(bucket.dataset)) {
          bucket.dataset.forEach((dataset: any) => {
            if (dataset.point && Array.isArray(dataset.point)) {
              dataset.point.forEach((point: any) => {
                if (point.value && Array.isArray(point.value)) {
                  point.value.forEach((val: any) => {
                    if (val.intVal !== undefined) totalSteps += val.intVal
                    else if (val.fpVal !== undefined) totalSteps += Math.round(val.fpVal)
                  })
                }
              })
            }
          })
        }

        stepsByDate[dateKey] = (stepsByDate[dateKey] || 0) + totalSteps
      })
    } catch (e: any) {
      console.error('Google Fit chunk error:', e.response?.data || e.message)
      throw e
    }
  }

  // Generate all dates in range
  const allDays: string[] = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDays.push(d.toLocaleDateString('en-CA'))
  }

  const chartData = allDays.map(date => ({
    date,
    steps: stepsByDate[date] || 0
  }))

  return chartData
}
