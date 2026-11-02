import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';

interface NavBadgesContextValue {
  chatsCount?: number;
  setChatsCount: (count: number) => void;
}

const NavBadgesContext = createContext<NavBadgesContextValue | undefined>(undefined);

/**
 * `CustomBottomNavBar` is rebuilt with its host screen's count in Flutter
 * (chats_screen.dart). The web nav is rendered once by the router shell, so
 * the chats screen publishes its unread total here instead.
 */
export const NavBadgesProvider = ({ children }: { children: ReactNode }) => {
  const [chatsCount, setChatsCount] = useState<number | undefined>(undefined);

  const value = useMemo(
    () => ({ chatsCount, setChatsCount }),
    [chatsCount],
  );

  return <NavBadgesContext.Provider value={value}>{children}</NavBadgesContext.Provider>;
};

export const useNavBadges = () => {
  const ctx = useContext(NavBadgesContext);
  if (!ctx) throw new Error('useNavBadges must be used inside <NavBadgesProvider>');
  return ctx;
};

export const usePublishChatsCount = (count: number | undefined) => {
  const { setChatsCount } = useNavBadges();
  useEffect(() => {
    if (count != null) setChatsCount(count);
  }, [count, setChatsCount]);
};

export const useNavBadgeCounts = () => {
  const { chatsCount } = useNavBadges();
  return { chatsCount };
};
