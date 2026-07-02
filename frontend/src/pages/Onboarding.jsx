import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { usersApi } from '../api'

export default function Onboarding({ onComplete }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await usersApi.create({
        name: name.trim(),
        email: user.email,
        family_hub_id: 1,
      })
      await onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
          <p className="text-sm text-gray-500 mt-1">
            You're signed in but don't have a profile yet. Enter your name to join the family hub.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label">Your name</label>
            <input
              className="input"
              placeholder="e.g. Darrell"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary justify-center" disabled={!name.trim() || saving}>
            {saving ? 'Joining…' : 'Join Family Hub'}
          </button>
        </form>
      </div>
    </div>
  )
}
