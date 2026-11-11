import { registerRootComponent } from 'expo';

// Must be imported before anything else: TaskManager.defineTask() inside
// this module has to run at load time so the OS can invoke the background
// notification poll even on a headless launch (app not otherwise mounted).
import './src/lib/backgroundNotificationTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
