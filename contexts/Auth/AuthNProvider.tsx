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
        usePKCE: true,
        redirectUri: AuthSession.makeRedirectUri({
            scheme: config.expo.scheme
        })

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
        console.log(request)
        console.log(response)
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
                    let tokenResponse = await AuthSession.exchangeCodeAsync(accessTokenRequest, discoveryDocument)
                    persistTokenResponseData(tokenResponse);
                })()

                setIsAuthenticated(true)
            } catch (error) {
                console.error(error)
            }
        }
    }, [response])

    useEffect(() => {

        (async () => {
            let token, expiresIn, issuedAt, refreshToken
            if (Platform.OS != 'web') {
                [token, expiresIn, issuedAt, refreshToken] = await loadOnMobile()
            } else {
                [token, expiresIn, issuedAt, refreshToken] = await loadOnWeb()
            }
            setExpiresIn(typeof expiresIn == 'string' ? parseInt(expiresIn, 10) : expiresIn || 0)
            const now = new Date().getTime() / 1000
            const threshold = 3600000 // 1 hour in milliseconds
            if (token && expiresIn && issuedAt) {
                if (now < (typeof expiresIn == 'string'
                    ? parseInt(expiresIn, 10)
                    : expiresIn - threshold)) { // refresh access token if near to expire
                    console.log("refreshing token")
                    const tokenResponse: AuthSession.TokenResponse = await AuthSession.refreshAsync({
                        clientId: config.azure.ad.clientId,
                        refreshToken: refreshToken?.toString()
                    }, discoveryDocument)
                    persistTokenResponseData(tokenResponse)
                } else if (now < (typeof expiresIn == 'string'
                    ? parseInt(expiresIn, 10)
                    : expiresIn)) { // access token not expired
                    setIsAuthenticated(true)
                } else { // access token expired
                    setIsAuthenticated(false)
                }
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

async function saveOnWeb(token: string, expiresIn: number, issuedAt: number, refreshToken: string) {
    await AsyncStorage.setItem(STORE_KEY_TOKEN, token);
    await AsyncStorage.setItem(STORE_KEY_EXPIRES_IN, expiresIn.toString());
    await AsyncStorage.setItem(STORE_KEY_ISSUED_AT, issuedAt.toString());
    await AsyncStorage.setItem(STORE_KEY_TOKEN_REFRESH, refreshToken);
}

function saveOnMobile(token: string, expiresIn: number, issuedAt: number, refreshToken: string) {
    SecureStore.setItemAsync(STORE_KEY_TOKEN, token);
    SecureStore.setItemAsync(STORE_KEY_EXPIRES_IN, expiresIn.toString());
    SecureStore.setItemAsync(STORE_KEY_ISSUED_AT, issuedAt.toString());
    SecureStore.setItemAsync(STORE_KEY_TOKEN_REFRESH, refreshToken);
}

async function loadOnWeb(): Promise<(string | number | null)[]> {
    const token = await AsyncStorage.getItem(STORE_KEY_TOKEN);
    const expiresIn = await AsyncStorage.getItem(STORE_KEY_EXPIRES_IN);
    const issuedAt = await AsyncStorage.getItem(STORE_KEY_ISSUED_AT);
    const refreshToken = await AsyncStorage.getItem(STORE_KEY_TOKEN_REFRESH);
    return [
        token,
        expiresIn != null ? parseInt(expiresIn, 10) : null,
        issuedAt != null ? parseInt(issuedAt, 10) : null,
        refreshToken
    ];
}

async function loadOnMobile() {
    const token = await SecureStore.getItemAsync(STORE_KEY_TOKEN);
    const expiresIn = await SecureStore.getItemAsync(STORE_KEY_EXPIRES_IN);
    const issuedAt = await SecureStore.getItemAsync(STORE_KEY_ISSUED_AT);
    const refreshToken = await SecureStore.getItemAsync(STORE_KEY_TOKEN_REFRESH);
    return [
        token,
        expiresIn != null ? parseInt(expiresIn, 10) : null,
        issuedAt != null ? parseInt(issuedAt, 10) : null,
        refreshToken
    ];
}

function persistTokenResponseData(tokenResponse: AuthSession.TokenResponse) {
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
        console.error("After Code Exchange there is no accessToken, expiresIn or issuedAt values to be stored.");
    }
}
