import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './styles/main.css';
import { App } from './ui/app';

const root = document.getElementById('app')!;
// exposed for debugging in the console
(window as unknown as { app: App }).app = new App(root);
