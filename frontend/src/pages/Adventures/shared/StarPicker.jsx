const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing']

export default function StarPicker({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-1">
      {label && <span className="text-xs text-gray-600 w-20 shrink-0">{label}</span>}
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className={`text-xl leading-none transition-transform hover:scale-110 ${
              n <= value ? 'text-yellow-400' : 'text-gray-200'
            }`}
            title={LABELS[n]}
          >★</button>
        ))}
      </div>
      {value > 0 && <span className="text-xs text-gray-400 ml-1">{LABELS[value]}</span>}
    </div>
  )
}
