import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;

  zeusChatOpen: boolean;
  zeusChatContext: string | null;
  openZeusChat: () => void;
  openZeusChatWithContext: (context: string) => void;
  closeZeusChat: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  zeusChatOpen: false,
  zeusChatContext: null,
  openZeusChat: () => set({ zeusChatOpen: true, zeusChatContext: null }),
  openZeusChatWithContext: (context: string) => set({ zeusChatOpen: true, zeusChatContext: context }),
  closeZeusChat: () => set({ zeusChatOpen: false, zeusChatContext: null }),
}));
