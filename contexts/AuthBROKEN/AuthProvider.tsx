import {
    AccessTokenRequest,
    AccessTokenRequestConfig,
    AuthRequestConfig,
    DiscoveryDocument,
    exchangeCodeAsync,
    makeRedirectUri,
    refreshAsync,
    revokeAsync,
    TokenResponse,
    useAuthRequest
} from 'expo-auth-session';
import React, { ReactNode, useContext, useEffect, useState } from 'react'
import * as WebBrowser from 'expo-web-browser';

import {
    CLIENT_ID,
    CLIENT_SECRETv2,
    IDENTITY_DOMAIN,
    IDENTITY_POLICY_SIGNIN
} from './auth.config.json'
import AuthContext, { defaultState } from './AuthContext';
import AzureADB2CAuthN from './AzureADB2CAuthN';

const AuthProvider = ({ children }: { children: ReactNode }) => {

    AzureADB2CAuthN()

    WebBrowser.maybeCompleteAuthSession()

    const [verbose, setVerbose] = useState(defaultState.verbose)
    const [isAuthenticated, setIsAuthenticated] = useState(defaultState.isAuthenticated)
    const [isPromptReady, setIsPromptReady] = useState(defaultState.isPromptReady)
    const [accessToken, setAccessToken] = useState<string>()
    const [tokenResponse, setTokenResponse] = useState<TokenResponse>()


    /**
     * Create a redirect url for the current platform and environment. 
     * You need to manually define the redirect that will be used in 
     * a bare workflow React Native app, or an Expo standalone app, 
     * this is because it cannot be inferred automatically.
     * 
     * Managed workflow: Uses the scheme property of your app.config.js or app.json.
     * schema: florence
     */
    const redirectUri = makeRedirectUri()
    const scopes = [
        'openid',
        'offline_access'
    ]
    const requestConfig: AuthRequestConfig = {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRETv2,
        redirectUri,
        scopes,
        usePKCE: true
    }

    /**
     * Azure AD B2C endpoints are specific to the user flow ("policy") that an application wishes to use to authenticate users. 
     * Replace the user flow (policy) name as <policy-name> where indicated below to access that user flow/policy's endpoint.
     */
    const discoveryDocument: DiscoveryDocument = {
        // Azure AD B2C OAuth 2.0 authorization endpoint (v2)
        authorizationEndpoint: `https://${IDENTITY_DOMAIN}.b2clogin.com/${IDENTITY_DOMAIN}.onmicrosoft.com/${IDENTITY_POLICY_SIGNIN}/oauth2/v2.0/authorize`,
        // Azure AD B2C OAuth 2.0 token endpoint (v2)
        tokenEndpoint: `https://${IDENTITY_DOMAIN}.b2clogin.com/${IDENTITY_DOMAIN}.onmicrosoft.com/${IDENTITY_POLICY_SIGNIN}/oauth2/v2.0/token`,
        // Azure AD B2C OAuth 2.0 logout endpoint (v2)
        endSessionEndpoint: `https://${IDENTITY_DOMAIN}.b2clogin.com/${IDENTITY_DOMAIN}.onmicrosoft.com/${IDENTITY_POLICY_SIGNIN}/oauth2/v2.0/logout`
    }

    /**
     * Load an authorization request for a code. 
     * Returns a loaded request, a response, and a prompt method. 
     * When the prompt method completes then the response will be fulfilled.
     */
    const [request, response, promptAsync] = useAuthRequest(requestConfig, discoveryDocument)

    const getAccessTokenAsync = async (config: AccessTokenRequestConfig) =>
        new AccessTokenRequest(config)

    const makeAccessTokenRequest = async (
        config: AccessTokenRequestConfig,
        discoveryDocument: DiscoveryDocument
    ) => {
        try {
            const tokenRequest = await getAccessTokenAsync(config)
            const tokenResponse = await exchangeCodeAsync(tokenRequest, discoveryDocument)

            setTokenResponse(tokenResponse)
            setAccessToken(tokenResponse.accessToken)
            setIsAuthenticated(!!accessToken)
        } catch (error) {
            showErrorOnConsole(error)
        }
    }

    const revokeTokenAsync = async () => {
        let result = false
        try {
            if (typeof accessToken == 'string') {
                result = await revokeAsync({ token: accessToken }, discoveryDocument)

                setIsAuthenticated(result)
                setTokenResponse(undefined)
                setAccessToken(undefined)
            }
        } catch (error) {
            showErrorOnConsole(error)
        }
        return result
    }

    const refreshTokenAsync = async () => {
        try {
            if (typeof accessToken == 'string') {
                const tokenResponse = await refreshAsync({
                    clientId: CLIENT_ID,
                    refreshToken: accessToken
                }, discoveryDocument)

                setTokenResponse(tokenResponse)
                setAccessToken(tokenResponse.accessToken)
                return true
            }
        } catch (error) {
            showErrorOnConsole(error)
        }
        return false
    }

    const showErrorOnConsole = (error: unknown) => {
        console.error(`[AuthorizationContext] Error:`, error)
    }

    /**
     * How web browser based authentication flows work.
     * 
     * The typical flow for browser-based authentication in mobile apps is as follows:
     * - Initiation: the user presses a sign in button
     * - Open web browser: the app opens up a web browser to the authentication provider 
     * sign in page. The url that is opened for the sign in page usually includes 
     * information to identify the app, and a URL to redirect to on success. 
     * Note: the web browser should share cookies with your system web browser so that 
     * users do not need to sign in again if they are already authenticated on the system 
     * browser -- Expo's WebBrowser API takes care of this.
     * - Authentication provider redirects: upon successful authentication, the authentication 
     * provider should redirect back to the application by redirecting to URL provided by 
     * the app in the query parameters on the sign in page, provided that the URL is in the 
     * allowlist of allowed redirect URLs. Allowlisting redirect URLs is important to prevent 
     * malicious actors from pretending to be your application. The redirect includes data in 
     * the URL (such as user id and token), either in the location hash, query parameters, or both.
     * - App handles redirect: the redirect is handled by the app and data is parsed from the 
     * redirect URL.
     */
    // useEffect(() => {
    //     WebBrowser.warmUpAsync()

    //     return () => {
    //         WebBrowser.coolDownAsync()
    //     }
    // }, [])



    useEffect(() => {
        setIsPromptReady(!request)

    }, [request])

    useEffect(() => {
        setIsAuthenticated(!!tokenResponse)
    }, [tokenResponse])

    useEffect(() => {
        if (request && response?.type == 'success') {

            const tokenRequestConfig: AccessTokenRequestConfig = {
                code: response.params.code,
                clientId: CLIENT_ID,
                redirectUri,
                scopes,
                extraParams: {
                    code_verifier: request.codeVerifier || ''
                }
            }
            makeAccessTokenRequest(tokenRequestConfig, discoveryDocument)
            if (verbose) {
                console.log(`[AuthorizationProvider][Azure AD B2C] Authenticated.`)
            }
        }

    }, [response])

    return (<AuthContext.Provider value={{
        verbose,
        accessToken,
        isAuthenticated,
        isPromptReady,
        setVerbose: (value: boolean) => setVerbose(value),
        promptAsync,
        revokeTokenAsync,
        refreshTokenAsync

    }}>
        {children}
    </AuthContext.Provider>)
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error(`${AuthContext} must be used within an ${AuthProvider}`)
    }
    return context
}

export default AuthProvider