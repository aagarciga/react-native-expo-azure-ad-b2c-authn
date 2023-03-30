import { ReactNode, useContext, useEffect, useState } from "react";
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import AuthNContext, { defaultState } from "./AuthNContext";
import config from '../../app.json'


interface AuthNProviderProps {
    children: ReactNode
}

WebBrowser.maybeCompleteAuthSession()

export default ({ children }: AuthNProviderProps) => {


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

    /**
     * Load an authorization request for a code. 
     * Returns a loaded request, a response, and a prompt method. 
     * When the prompt method completes then the response will be fulfilled.
     */
    const [request, response, promptAsync] = AuthSession.useAuthRequest({
        clientId: config.azure.ad.clientId,
        scopes: config.azure.ad.scopes,
        // usePKCE: true,
        redirectUri: AuthSession.makeRedirectUri({
            scheme: config.expo.scheme
        })

    }, discoveryDocument)

    const [isAuthenticated, setIsAuthenticated] = useState(defaultState.isAuthenticated)
    const [expiresIn, setExpiresIn] = useState(defaultState.expiresIn)

    useEffect(() => {
        console.log(response)
        if (response && response.type == 'success') {
            setIsAuthenticated(true)
        }
    }, [response])


    return <AuthNContext.Provider value={{
        isAuthenticated,
        expiresIn,
        request,
        response,
        promptAsync
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