import { ReactNode, useContext, useEffect, useState } from "react"
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import config from '../../app.json'
import AutoDiscoveryAuthNContext, { defaultState } from "./AutoDiscoveryAuthNContext"
import { Platform } from "expo-modules-core"

interface AutoDiscoveryAuthNProviderProps {
    children: ReactNode
}

WebBrowser.maybeCompleteAuthSession()

const STORE_KEY_TOKEN = 'token'
const STORE_KEY_EXPIRES_IN = 'expiresIn'
const STORE_KEY_ISSUED_AT = 'issuedAt'

const saveOnWeb = async (token: string, expiresIn: number, issuedAt: number) => {
    await AsyncStorage.setItem(STORE_KEY_TOKEN, token)
    await AsyncStorage.setItem(STORE_KEY_EXPIRES_IN, expiresIn.toString())
    await AsyncStorage.setItem(STORE_KEY_ISSUED_AT, issuedAt.toString())
}

const saveOnMobile = (token: string, expiresIn: number, issuedAt: number) => {
    SecureStore.setItemAsync(STORE_KEY_TOKEN, token)
    SecureStore.setItemAsync(STORE_KEY_EXPIRES_IN, expiresIn.toString())
    SecureStore.setItemAsync(STORE_KEY_ISSUED_AT, issuedAt.toString())
}

const loadOnWeb = async (): Promise<(string | number | null)[]> => {
    const token = await AsyncStorage.getItem(STORE_KEY_TOKEN)
    const expiresIn = await AsyncStorage.getItem(STORE_KEY_EXPIRES_IN)
    const issuedAt = await AsyncStorage.getItem(STORE_KEY_ISSUED_AT)
    return [
        token,
        expiresIn != null ? parseInt(expiresIn, 10) : null,
        issuedAt != null ? parseInt(issuedAt, 10) : null
    ]
}

const loadOnMobile = async () => {
    const token = await SecureStore.getItemAsync(STORE_KEY_TOKEN)
    const expiresIn = await SecureStore.getItemAsync(STORE_KEY_EXPIRES_IN)
    const issuedAt = await SecureStore.getItemAsync(STORE_KEY_ISSUED_AT)
    return [
        token,
        expiresIn != null ? parseInt(expiresIn, 10) : null,
        issuedAt != null ? parseInt(issuedAt, 10) : null
    ]
}

const checkAuthorization = async (): Promise<boolean> => {
    let token, expiresIn, issuedAt
    if (Platform.OS != 'web') {
        [token, expiresIn, issuedAt] = await loadOnMobile()
    } else {
        [token, expiresIn, issuedAt] = await loadOnWeb()
    }
    const now = new Date().getTime() / 1000

    if (token && expiresIn && issuedAt && now < expiresIn) {
        return true
    }
    return false
}

export default ({ children }: AutoDiscoveryAuthNProviderProps) => {

    const issuer = `https://login.microsoftonline.com/${config.azure.ad.tenantId}/v2.0`
    const discoveryDocument = AuthSession.useAutoDiscovery(issuer)

    /**
     * Load an authorization request for a code. 
     * Returns a loaded request, a response, and a prompt method. 
     * When the prompt method completes then the response will be fulfilled.
     */
    const [request, response, promptAsync] = AuthSession.useAuthRequest({
        clientId: config.azure.ad.clientId,
        scopes: config.azure.ad.scopes,
        redirectUri: AuthSession.makeRedirectUri({
            scheme: config.expo.scheme
        })
    }, discoveryDocument)

    const [isAuthenticated, setIsAuthenticated] = useState(defaultState.isAuthenticated)
    const [expiresIn, setExpiresIn] = useState(defaultState.expiresIn)

    useEffect(() => {
        (async () => {
            setIsAuthenticated(await checkAuthorization())
            const [token, expiresIn, issuedAt] = await loadOnMobile()
            setExpiresIn(typeof expiresIn == 'string' ? parseInt(expiresIn, 10) : expiresIn || 0)
        })()
    }, [])

    useEffect(() => {
        if (response && response.type == 'success') {

            setIsAuthenticated(true)

            const token = response.authentication?.accessToken
            const expiresIn = response.authentication?.expiresIn
            const issuedAt = response.authentication?.issuedAt
            if (token && expiresIn && issuedAt) {
                if (Platform.OS != 'web') {
                    saveOnMobile(token, expiresIn, issuedAt)
                } else {
                    saveOnWeb(token, expiresIn, issuedAt)
                }
            } else {
                console.log(response)
            }
        }

    }, [response])


    return <AutoDiscoveryAuthNContext.Provider value={{
        isAuthenticated,
        expiresIn,
        request,
        response,
        promptAsync
    }}>
        {children}
    </AutoDiscoveryAuthNContext.Provider>
}

export const useAutoDiscoveryAuthN = () => {
    const context = useContext(AutoDiscoveryAuthNContext)
    if (!context)
        throw new Error(`${AutoDiscoveryAuthNContext} must be used within its respective provider.`)
    return context
}