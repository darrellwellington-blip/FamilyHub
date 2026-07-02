import { useAuth } from '../AuthContext'

export default function Login() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Family Hub</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to access your family's hub</p>
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300
                     rounded-xl bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700
                     shadow-sm"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
    </svg>
  )
}
