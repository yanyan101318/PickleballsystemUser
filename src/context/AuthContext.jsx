import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          await fetchUserProfile();
        } catch (err) {
          console.error("Auth check failed:", err);
          logout();
        }
      } else {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser({ uid: data.uid, email: data.email });
      setUserProfile(data);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const register = async ({ email, password, fullName, phone }) => {
    const { data } = await api.post('/auth/register', { email, password, fullName, phone });
    localStorage.setItem("token", data.token);
    setUser({ uid: data.user.uid, email: data.user.email });
    setUserProfile(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem("token", data.token);
    setUser({ uid: data.user.uid, email: data.user.email });
    setUserProfile(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email) => {
    // Implement standard reset password flow or placeholder
    console.log("Password reset requested for", email);
  };

  const updateUserProfile = async (data) => {
    if (!user) return;
    await api.put('/auth/profile', data);
    await fetchUserProfile();
  };

  const refreshProfile = () => user && fetchUserProfile();

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, register, login, logout, resetPassword, updateUserProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};