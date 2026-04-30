import axios from 'axios'

interface GmailDailyData {
  date: string
  count: number
}

export async function getGmailCounts(accessToken: string, startDate: Date, endDate: Date): Promise<{ daily: GmailDailyData[]; hourly: { hour: number; count: number }[] }> {
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Build search query dates in Gmail format: YYYY/MM/DD
  const toGmailDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '/')
  const startStr = toGmailDate(startDate)
  const endStr = toGmailDate(endDate)
  const query = `label:INBOX after:${startStr} before:${endStr}`

  // Fetch message IDs
  const messageIds: string[] = []
  let pageToken: string | null = null

  while (true) {
    try {
      const res: any = await axios.get('https://www.googleapis.com/gmail/v1/users/me/messages', {
        headers,
        params: {
          q: query,
          maxResults: 500,
          pageToken
        }
      })

      if (res.data.messages) {
        res.data.messages.forEach((msg: any) => messageIds.push(msg.id))
      }

      pageToken = res.data.nextPageToken
      if (!pageToken || messageIds.length >= 2000) break
    } catch (e) {
      console.error('Gmail list error:', e)
      throw e
    }
  }

  // Batch fetch message details to get internalDate (ms since epoch)
  const messages: { internalDate: string }[] = []
  const batchSize = 100

  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batchIds = messageIds.slice(i, i + batchSize)
    try {
      // Use Promise.all with limited concurrency? We'll just do sequential batches to be safe
      const batchPromises = batchIds.map(id =>
        axios.get(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}`, {
          headers,
          params: { format: 'metadata' } // reduces payload, still includes internalDate
        }).then(res => ({ internalDate: res.data.internalDate }))
      )
      const batchResults = await Promise.all(batchPromises)
      messages.push(...batchResults)
    } catch (e) {
      console.error('Gmail batch fetch error:', e)
      // continue with whatever we got
    }
  }

  // Group by day and hour
  const daily: Record<string, number> = {}
  const hourly: Record<number, number> = {}

  messages.forEach(msg => {
    if (!msg.internalDate) return
    const date = new Date(parseInt(msg.internalDate))
    const dayKey = date.toISOString().split('T')[0]
    daily[dayKey] = (daily[dayKey] || 0) + 1
    const hour = date.getHours()
    hourly[hour] = (hourly[hour] || 0) + 1
  })

  // Build full daily array
  const allDaily: GmailDailyData[] = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0]
    allDaily.push({ date: key, count: daily[key] || 0 })
  }

  // Build hourly array (0-23)
  const allHourly = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourly[i] || 0
  }))

  return { daily: allDaily, hourly: allHourly }
}
