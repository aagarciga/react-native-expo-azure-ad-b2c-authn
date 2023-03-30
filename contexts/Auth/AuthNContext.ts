import { AuthRequest, AuthSessionResult } from "expo-auth-session"
import React from "react"


interface AuthNContext {
    isAuthenticated: boolean
    expiresIn: number
    request: AuthRequest | null
    response: AuthSessionResult | null
    promptAsync?: () => Promise<AuthSessionResult>
}

export const defaultState: AuthNContext = {
    isAuthenticated: false,
    expiresIn: 0,
    request: null,
    response: null
}

export default React.createContext<AuthNContext>(defaultState)