/* eslint-disable no-useless-catch */
/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import './App.css'

const resolveApiBase = () => {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000'
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://127.0.0.1:8000'
  }
  return window.location.origin
}

const API_BASE = resolveApiBase()
const LOGS_ENDPOINT = `${API_BASE}/logs`

const emptyImport = ''

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const formatNumber = (value, fallback = '—') => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback
  return new Intl.NumberFormat('en-US').format(value)
}

const getDeficit = (log) => {
  const explicit = log?.calculations?.calorie_deficit
  if (explicit !== null && explicit !== undefined) return explicit
  const tdee = log?.calculations?.estimated_tdee
  const calories = log?.totals?.calories
  if (tdee !== null && tdee !== undefined && calories !== null && calories !== undefined) {
    return tdee - calories
  }
  return null
}

const normalizeLog = (raw) => {
  const totals = raw.totals || {
    calories: raw.calorieIntakeKcal ?? raw.calorieIntake ?? null,
    protein: raw.proteinGrams ?? raw.proteinIntake ?? null,
    carbs: raw.carbs ?? null,
    fat: raw.fat ?? null,
  }

  const activity = raw.activity || {
    active_calories: raw.appleWatchActiveCaloriesKcal ?? raw.activeCalories ?? null,
    source: raw.activitySource ?? null,
  }

  const health = raw.health_metrics || {
    blood_pressure_systolic: raw.blood_pressure_systolic ?? null,
    blood_pressure_diastolic: raw.blood_pressure_diastolic ?? null,
  }

  const calculations = raw.calculations || {
    estimated_tdee: raw.estimated_tdee ?? null,
    calorie_deficit: raw.calorie_deficit ?? raw.deficit ?? null,
  }

  return {
    _id: raw._id,
    date: raw.date,
    day_type: raw.day_type ?? raw.dayType ?? '',
    body_weight_lbs: raw.body_weight_lbs ?? raw.bodyWeightLbs ?? null,
    totals,
    activity,
    health_metrics: health,
    calculations,
    notes: raw.notes ?? '',
  }
}

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
)

const HEIGHT_IN = 71
const AGE = 40
const SEX = 'male'

