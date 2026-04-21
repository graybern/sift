import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggle = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
