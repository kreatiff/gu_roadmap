import AppRouter from './router';
import PasswordGate from './components/PasswordGate';
import './App.css';

/**
 * Main App component. 
 * Renders the application router which handles navigation 
 * and protected route logic.
 */
function App() {
  return (
    <PasswordGate>
      <AppRouter />
    </PasswordGate>
  );
}

export default App;
