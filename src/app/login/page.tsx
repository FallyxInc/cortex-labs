'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import '@/styles/Login.css';
import { trackLogin, trackFormInteraction, trackFeatureUsage } from '@/lib/mixpanel';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Default to true for better UX
  const router = useRouter();
  const loginStartTime = useRef<number | null>(null);
  const formStartTime = useRef<number>(new Date().getTime());

  useEffect(() => {
    // Track form start
    trackFormInteraction({
      formName: 'login',
      action: 'started',
    });
  }, []);

  const handleLogin = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();

    if (!email || !password) {
      setErrorMessage('Please enter both email and password');
      trackFormInteraction({
        formName: 'login',
        action: 'validated',
        validationErrors: ['missing_fields'],
      });
      return;
    }

    let loginEmail = email
    // validate email
    if (!email.includes('@')){
      loginEmail = email+'@example.com'
    }
    // Additional email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(loginEmail)) {
      setErrorMessage('Please enter a valid email address');
      trackFormInteraction({
        formName: 'login',
        action: 'validated',
        validationErrors: ['invalid_email_format'],
      });
      return;
    } 

    loginStartTime.current = Date.now();

    try {
      // Set persistence based on "Remember Me" checkbox
      // LOCAL persistence: persists until explicitly signed out (even after browser close)
      // SESSION persistence: only persists for current browser session
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const userId = userCredential.user.uid;
      const userSnapshot = await get(ref(db, `users/${userCredential.user.uid}`));

      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        const updatedLoginCount = (userData.loginCount || 0) + 1;
        await set(ref(db, `users/${userId}/loginCount`), updatedLoginCount);

        const timeToLogin = loginStartTime.current ? Date.now() - loginStartTime.current : undefined;

        // Track successful login
        trackLogin({
          method: 'email',
          success: true,
          userId,
          role: userData.role,
          loginCount: updatedLoginCount,
          timeToLogin,
        });

        // Track form completion
        const timeToComplete = Date.now() - formStartTime.current;
        trackFormInteraction({
          formName: 'login',
          action: 'submitted',
          timeToComplete,
        });

        const role = userData.role;
        
        // Route based on role
        if (role === 'admin') {
          // Admin users go to admin dashboard
          router.push('/admin');
        } else if (role === 'homeUser') {
          // Home users go to their assigned home dashboard
          const homeId = userData.homeId;
          if (homeId) {
            router.push(`/${homeId}`);
          } else {
            // If homeUser doesn't have a homeId, show error
            setErrorMessage('Your account is not assigned to a home. Please contact an administrator.');
            trackLogin({
              method: 'email',
              success: false,
              error: 'no_home_assigned',
              userId,
              role: userData.role,
            });
          }
        } else {
          // Legacy role mappings for old home-based roles
          const roleMapping: { [key: string]: string } = {
            'niagara-ltc': 'niagara',
            'generations': 'generations',
            'shepherd': 'shepherd',
          };
          
          const mappedRole = roleMapping[role] || role;
          router.push('/' + mappedRole);
        }
      }
    } catch (error: unknown) {
      console.error('Error during login:', error);
      
      // Map Firebase error codes to user-friendly messages
      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (error && typeof error === 'object' && 'code' in error) {
        switch ((error as { code: string }).code) {
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            errorMessage = 'Incorrect email or password';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed attempts. Please try again later';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection.';
            break;
          default:
            // For other errors, use a generic message
            errorMessage = 'Login failed. Please check your credentials.';
        }
      } else if (error && typeof error === 'object' && 'message' in error) {
        // If there's a message but no code, check if it contains invalid-credential
        if ((error as { message: string }).message.includes('invalid-credential') || (error as { message: string }).message.includes('wrong-password')) {
          errorMessage = 'Incorrect email or password';
        }
      }
      
      setErrorMessage(errorMessage);
      
      // Track failed login
      trackLogin({
        method: 'email',
        success: false,
        error: error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : 'authentication_failed',
        timeToLogin: loginStartTime.current ? Date.now() - loginStartTime.current : undefined,
      });

      trackFormInteraction({
        formName: 'login',
        action: 'validated',
        validationErrors: [error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : 'authentication_failed'],
      });
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-container">
        <h2 className="login-title">Behaviours Dashboard Login</h2>

      <div className="login-input-group">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          // type="email"
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              document.getElementById('login-password')?.focus();
            }
          }}
        />
      </div>

      <div className="login-input-group">
        <label htmlFor="login-password">Password</label>
        <div style={{ position: 'relative' }}>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLogin();
              }
            }}
            style={{ paddingRight: '45px' }}
          />
          <button
            type="button"
            onClick={() => {
              setShowPassword(!showPassword);
              trackFeatureUsage({
                featureName: 'password_visibility_toggle',
                action: showPassword ? 'closed' : 'opened',
              });
            }}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              fontSize: '18px'
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {errorMessage && <p className="login-error-message">{errorMessage}</p>}

      <div className="login-remember-me">
        <label>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>Remember me</span>
        </label>
        <p>
          {rememberMe 
            ? 'You will stay logged in even after closing the browser' 
            : 'You will need to log in again when you close the browser'}
        </p>
      </div>

      <button className="login-button" onClick={() => handleLogin()}>
        Login
      </button>
      </div>
    </div>
  );
}

