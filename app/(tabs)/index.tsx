import { Button, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native';

import EditScreenInfo from '../../components/EditScreenInfo';
import { Text, View } from '../../components/Themed';
import { useAuthN } from '../../contexts/Auth/AuthNProvider';

import { useAutoDiscoveryAuthN } from '../../contexts/Auth/AutoDiscoveryAuthNProvider';

export default function TabOneScreen() {

  // // const authN = useAutoDiscoveryAuthN()
  const authN = useAuthN()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab One</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />


      <Button
        title="Login"
        disabled={!authN.request}
        onPress={() => authN.promptAsync?.()}
      />

      <Text>{authN.response?.type || authN.isAuthenticated ? "authenticated" : "unauthenticated"}</Text>
      <Text>{authN.expiresIn}</Text>

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
