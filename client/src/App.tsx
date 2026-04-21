import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, useThemeProvider } from './hooks/useTheme';
import { ActiveSpaceContext, useActiveSpaceProvider } from './hooks/useSpaces';
import { Layout } from './components/layout/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: true,
    },
  },
});

function AppProviders({ children }: { children: React.ReactNode }) {
  const themeValue = useThemeProvider();
  const spaceValue = useActiveSpaceProvider();

  return (
    <ThemeContext.Provider value={themeValue}>
      <ActiveSpaceContext.Provider value={spaceValue}>
        {children}
      </ActiveSpaceContext.Provider>
    </ThemeContext.Provider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <Layout />
      </AppProviders>
    </QueryClientProvider>
  );
}