const calculateBmr = (weightLbs) => {
  if (!weightLbs) return 0
  const weightKg = weightLbs * 0.453592
  const heightCm = HEIGHT_IN * 2.54
  if (SEX === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * AGE + 5
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * AGE - 161
}

const imputeWeights = (logs) => {
  const cloned = logs.map((log) => ({ ...log }))
  for (let i = 0; i < cloned.length; i += 1) {
    if (cloned[i].body_weight_lbs) continue
    let prev = null
    let next = null
    for (let j = i - 1; j >= 0; j -= 1) {
      if (cloned[j].body_weight_lbs) {
        prev = cloned[j].body_weight_lbs
        break
      }
    }
    for (let j = i + 1; j < cloned.length; j += 1) {
      if (cloned[j].body_weight_lbs) {
        next = cloned[j].body_weight_lbs
        break
      }
    }
    if (prev !== null && next !== null) {
      cloned[i].body_weight_lbs = (prev + next) / 2
    } else if (prev !== null) {
      cloned[i].body_weight_lbs = prev
    } else if (next !== null) {
      cloned[i].body_weight_lbs = next
    }
  }
  return cloned
}

const parseDate = (dateString) => {
  if (!dateString) return null
  const parsed = new Date(`${dateString}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const withinDays = (log, days) => {
  if (!days) return true
  const date = parseDate(log.date)
  if (!date) return false
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return date >= start && date <= now
}

const computeAverages = (logs) => {
  if (!logs.length) {
    return {
      calories: null,
      protein: null,
      deficit: null,
      active: null,
    }
  }

  const sum = logs.reduce(
    (acc, log) => {
      acc.calories += log.totals?.calories ?? 0
      acc.protein += log.totals?.protein ?? 0
      acc.deficit += getDeficit(log) ?? 0
      acc.active += log.activity?.active_calories ?? 0
      return acc
    },
    { calories: 0, protein: 0, deficit: 0, active: 0 }
  )

  return {
    calories: Math.round(sum.calories / logs.length),
    protein: Math.round(sum.protein / logs.length),
    deficit: Math.round(sum.deficit / logs.length),
    active: Math.round(sum.active / logs.length),
  }
}

const buildChartData = (labels, values, average, accent) => ({
  labels,
  datasets: [
    {
      type: 'bar',
      label: 'Daily',
      data: values,
      backgroundColor: accent,
      borderRadius: 6,
      barThickness: 18,
    },
    {
      type: 'line',
      label: 'Average',
      data: values.map(() => average),
      borderColor: '#f7b046',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.2,
    },
  ],
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#cfd6dd',
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: '#9aa3ab',
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
      },
    },
    y: {
      ticks: {
        color: '#9aa3ab',
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.08)',
      },
    },
  },
}

function App() {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('')
  const [importJson, setImportJson] = useState(emptyImport)
  const [importFileName, setImportFileName] = useState('')
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [analyticsWindow, setAnalyticsWindow] = useState('30')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        setLoading(true)
        const [logsResponse] = await Promise.all([
          axios.get(LOGS_ENDPOINT),
        ])

        if (!mounted) return

        const normalized = (logsResponse.data || []).map(normalizeLog)
        setLogs(normalized)
        setStatus({ type: 'idle', message: '' })
      } catch (error) {
        if (!mounted) return
        setStatus({
          type: 'error',
          message: error?.response?.data?.detail || error.message || 'Failed to load logs.',
        })
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [refreshKey])

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      if (!a.date || !b.date) return 0
      return b.date.localeCompare(a.date)
    })
  }, [logs])

  const filteredLogs = useMemo(() => {
    if (!filter.trim()) return sortedLogs
    const term = filter.trim().toLowerCase()
    return sortedLogs.filter((log) => {
      return (
        (log.date || '').toLowerCase().includes(term) ||
        (log.day_type || '').toLowerCase().includes(term) ||
        (log.notes || '').toLowerCase().includes(term)
      )
    })
  }, [sortedLogs, filter])

  const latestLog = sortedLogs[0]
  const existingDates = useMemo(() => new Set(logs.map((log) => log.date)), [logs])

  const analyticsLogs = useMemo(() => {
    if (analyticsWindow === 'all') return sortedLogs
    const days = Number(analyticsWindow)
    return sortedLogs.filter((log) => withinDays(log, days))
  }, [sortedLogs, analyticsWindow])

  const analyticsAverages = useMemo(() => computeAverages(analyticsLogs), [analyticsLogs])

  const chartPayload = useMemo(() => {
    const ordered = [...analyticsLogs].sort((a, b) => {
      if (!a.date || !b.date) return 0
      return a.date.localeCompare(b.date)
    })
    const withWeights = imputeWeights(ordered)
    const labels = withWeights.map((log) => log.date)
    const calories = withWeights.map((log) => log.totals?.calories ?? 0)
    const active = withWeights.map((log) => log.activity?.active_calories ?? 0)
    const tdee = withWeights.map((log) => {
      const bmr = calculateBmr(log.body_weight_lbs ?? 0)
      const activeCalories = log.activity?.active_calories ?? 0
      return Math.round(bmr + activeCalories * 0.7)
    })
    const deficit = withWeights.map((log, index) => {
      const computed = tdee[index] - (log.totals?.calories ?? 0)
      return Math.round(computed)
    })

    return {
      labels,
      calories,
      active,
      tdee,
      deficit,
      bodyWeight: withWeights.map((log) => log.body_weight_lbs ?? 0),
    }
  }, [analyticsLogs])

  const normalizeIncoming = (entry) => {
    const normalized = normalizeLog(entry)
    return {
      ...normalized,
      totals: normalized.totals || {},
      activity: normalized.activity || {},
      health_metrics: normalized.health_metrics || {},
      calculations: normalized.calculations || {},
    }
  }

  const buildPayload = (normalized) => {
    const calories = toNumberOrNull(normalized.totals.calories)
    const protein = toNumberOrNull(normalized.totals.protein)
    const carbs = toNumberOrNull(normalized.totals.carbs)
    const fat = toNumberOrNull(normalized.totals.fat)
    const activeCalories = toNumberOrNull(normalized.activity.active_calories)
    const bodyWeight = toNumberOrNull(normalized.body_weight_lbs)
    const estimatedTdee = toNumberOrNull(normalized.calculations.estimated_tdee)
    const computedDeficit =
      estimatedTdee !== null && calories !== null ? estimatedTdee - calories : null
    const deficit =
      toNumberOrNull(normalized.calculations.calorie_deficit) ?? computedDeficit

    return {
      date: normalized.date,
      day_type: normalized.day_type || null,
      body_weight_lbs: bodyWeight,
      totals: {
        calories,
        protein,
        carbs,
        fat,
      },
      activity: {
        active_calories: activeCalories,
        source: normalized.activity.source || null,
      },
      health_metrics: {
        blood_pressure_systolic: toNumberOrNull(
          normalized.health_metrics.blood_pressure_systolic,
        ),
        blood_pressure_diastolic: toNumberOrNull(
          normalized.health_metrics.blood_pressure_diastolic,
        ),
      },
      calculations: {
        estimated_tdee: estimatedTdee,
        calorie_deficit: deficit,
      },
      notes: normalized.notes || '',
      bodyWeightLbs: bodyWeight,
      calorieIntakeKcal: calories,
      appleWatchActiveCaloriesKcal: activeCalories,
      proteinGrams: protein,
    }
  }

const parseImportPayload = (text) => {
  const trimmed = text.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) {
      throw new Error('Invalid JSON. Please paste a JSON object or array.')
    }
    try {
      return lines.map((line, index) => {
        try {
          return JSON.parse(line)
        } catch (lineError) {
          throw new Error(`Invalid JSON on line ${index + 1}.`)
        }
      })
    } catch (lineError) {
      throw lineError
    }
  }
}

  const validateEntries = (entries) => {
    const normalized = entries.map(normalizeIncoming)

    const errors = []

    normalized.forEach((entry, index) => {
      if (!entry.date || typeof entry.date !== 'string') {
        errors.push(`Entry ${index + 1}: date is required and must be a string.`)
      }

      const dateValue = entry.date
      if (dateValue && !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        errors.push(`Entry ${index + 1}: date must be in YYYY-MM-DD format.`)
      }

      const checkNumber = (value, path) => {
        if (value === null || value === undefined || value === '') return
        if (typeof value !== 'number') {
          errors.push(`Entry ${index + 1}: ${path} must be a number or null.`)
        }
      }

      checkNumber(entry.body_weight_lbs, 'body_weight_lbs')
      checkNumber(entry.totals?.calories, 'totals.calories')
      checkNumber(entry.totals?.protein, 'totals.protein')
      checkNumber(entry.totals?.carbs, 'totals.carbs')
      checkNumber(entry.totals?.fat, 'totals.fat')
      checkNumber(entry.activity?.active_calories, 'activity.active_calories')
      checkNumber(entry.health_metrics?.blood_pressure_systolic, 'health_metrics.blood_pressure_systolic')
      checkNumber(entry.health_metrics?.blood_pressure_diastolic, 'health_metrics.blood_pressure_diastolic')
      checkNumber(entry.calculations?.estimated_tdee, 'calculations.estimated_tdee')
      checkNumber(entry.calculations?.calorie_deficit, 'calculations.calorie_deficit')
    })

    if (errors.length) {
      throw new Error(`Validation failed:\n${errors.join('\n')}`)
    }

    const missingDate = normalized.find((entry) => !entry.date)
    if (missingDate) {
      throw new Error('Every entry must include a date.')
    }
    const duplicates = normalized.filter((entry) => existingDates.has(entry.date))
    if (duplicates.length) {
      const dates = duplicates.map((entry) => entry.date).join(', ')
      throw new Error(`These dates already exist: ${dates}`)
    }
    return normalized
  }

  const handleImportSubmit = async () => {
    try {
      const entries = parseImportPayload(importJson)
      if (!entries.length) {
        setStatus({ type: 'error', message: 'Paste JSON or upload a file first.' })
        return
      }
      const normalized = validateEntries(entries)
      const payloads = normalized.map(buildPayload)
      setStatus({ type: 'loading', message: `Saving ${payloads.length} log(s)…` })
      await Promise.all(payloads.map((payload) => axios.post(LOGS_ENDPOINT, payload)))
      setImportJson(emptyImport)
      setImportFileName('')
      setRefreshKey((prev) => prev + 1)
      setStatus({ type: 'success', message: 'Logs saved.' })
    } catch (error) {
      const message = error.message || 'Failed to save logs.'
      setStatus({ type: 'error', message })
      window.alert(message)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setImportJson(text)
      setImportFileName(file.name)
      setStatus({ type: 'idle', message: '' })
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to read file.' })
    }
  }

  const handleDelete = async (logId) => {
    if (!logId) return
    const confirmed = window.confirm('Delete this log? This cannot be undone.')
    if (!confirmed) return

    try {
      setStatus({ type: 'loading', message: 'Deleting log…' })
      await axios.delete(`${LOGS_ENDPOINT}/${logId}`)
      setLogs((prev) => prev.filter((log) => log._id !== logId))
      setStatus({ type: 'success', message: 'Log deleted.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.response?.data?.detail || error.message || 'Failed to delete log.',
      })
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Calorie Tracker</p>
          <h1>Daily Fuel & Recovery</h1>
          <p className="subhead">
            Capture training days, nutrition totals, and recovery metrics in one place.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#new-log">Add today&apos;s log</a>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setRefreshKey((prev) => prev + 1)}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="hero-cards">
          <div className="glass-card">
            <p className="card-label">Latest log</p>
            {latestLog ? (
              <div className="latest">
                <p className="card-value">{latestLog.date || '—'}</p>
                <p className="card-meta">
                  {latestLog.day_type || 'Training day'} · {formatNumber(latestLog.totals?.calories)} kcal
                </p>
                <p className="card-meta">
                  Active {formatNumber(latestLog.activity?.active_calories)} kcal · Deficit {formatNumber(getDeficit(latestLog))}
                </p>
              </div>
            ) : (
              <p className="card-meta">No logs yet.</p>
            )}
          </div>
        </div>
      </header>

      <section className="content">
        <div className="panel" id="new-log">
          <div className="panel-header">
            <div>
              <h2>New log import</h2>
              <p>Paste a JSON object, JSON array, or upload a .txt/.json file to add logs.</p>
            </div>
            <div className={`status ${status.type}`}>
              {status.message || (loading ? 'Loading data…' : 'Ready')}
            </div>
          </div>

          <div className="import-block">
            <div className="import-actions">
              <label className="file-pill">
                <input type="file" accept=".txt,.json" onChange={handleFileUpload} />
                {importFileName ? `File: ${importFileName}` : 'Upload file'}
              </label>
              <button className="btn primary" type="button" onClick={handleImportSubmit}>
                Save log(s)
              </button>
            </div>
            <textarea
              rows="6"
              placeholder="Paste JSON here..."
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
            />
          </div>

          <div className="hint">
            Manual input is disabled. Use bulk import to add logs.
          </div>
        </div>

        <div className="panel" id="analytics">
          <div className="panel-header">
            <div>
              <h2>Analytics</h2>
              <p>Averages for the selected time period.</p>
            </div>
            <label className="search">
              <span>Period</span>
              <select
                value={analyticsWindow}
                onChange={(event) => setAnalyticsWindow(event.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </label>
          </div>
          <div className="analytics-grid">
            <div>
              <p className="label">Avg calories</p>
              <p className="value">{formatNumber(analyticsAverages.calories)}</p>
            </div>
            <div>
              <p className="label">Avg protein</p>
              <p className="value">{formatNumber(analyticsAverages.protein)}</p>
            </div>
            <div>
              <p className="label">Avg deficit</p>
              <p className="value">{formatNumber(analyticsAverages.deficit)}</p>
            </div>
            <div>
              <p className="label">Avg active</p>
              <p className="value">{formatNumber(analyticsAverages.active)}</p>
            </div>
          </div>
          <div className="chart-grid">
            <div className="chart-card">
              <h3>Calories consumed vs date</h3>
              <div className="chart-area">
                {chartPayload.labels.length === 0 ? (
                  <div className="chart-empty">No data for selected period.</div>
                ) : (
                  <Bar
                    data={buildChartData(
                      chartPayload.labels,
                      chartPayload.calories,
                      analyticsAverages.calories ?? 0,
                      'rgba(255, 122, 61, 0.6)',
                    )}
                    options={chartOptions}
                  />
                )}
              </div>
            </div>
            <div className="chart-card">
              <h3>Apple Watch active calories vs date</h3>
              <div className="chart-area">
                {chartPayload.labels.length === 0 ? (
                  <div className="chart-empty">No data for selected period.</div>
                ) : (
                  <Bar
                    data={buildChartData(
                      chartPayload.labels,
                      chartPayload.active,
                      analyticsAverages.active ?? 0,
                      'rgba(36, 130, 161, 0.6)',
                    )}
                    options={chartOptions}
                  />
                )}
              </div>
            </div>
            <div className="chart-card">
              <h3>TDEE vs date (40M · 5&apos;11&quot;)</h3>
              <div className="chart-area">
                {chartPayload.labels.length === 0 ? (
                  <div className="chart-empty">No data for selected period.</div>
                ) : (
                  <Bar
                    data={buildChartData(
                      chartPayload.labels,
                      chartPayload.tdee,
                      Math.round(
                        chartPayload.tdee.reduce((sum, value) => sum + value, 0) /
                          (chartPayload.tdee.length || 1),
                      ),
                      'rgba(247, 176, 70, 0.55)',
                    )}
                    options={chartOptions}
                  />
                )}
              </div>
            </div>
            <div className="chart-card">
              <h3>Deficit vs date</h3>
              <div className="chart-area">
                {chartPayload.labels.length === 0 ? (
                  <div className="chart-empty">No data for selected period.</div>
                ) : (
                  <Bar
                    data={buildChartData(
                      chartPayload.labels,
                      chartPayload.deficit,
                      analyticsAverages.deficit ?? 0,
                      'rgba(144, 96, 220, 0.55)',
                    )}
                    options={chartOptions}
                  />
                )}
              </div>
            </div>
            <div className="chart-card">
              <h3>Body weight vs date</h3>
              <div className="chart-area">
                {chartPayload.labels.length === 0 ? (
                  <div className="chart-empty">No data for selected period.</div>
                ) : (
                  <Line
                    data={{
                      labels: chartPayload.labels,
                      datasets: [
                        {
                          label: 'Body weight (lbs)',
                          data: chartPayload.bodyWeight,
                          borderColor: '#7cc88c',
                          backgroundColor: 'rgba(124, 200, 140, 0.2)',
                          borderWidth: 2,
                          pointRadius: 3,
                          tension: 0.25,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                )}
              </div>
            </div>
          </div>
          {analyticsLogs.length === 0 ? (
            <div className="empty">No logs in this period.</div>
          ) : (
            <p className="hint">Based on {analyticsLogs.length} log(s).</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Log history</h2>
              <p>{filteredLogs.length} entries</p>
            </div>
            <label className="search">
              <span>Filter</span>
              <input
                type="text"
                placeholder="Search date, day type, notes"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </label>
          </div>

          {loading ? (
            <div className="empty">Loading logs…</div>
          ) : filteredLogs.length === 0 ? (
            <div className="empty">No logs match your search.</div>
          ) : (
            <div className="log-list">
              {filteredLogs.map((log) => (
                <article className="log-card" key={log._id || log.date}>
                  <div className="log-top">
                    <div>
                      <h3>{log.date}</h3>
                      <p className="log-meta">{log.day_type || 'Training day'}</p>
                    </div>
                    <div className="log-actions">
                      <span className="pill">{formatNumber(log.totals?.calories)} kcal</span>
                      <button
                        className="btn ghost small"
                        type="button"
                        onClick={() => handleDelete(log._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="log-grid">
                    <div>
                      <p className="label">Protein</p>
                      <p className="value">{formatNumber(log.totals?.protein)} g</p>
                    </div>
                    <div>
                      <p className="label">Carbs</p>
                      <p className="value">{formatNumber(log.totals?.carbs)} g</p>
                    </div>
                    <div>
                      <p className="label">Fat</p>
                      <p className="value">{formatNumber(log.totals?.fat)} g</p>
                    </div>
                    <div>
                      <p className="label">Active</p>
                      <p className="value">{formatNumber(log.activity?.active_calories)} kcal</p>
                    </div>
                    <div>
                      <p className="label">Body weight</p>
                      <p className="value">{formatNumber(log.body_weight_lbs)} lbs</p>
                    </div>
                    <div>
                      <p className="label">Deficit</p>
                      <p className="value">{formatNumber(getDeficit(log))} kcal</p>
                    </div>
                  </div>
                  <div className="log-foot">
                    <p className="log-meta">
                      Blood pressure: {formatNumber(log.health_metrics?.blood_pressure_systolic, '—')}/
                      {formatNumber(log.health_metrics?.blood_pressure_diastolic, '—')} · Source: {log.activity?.source || '—'}
                    </p>
                    {log.notes ? <p className="notes-preview">{log.notes}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default App
