import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'
import tooltipDirective from './directives/tooltip'

const app = createApp(App)
app.directive('tooltip', tooltipDirective)
app.mount('#app')

