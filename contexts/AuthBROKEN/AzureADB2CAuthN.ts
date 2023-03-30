import { useEffect } from "react"
import * as WebBrowser from 'expo-web-browser'

export default () => {
    useEffect(() => {
        WebBrowser.warmUpAsync()

        return () => {
            WebBrowser.coolDownAsync()
        }
    }, [])

}