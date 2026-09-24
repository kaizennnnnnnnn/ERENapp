'use client'

// A Meadow text field for a password, with a Show / Hide toggle inside its
// right edge (sign up, log in, reset). A word, not an eye icon: it needs no
// new pixel art and reads the same to everyone.

import { forwardRef, useState } from 'react'
import { M, TextField, type TextFieldProps } from '@/components/meadow'

export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, 'type' | 'trailing'>>(
  function PasswordField({ inputStyle, ...props }, ref) {
    const [show, setShow] = useState(false)
    return (
      <TextField
        ref={ref}
        {...props}
        type={show ? 'text' : 'password'}
        inputStyle={{ paddingRight: 84, ...inputStyle }}
        trailing={(
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            aria-pressed={show}
            className="m-focus"
            style={{
              height: 44, marginRight: -8, padding: '0 8px', border: 0, background: 'transparent',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: M.leaf, cursor: 'pointer',
            }}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      />
    )
  },
)
