import { auth } from '@/config/firebase';
import { needsEmailVerification } from '@/utils/verification';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  /** True while the signed-in person still has to verify their email. */
  mustVerifyEmail: boolean;
  /**
   * Re-reads the signed-in user from Firebase. Firebase changes the same user
   * object in place, so without this the app would not notice a verified email.
   */
  refreshUser: () => Promise<void>;
}

/**
 * The database rules read `email_verified` from the sign-in token, which
 * Firebase only refreshes about once an hour. After someone verifies, the
 * token is renewed at once so the database lets them in straight away.
 */
const syncVerifiedToken = async (user: User | null): Promise<void> => {
  if (!user?.emailVerified) return;
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.email_verified !== true) await user.getIdToken(true);
  } catch (err) {
    console.warn('Could not refresh the sign-in token:', err);
  }
};

/** The parts of a Firebase user the verification rule needs. */
export const mustVerify = (user: User | null): boolean =>
  needsEmailVerification(
    user
      ? {
          emailVerified: user.emailVerified,
          creationTime: user.metadata?.creationTime,
          providerIds: user.providerData.map((provider) => provider.providerId),
        }
      : null,
  );

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mustVerifyEmail, setMustVerifyEmail] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setMustVerifyEmail(mustVerify(user));
      syncVerifiedToken(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = useCallback(async () => {
    const user = auth.currentUser;
    if (user) await user.reload().catch(() => undefined);
    await syncVerifiedToken(auth.currentUser);
    setMustVerifyEmail(mustVerify(auth.currentUser));
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, mustVerifyEmail, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
