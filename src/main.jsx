import { render } from 'preact';
import { App } from './app.jsx';

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/plant-tracker/sw.js');
}
