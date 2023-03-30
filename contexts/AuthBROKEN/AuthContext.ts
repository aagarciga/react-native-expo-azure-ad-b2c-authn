import React from 'react';
import { AuthSessionResult } from 'expo-auth-session'

interface AuthContext {
    verbose: boolean;
    isAuthenticated: boolean;
    isPromptReady: boolean;
    accessToken?: string;
    setVerbose?: (value: boolean) => void;
    promptAsync?: () => Promise<AuthSessionResult>;
    revokeTokenAsync?: () => Promise<boolean>;
    refreshTokenAsync?: () => Promise<boolean>
}

export const defaultState: AuthContext = {
    verbose: false,
    isAuthenticated: false,
    isPromptReady: false
}

export default React.createContext<AuthContext>(defaultState)