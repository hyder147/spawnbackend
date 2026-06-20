import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
    id: string;
    username: string;
    email: string;
    userType: 'Developer' | 'Gamer';
    role?: string;
    skillsets?: string[];
    portfolioUrls?: string[];
    profilePicture?: string;
    hardware?: {
        gpu?: string;
        cpu?: string;
        ram?: string;
        os?: string;
    };
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const savedToken = localStorage.getItem('spawnpoint_token');
            const savedUser = localStorage.getItem('spawnpoint_user');

            if (savedToken && savedUser) {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            }
        } catch (error) {
            console.error('Failed to load auth data:', error);

            localStorage.removeItem('spawnpoint_token');
            localStorage.removeItem('spawnpoint_user');
        } finally {
            setLoading(false);
        }
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);

        localStorage.setItem('spawnpoint_token', newToken);
        localStorage.setItem('spawnpoint_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);

        localStorage.removeItem('spawnpoint_token');
        localStorage.removeItem('spawnpoint_user');
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                login,
                logout,
                isLoggedIn: !!user
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);

    if (!ctx) {
        throw new Error('useAuth must be used inside AuthProvider');
    }

    return ctx;
};