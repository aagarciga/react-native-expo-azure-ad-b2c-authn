import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import { Platform } from "expo-modules-core";
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { ReactNode, useContext, useEffect, useState } from "react";
import config from '../../app.json';
import AuthNContext, { defaultState } from "./AuthNContext";

interface AuthNProviderProps {
    children: ReactNode
}

WebBrowser.maybeCompleteAuthSession()

const STORE_KEY_TOKEN = 'accessToken'
const STORE_KEY_TOKEN_REFRESH = 'refreshToken'
const STORE_KEY_EXPIRES_IN = 'expiresIn'
const STORE_KEY_ISSUED_AT = 'issuedAt'

/**
     * Azure AD B2C endpoints are specific to the user flow ("policy") that an application wishes to use to authenticate users. 
     * Replace the user flow (policy) name as <policy-name> where indicated below to access that user flow/policy's endpoint.
     */
const discoveryDocument: AuthSession.DiscoveryDocument = {
    // Azure AD B2C OAuth 2.0 authorization endpoint (v2)
    authorizationEndpoint: `https://${config.azure.ad.domain}.b2clogin.com/${config.azure.ad.domain}.onmicrosoft.com/${config.azure.ad.policySignIn}/oauth2/v2.0/authorize`,
    // Azure AD B2C OAuth 2.0 token endpoint (v2)
    tokenEndpoint: `https://${config.azure.ad.domain}.b2clogin.com/${config.azure.ad.domain}.onmicrosoft.com/${config.azure.ad.policySignIn}/oauth2/v2.0/token`,
    // Azure AD B2C OAuth 2.0 logout endpoint (v2)
    endSessionEndpoint: `https://${config.azure.ad.domain}.b2clogin.com/${config.azure.ad.domain}.onmicrosoft.com/${config.azure.ad.policySignIn}/oauth2/v2.0/logout`
}

export default ({ children }: AuthNProviderProps) => {

    /**
     * Load an authorization request for a code. 
     * Returns a loaded request, a response, and a prompt method. 
     * When the prompt method completes then the response will be fulfilled.
     */
    const [request, response, promptAsync] = AuthSession.useAuthRequest({
        clientId: config.azure.ad.clientId,
        scopes: config.azure.ad.scopes,
        responseType: AuthSession.ResponseType.Code,
        redirectUri: AuthSession.makeRedirectUri({
            scheme: config.expo.scheme
        }),
    }, discoveryDocument)

    const [isAuthenticated, setIsAuthenticated] = useState(defaultState.isAuthenticated)
    const [expiresIn, setExpiresIn] = useState(defaultState.expiresIn)

    async function logoutAsync() {
        try {
            let token
            if (Platform.OS != 'web') {
                [token] = await loadOnMobile()
            } else {
                [token] = await loadOnWeb()
            }
            return await AuthSession.revokeAsync({
                clientId: config.azure.ad.clientId,
                token: token?.toString() || ''
            }, discoveryDocument)
        } catch (error) {
            console.error(error)
        }
        return false
    }

    useEffect(() => {

        if (request && response && response.type == 'success') {
            try {
                (async () => {

                    const accessTokenRequest = new AuthSession.AccessTokenRequest({
                        code: response.params.code,
                        clientId: config.azure.ad.clientId,
                        scopes: config.azure.ad.scopes,
                        extraParams: {
                            code_verifier: request.codeVerifier || ''
                        },
                        redirectUri: AuthSession.makeRedirectUri({
                            scheme: config.expo.scheme
                        })
                    })
                    let tokenResponse = await AuthSession
                        .exchangeCodeAsync(accessTokenRequest, discoveryDocument)
                    saveTokenData(tokenResponse)
                })()

                setIsAuthenticated(true)
            } catch (error) {
                console.info(error)
                setIsAuthenticated(false)
            }
        } else if (response?.type == 'error') {
            console.info(response?.error)
            setIsAuthenticated(false)
        }

    }, [response])

    useEffect(() => {

        (async () => {

            try {
                const [token, expiresIn, issuedAt, refreshToken] = await loadTokenData()

                if (token && expiresIn && issuedAt) {
                    const now = new Date().getTime() / 1000 //Seconds
                    const threshold = config.azure.ad.refreshThreshold // Seconds
                    const expires = calculateExpiration(Number(issuedAt), Number(expiresIn), now)
                    setExpiresIn(expires)

                    if (now < (Number(issuedAt) + Number(expiresIn))) { // access token not expired
                        if (now > (Number(issuedAt) + Number(expiresIn) - threshold)) { // refresh access token if near to expire
                            console.info("Refreshing ACCESS TOKEN:", token)
                            console.info("with refresh token:", refreshToken)
                            const tokenResponse: AuthSession.TokenResponse = await AuthSession.refreshAsync({
                                clientId: config.azure.ad.clientId,
                                refreshToken: refreshToken?.toString()
                            }, discoveryDocument)
                            saveTokenData(tokenResponse)
                        } else {
                            console.info("Access Token valid for ", expires / 60, "minute(s).")
                        }
                        setIsAuthenticated(true)
                    } else { // access token expired
                        console.info("Access Token EXPIRED", issuedAt, now)
                        setIsAuthenticated(false)
                    }
                } else {
                    console.info("No values saved for access token")
                }
            } catch (error) {
                console.warn(error)
            }
        })()
    }, [])

    return <AuthNContext.Provider value={{
        isAuthenticated,
        expiresIn,
        request,
        response,
        loginAsync: promptAsync,
        logoutAsync
    }}>
        {children}
    </AuthNContext.Provider>
}

