import { Button, StyleSheet } from 'react-native';

import EditScreenInfo from '../../components/EditScreenInfo';
import { Text, View } from '../../components/Themed';
import { useAuthN } from '../../contexts/Auth/AuthNProvider';


export default function TabOneScreen() {

  // // const authN = useAutoDiscoveryAuthN()
  const authN = useAuthN()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab One</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />


      <Button
        title="Login"
        disabled={authN.isAuthenticated}
        onPress={() => authN.loginAsync?.()}
      />
      <Button
        title="Logout"
        disabled={!authN.isAuthenticated}
        onPress={() => authN.logoutAsync?.()}
      />

      <Text>{authN.isAuthenticated ? "authenticated" : "unauthenticated"}</Text>
      <Text>Expires in around {Math.ceil(authN.expiresIn / 60)} min.</Text>

      <EditScreenInfo path="app/(tabs)/index.tsx" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  button: {
    backgroundColor: '#acc',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16
  }
});
