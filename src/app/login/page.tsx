'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import '@/styles/Login.css';
import Link from 'next/link';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const handleLogin = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();

    const fakeEmail = `${username}@example.com`;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
      const userId = userCredential.user.uid;
      const userSnapshot = await get(ref(db, `users/${userCredential.user.uid}`));

      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        const updatedLoginCount = (userData.loginCount || 0) + 1;
        await set(ref(db, `users/${userId}/loginCount`), updatedLoginCount);

        let role = userSnapshot.val().role;
        const roleMapping: { [key: string]: string } = {
          'niagara-ltc': 'niagara',
          'generations': 'generations',
          'shepherd': 'shepherd',
        };
        
        role = roleMapping[role] || role;
        router.push('/' + role);
      }
    } catch (error) {
      console.error('Error during login:', error);
      setErrorMessage('Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="login-container">
      <img src="/assets/fallyxlogo.jpeg" alt="Logo" className="logoLogin" />
      <h2 className="login-title">Behaviours Dashboard Login</h2>

      <div className="login-input-group">
        <label htmlFor="login-email">Username</label>
        <input
          id="login-email"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              document.getElementById('login-password')?.focus();
            }
          }}
        />
      </div>

      <div className="login-input-group">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleLogin();
            }
          }}
        />
      </div>

      {errorMessage && <p className="login-error-message">{errorMessage}</p>}

      <button className="login-button" onClick={() => handleLogin()}>
        Login
      </button>

      <div className="resetPasswordLink">
        <Link href="/reset-password">Forgot Password? Reset here</Link>
      </div>
    </div>
  );
}