export const useAuthN = () => {
    const context = useContext(AuthNContext)
    if (!context)
        throw new Error(`${AuthNContext} must be used within its respective provider.`)
    return context
}

async function loadTokenData(): Promise<[string | null, number, number, string | null]> {
    return Platform.OS == 'web'
        ? await loadOnWeb()
        : await loadOnMobile();
}

/**
 * Persist access token related info on local storage for Web, Android and iOs platforms
 * @param tokenResponse 
 */
function saveTokenData(tokenResponse: AuthSession.TokenResponse) {
    const accessToken = tokenResponse.accessToken;
    const expiresIn = tokenResponse.expiresIn;
    const issuedAt = tokenResponse.issuedAt;
    const refreshToken = tokenResponse.refreshToken;

    if (accessToken && expiresIn && issuedAt && refreshToken) {
        if (Platform.OS != 'web') {
            saveOnMobile(accessToken, expiresIn, issuedAt, refreshToken);
        } else {
            saveOnWeb(accessToken, expiresIn, issuedAt, refreshToken);
        }
    } else {
        throw new Error("After Code Exchange there is no accessToken, expiresIn or issuedAt values to be stored.")
    }
}

/**
 * 
 * @param issuedAt token issue time in seconds
 * @param expiresIn token expiration time in seconds
 * @param now current time in seconds
 * @returns 
 */
function calculateExpiration(issuedAt: number, expiresIn: number, now: number): number {
    return (issuedAt + expiresIn - now);
}

/**
 * Persists the access token related info using AyncStorage for Web Platforms.
 * (This is an unsafe persistent storage)
 * @param token 
 * @param expiresIn 
 * @param issuedAt 
 * @param refreshToken 
 */
async function saveOnWeb(token: string, expiresIn: number, issuedAt: number, refreshToken: string) {
    await AsyncStorage.setItem(STORE_KEY_TOKEN, token);
    await AsyncStorage.setItem(STORE_KEY_EXPIRES_IN, expiresIn.toString());
    await AsyncStorage.setItem(STORE_KEY_ISSUED_AT, issuedAt.toString());
    await AsyncStorage.setItem(STORE_KEY_TOKEN_REFRESH, refreshToken);
}

/**
 * Persist the access token related info using SecureStore for Android and iOs.
 * @param token 
 * @param expiresIn 
 * @param issuedAt 
 * @param refreshToken 
 */
function saveOnMobile(token: string, expiresIn: number, issuedAt: number, refreshToken: string) {
    SecureStore.setItemAsync(STORE_KEY_TOKEN, token);
    SecureStore.setItemAsync(STORE_KEY_EXPIRES_IN, expiresIn.toString());
    SecureStore.setItemAsync(STORE_KEY_ISSUED_AT, issuedAt.toString());
    SecureStore.setItemAsync(STORE_KEY_TOKEN_REFRESH, refreshToken);
}

/**
 * Load from the local web client storage the token related info in an array format ready for decontruction.
 * @returns An array for decomposing the access token related info
 */
async function loadOnWeb(): Promise<[string | null, number, number, string | null]> {
    const token = await AsyncStorage.getItem(STORE_KEY_TOKEN);
    const expiresIn = await AsyncStorage.getItem(STORE_KEY_EXPIRES_IN);
    const issuedAt = await AsyncStorage.getItem(STORE_KEY_ISSUED_AT);
    const refreshToken = await AsyncStorage.getItem(STORE_KEY_TOKEN_REFRESH);
    return [
        token,
        Number(expiresIn),
        Number(issuedAt),
        refreshToken
    ];
}

/**
 * 
 * @returns Load from the secure local client storage for Android and iOs platforms
 */
async function loadOnMobile(): Promise<[string | null, number, number, string | null]> {
    const token = await SecureStore.getItemAsync(STORE_KEY_TOKEN);
    const expiresIn = await SecureStore.getItemAsync(STORE_KEY_EXPIRES_IN);
    const issuedAt = await SecureStore.getItemAsync(STORE_KEY_ISSUED_AT);
    const refreshToken = await SecureStore.getItemAsync(STORE_KEY_TOKEN_REFRESH);
    return [
        token,
        Number(expiresIn),
        Number(issuedAt),
        refreshToken
    ];
}