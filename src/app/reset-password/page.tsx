'use client';

import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { useState } from 'react';
import { auth } from '@/lib/firebase';
import styles from '@/styles/UpdatePasswordPage.module.css';

export default function UpdatePasswordPage() {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }

    const fakeEmail = `${username}@example.com`;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, currentPassword);
      const user = userCredential.user;

      await updatePassword(user, newPassword);
      setMessage('Password updated successfully!');
    } catch (error) {
      setError('Failed to update password. Please check your input or try again.');
      console.error('Error details:', error);
    }
  };

  return (
    <div className={styles.updatePasswordContainer}>
      <h2 className={styles.updatePasswordTitle}>Update Password</h2>
      {error && <p className={styles.errorMessage}>{error}</p>}
      {message && <p className={styles.successMessage}>{message}</p>}
      <form onSubmit={handleUpdatePassword} className={styles.updatePasswordForm}>
        <div className={styles.inputGroup}>
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />
        </div>
        <div className={styles.inputGroup}>
          <label>Current Password:</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
          />
        </div>
        <div className={styles.inputGroup}>
          <label>New Password:</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter your new password"
          />
        </div>
        <div className={styles.inputGroup}>
          <label>Confirm New Password:</label>
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm your new password"
          />
        </div>
        <button type="submit" className={styles.updateButton}>
          Update Password
        </button>
      </form>
    </div>
  );
}

