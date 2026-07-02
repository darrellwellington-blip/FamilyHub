export default function ParticipantsSection({ users, friends, userIds, friendIds, onToggleUser, onToggleFriend }) {
  return (
    <>
      <div>
        <label className="label">Family members</label>
        <div className="flex flex-wrap gap-2">
          {users.map(u => {
            const on = userIds.includes(u.id)
            return (
              <button key={u.id} type="button" onClick={() => onToggleUser(u.id)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  on ? 'bg-indigo-600 text-white border-indigo-600'
                     : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                }`}>{u.name}</button>
            )
          })}
        </div>
      </div>
      {friends.length > 0 && (
        <div>
          <label className="label">Friends</label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {friends.map(f => {
              const on = friendIds.includes(f.id)
              const name = [f.first_name, f.last_name].filter(Boolean).join(' ')
              return (
                <button key={f.id} type="button" onClick={() => onToggleFriend(f.id)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    on ? 'bg-emerald-600 text-white border-emerald-600'
                       : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                  }`}>{name}</button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
