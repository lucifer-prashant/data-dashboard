import axios from 'axios'

export async function getAuthoredCommits(accessToken: string, startDate: Date, endDate: Date) {
  const query = `
    query($from: DateTime!, $to: DateTime!) {
      viewer {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `

  const res = await axios.post(
    'https://api.github.com/graphql',
    {
      query,
      variables: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (res.data.errors) {
    throw new Error(res.data.errors[0]?.message || 'GraphQL error')
  }

  const weeks = res.data.data.viewer.contributionsCollection.contributionCalendar.weeks as {
    contributionDays: { date: string; contributionCount: number }[]
  }[]

  return weeks
    .flatMap(w => w.contributionDays)
    .filter(d => {
      const date = new Date(d.date + 'T12:00:00')
      return date >= startDate && date <= endDate
    })
    .map(d => ({ date: d.date, commits: d.contributionCount }))
}
