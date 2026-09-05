import { View } from 'react-native';

// No app, um `.svg` vira componente pelo `react-native-svg-transformer` (ver `metro.config.js`).
// O jest não passa pelo Metro, então cada import de ícone viraria "módulo não encontrado". Este
// dublê ocupa o lugar: o que os testes verificam é o rótulo e o destino do toque, não o desenho.
export default (props: Record<string, unknown>) => <View {...props} />;
