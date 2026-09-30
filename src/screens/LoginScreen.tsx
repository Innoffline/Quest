import { useState } from 'react'
import { Button, Field, inputCls } from '../components/ui'
import { supabase } from '../data/supabaseClient'

/** Email magic-link sign-in. No passwords, no account management. */
export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  // iOS Home Screen apps don't share storage with Safari, so a magic link opened
  // from Mail signs in Safari, not the installed app. The emailed code works anywhere.
  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    if (error) setError(error.message)
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setState('error')
    } else setState('sent')
  }

  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-6 safe-top safe-bottom">
      <div className="relative mx-auto w-full max-w-sm">
        <div className="relative py-8">
          <div aria-hidden className="absolute -inset-x-24 inset-y-0 -skew-y-6 bg-accent" />
          <div aria-hidden className="absolute -inset-x-24 inset-y-0 -skew-y-6 stripes" />
          <h1 className="relative font-display text-7xl text-accent-ink">Quest</h1>
          <p className="relative mt-2 font-semibold text-accent-ink">Clear the next quest.</p>
        </div>

        <div className="mt-20">
          {state === 'sent' ? (
            <div className="cut bg-surface p-5">
              <p className="font-display text-2xl">Check your email</p>
              <p className="mt-2 text-sm text-muted">
                A sign-in link was sent to <span className="text-ink">{email}</span>. Open it on this device — or, in the
                installed iPhone app, enter the code from the email.
              </p>
              <form onSubmit={verify} className="mt-4 flex gap-2">
                <input
                  className={inputCls + ' tracking-widest'}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Code"
                  aria-label="Code from email"
                  value={code}
                  maxLength={10}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <Button type="submit" variant="secondary" disabled={code.length < 6}>
                  Verify
                </Button>
              </form>
              {error && (
                <p role="alert" className="mt-2 text-sm text-info">
                  {error}
                </p>
              )}
              <button className="mt-4 min-h-11 text-sm text-muted underline" onClick={() => setState('idle')}>
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="space-y-4">
              <Field label="Email">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" size="lg" slanted className="w-full" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send magic link'}
              </Button>
              {state === 'error' && (
                <p role="alert" className="text-sm text-info">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
